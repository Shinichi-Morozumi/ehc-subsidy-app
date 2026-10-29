// v1 / 2026-09-26 / 改善（検索・途中保存・迷惑送信・予約・送信元・未着手の通知・公募のお知らせ・写真の読み取り）の検査。
// nodemailer と fetch は記録するだけの偽物に差し替える。実メール・実Notion・実AIには1件も出ない。
const sent = [];
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const loaded = new Map();
function loadTs(filename) {
  const absolute = path.resolve(root, filename);
  if (loaded.has(absolute)) return loaded.get(absolute).exports;
  const mod = { exports: {} };
  loaded.set(absolute, mod);
  const nativeRequire = createRequire(absolute);
  const localRequire = (specifier) => {
    const candidate = specifier.startsWith("@/")
      ? path.resolve(root, specifier.slice(2))
      : specifier.startsWith(".") ? path.resolve(path.dirname(absolute), specifier) : null;
    if (candidate) {
      if (candidate.endsWith(".ts") && fs.existsSync(candidate)) return loadTs(candidate);
      if (fs.existsSync(`${candidate}.ts`)) return loadTs(`${candidate}.ts`);
    }
    if (specifier === "nodemailer") {
      return { createTransport() { return { async sendMail(m) { sent.push(m); return { messageId: `test-${sent.length}` }; } }; } };
    }
    return nativeRequire(specifier);
  };
  const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: absolute,
  }).outputText;
  vm.runInThisContext(`(function(exports, require, module, __filename, __dirname) {\n${compiled}\n})`, { filename: absolute })(
    mod.exports, localRequire, mod, absolute, path.dirname(absolute),
  );
  return mod.exports;
}

const draft = loadTs("lib/diagnosisDraft.ts");
const { spamReasonOf, spamMessage, MIN_ELAPSED_MS } = loadTs("lib/spamGuard.ts");
const { bookingUrlFrom, bookingMailLines } = loadTs("lib/booking.ts");
const photo = loadTs("lib/photoRead.ts");
const reminder = loadTs("lib/leadReminder.ts");
const notify = loadTs("lib/notifySignup.ts");
const { mailConfig } = loadTs("lib/mailConfig.ts");
const { newDiagnosisState } = loadTs("lib/diagnosisState.ts");

function memoryStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const request = (url, body, headers = {}) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

/* ───────── 途中保存 ───────── */
test("途中保存: 連絡先の欄は保存しない", () => {
  const a = draft.sanitizeAnswers({ pref: "東京都", size: "sme", customerEmail: "a@example.com", customerPhone: "03", customerCompany: "株式会社テスト", customerContact: "山田", customerAddress: "東京都", ehcStaff: "担当" });
  assert.deepEqual(Object.keys(a).sort(), ["pref", "size"]);
});

test("途中保存: 書いて読める・7問を終えていなければ再開に使わない・14日で消える", () => {
  const store = memoryStore();
  const now = Date.UTC(2026, 8, 26, 1, 30);
  assert.equal(draft.readDraft(now, store), null);
  draft.writeDraft({ flow: { stage: "equip", reached: ["find", "equip"], state: newDiagnosisState(), investSource: "estimate" } }, now, store);
  assert.equal(draft.readDraft(now, store), null, "7問の答えが無い保存は使わない");
  draft.writeDraft({ answers: { pref: "東京都" } }, now + 1000, store);
  const d = draft.readDraft(now + 2000, store);
  assert.equal(d.answers.pref, "東京都");
  assert.equal(d.flow.stage, "equip", "別々に書いた部分がそろう");
  assert.equal(draft.readDraft(now + draft.DRAFT_TTL_MS + 5000, store), null);
  assert.equal(store._m.size, 0, "古い保存は消す");
});

test("途中保存: 壊れた入力は戻さない", () => {
  const store = memoryStore();
  const now = Date.now();
  store.setItem(draft.DRAFT_KEY, JSON.stringify({ v: 1, savedAt: now, answers: { pref: "大阪府" }, flow: { stage: "result", reached: ["find"], state: { groups: [] }, investSource: "estimate" } }));
  const d = draft.readDraft(now, store);
  assert.equal(d.answers.pref, "大阪府");
  assert.equal(d.flow, null);
  store.setItem(draft.DRAFT_KEY, "{not json");
  assert.equal(draft.readDraft(now, store), null);
});

test("途中保存: 案内の文と時刻（日本時間）", () => {
  const state = newDiagnosisState();
  state.groups[0].kind = "ac";
  state.energyBill.kwh = 1200;
  const text = draft.describeDraft({ v: 1, savedAt: 0, answers: {}, flow: { stage: "result", reached: ["find", "equip", "result"], state, investSource: "estimate" } }, (s) => ({ result: "結果と根拠" })[s] ?? s);
  assert.equal(text, "7問の答え・設備 1種類・電気料金の明細（「結果と根拠」まで）");
  assert.equal(draft.formatSavedAtJst(Date.UTC(2026, 8, 26, 1, 5)), "9月26日 10:05");
});

/* ───────── 迷惑な送信 ───────── */
test("迷惑な送信: 見えない欄・3秒未満は止め、時間が無い古い画面は止めない", () => {
  assert.equal(spamReasonOf({ hp: "http://spam", elapsedMs: 60000 }), "honeypot");
  assert.equal(spamReasonOf({ hp: "", elapsedMs: MIN_ELAPSED_MS - 1 }), "too_fast");
  assert.equal(spamReasonOf({ hp: "", elapsedMs: MIN_ELAPSED_MS }), null);
  assert.equal(spamReasonOf({}), null);
  assert.equal(spamReasonOf({ elapsedMs: 2000 }, 1500), null, "短いフォームは下限を短く");
  assert.match(spamMessage("honeypot", "03-5937-4340"), /03-5937-4340/);
});

test("迷惑な送信: 診断の相談の口は、理由つきの 400 を返してメールを送らない", async () => {
  const { POST } = loadTs("app/api/diagnosis-submit/route.ts");
  const before = sent.length;
  const res = await POST(request("http://localhost/api/diagnosis-submit", { receiptNo: "EHC-20260926-101500-AB12", hp: "x", elapsedMs: 9000 }));
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.spam, "honeypot");
  assert.equal(sent.length, before);
});

/* ───────── 予約ページ ───────── */
test("旧予約ページ: 環境変数にURLが残っていてもリンクを返さない", () => {
  assert.equal(bookingUrlFrom(" https://calendar.app.google/abc "), null);
  assert.equal(bookingUrlFrom("javascript:alert(1)"), null);
  assert.equal(bookingUrlFrom("http://example.com"), null);
  assert.equal(bookingUrlFrom(undefined), null);
  assert.deepEqual(bookingMailLines(null), []);
  assert.deepEqual(bookingMailLines("https://x.example/b"), []);
});

/* ───────── 送信元 ───────── */
test("送信元: 診断専用のアカウントは、ユーザーとパスワードがそろったときだけ使う", () => {
  const base = { SMTP_USER: "info@neneweb.com", SMTP_PASS: "p1", DIAGNOSIS_MAIL_MODE: "staff" };
  assert.equal(mailConfig(base).user, "info@neneweb.com");
  assert.equal(mailConfig({ ...base, DIAGNOSIS_SMTP_USER: "info@ehcjpn.com" }).user, "info@neneweb.com", "片方だけなら使わない");
  const own = mailConfig({ ...base, DIAGNOSIS_SMTP_USER: "info@ehcjpn.com", DIAGNOSIS_SMTP_PASS: "p2" });
  assert.equal(own.user, "info@ehcjpn.com");
  assert.equal(own.pass, "p2");
  assert.equal(own.from, "EHCソリューションズ <info@ehcjpn.com>");
  assert.deepEqual(own.staffTo, ["info@ehcjpn.com"]);
  assert.equal(own.liveStaff, true);
  assert.equal(own.liveCustomer, false);
});

/* ───────── 写真の読み取り ───────── */
test("写真の読み取り: 明細の答えを確かめる（囲み・カンマ・範囲外）", () => {
  const r = photo.parseBillAnswer('```json\n{"period":"month","kwh":"1,234","yen":38000,"confidence":"high","note":null}\n```');
  assert.deepEqual(r.reading, { period: "month", kwh: 1234, yen: 38000 });
  assert.equal(r.confidence, "high");
  assert.equal(photo.parseBillAnswer('{"period":"week","kwh":-5,"yen":null}'), null, "読めた値が無ければ失敗");
  const odd = photo.parseBillAnswer('{"period":"x","kwh":900,"yen":null,"confidence":"?"}');
  assert.equal(odd.reading.period, null);
  assert.equal(odd.confidence, "low");
});

test("写真の読み取り: 銘板の馬力は、書かれていなければ標準の能力区分に当てはまるときだけ換算する", () => {
  const a = photo.parseNameplateAnswer('{"maker":"ダイキン","model_outdoor":"RZRP112BYT","year":2012,"hp":null,"capacity_kw":11.2}', 2026);
  assert.equal(a.reading.hp, 4);
  assert.equal(a.reading.hpFromCapacityKw, 11.2);
  const b = photo.parseNameplateAnswer('{"maker":"三菱","hp":5,"capacity_kw":11.2,"year":1975}', 2026);
  assert.equal(b.reading.hp, 5, "書かれた馬力を優先");
  assert.equal(b.reading.year, null, "範囲外の年は捨てる");
  const c = photo.parseNameplateAnswer('{"capacity_kw":12.5}', 2026);
  assert.equal(c, null, "区分に当てはまらない能力だけでは何も入れない");
  assert.equal(photo.hpFromCapacityKw(22.4), 8);
});

test("写真の読み取り: 受け付ける画像の形", () => {
  assert.equal(photo.splitImageDataUrl("data:image/jpeg;base64,AAAA").mediaType, "image/jpeg");
  assert.equal(photo.splitImageDataUrl("data:image/gif;base64,AAAA"), null);
  assert.equal(photo.splitImageDataUrl("https://example.com/a.jpg"), null);
  assert.equal(photo.splitImageDataUrl("data:image/png;base64," + "A".repeat(photo.PHOTO_MAX_DATA_URL_CHARS)), null);
});

test("写真の読み取り: 鍵が無ければ 503、あれば AI の答えを確かめて返す（画像はログに出さない）", async () => {
  const { POST } = loadTs("app/api/read-photo/route.ts");
  delete process.env.ANTHROPIC_API_KEY;
  let res = await POST(request("http://localhost/api/read-photo", { kind: "bill", image: "data:image/jpeg;base64,AAAA" }));
  assert.equal(res.status, 503);
  process.env.ANTHROPIC_API_KEY = "test-key";
  const realFetch = global.fetch;
  let called = null;
  global.fetch = async (url, init) => {
    called = { url, body: JSON.parse(init.body), headers: init.headers };
    return new Response(JSON.stringify({ content: [{ type: "text", text: '{"period":"month","kwh":2400,"yen":71000,"confidence":"medium","note":null}' }] }), { status: 200 });
  };
  try {
    res = await POST(request("http://localhost/api/read-photo", { kind: "bill", image: "data:image/jpeg;base64,AAAA" }, { "x-forwarded-for": "203.0.113.9" }));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json.reading, { period: "month", kwh: 2400, yen: 71000 });
    assert.equal(called.url, "https://api.anthropic.com/v1/messages");
    assert.equal(called.headers["x-api-key"], "test-key");
    assert.equal(called.body.messages[0].content[0].source.data, "AAAA");
  } finally {
    global.fetch = realFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

/* ───────── 未着手の通知 ───────── */
test("未着手の通知: 営業日の数え方（土日を除く）", () => {
  assert.equal(reminder.businessDaysBefore("2026-09-28", 2), "2026-09-24", "月曜の2営業日前は木曜");
  assert.equal(reminder.businessDaysBefore("2026-09-30", 2), "2026-09-28");
  assert.equal(reminder.businessDaysBetween("2026-09-25", "2026-09-29"), 2, "金→火は2営業日");
  assert.equal(reminder.businessDaysAfter("2026-09-25", 5), "2026-10-02");
});

test("未着手の通知: 絞り込み・行の読み方・同じ日に2度知らせない・本文", () => {
  const f = reminder.reminderFilter("2026-09-28");
  assert.deepEqual(f.and[0], { property: "ステータス", select: { equals: "未着手" } });
  assert.deepEqual(f.and[1], { property: "送信日", date: { on_or_before: "2026-09-24" } });
  assert.deepEqual(f.and[2], { property: "提案No", rich_text: { starts_with: "EHC-2" } });
  const page = (id, reminded) => ({
    id, url: `https://www.notion.so/${id}`,
    properties: {
      会社名: { title: [{ plain_text: "株式会社テスト" }] },
      提案No: { rich_text: [{ plain_text: "EHC-20260922-101500-AB12" }] },
      送信日: { date: { start: "2026-09-22" } },
      リマインド送信日: { date: reminded ? { start: reminded } : null },
      担当メール: { email: "t@example.com" },
      電話: { phone_number: null },
    },
  });
  const rows = reminder.rowsFromNotion([page("p1", null), page("p2", "2026-09-28"), { bad: true }]);
  assert.equal(rows.length, 2);
  const due = reminder.dueToday(rows, "2026-09-28");
  assert.deepEqual(due.map((r) => r.pageId), ["p1"]);
  const mail = reminder.reminderMail(due, "2026-09-28", 5);
  assert.match(mail.subject, /未着手.*1件/);
  assert.match(mail.text, /株式会社テスト　受付番号 EHC-20260922-101500-AB12/);
  assert.match(mail.text, /送信日 2026-09-22（4営業日前）／ご連絡の目安 2026-09-29（あと1営業日）/);
});

test("未着手の通知: 定期実行の口（認証・送信・Notion への記録）", async () => {
  const { GET } = loadTs("app/api/cron/lead-followup/route.ts");
  const denied = await GET(new Request("http://localhost/api/cron/lead-followup"));
  assert.equal(denied.status, 401);
  process.env.NOTION_TOKEN = "ntn_test";
  process.env.DIAGNOSIS_MAIL_MODE = "staff";
  process.env.SMTP_USER = "info@neneweb.com";
  process.env.SMTP_PASS = "pass";
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith("/query")) {
      return new Response(JSON.stringify({ results: [{ id: "p1", url: "https://www.notion.so/p1", properties: {
        会社名: { title: [{ plain_text: "株式会社テスト" }] }, 提案No: { rich_text: [{ plain_text: "EHC-20260901-101500-AB12" }] },
        送信日: { date: { start: "2026-09-01" } }, リマインド送信日: { date: null }, 担当メール: { email: "t@example.com" }, 電話: {} } }] }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  const before = sent.length;
  try {
    const res = await GET(new Request("http://localhost/api/cron/lead-followup", { headers: { "user-agent": "vercel-cron/1.0" } }));
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.due, 1);
    assert.equal(json.sent, true);
    assert.equal(json.marked, 1);
    assert.equal(sent.length, before + 1);
    assert.deepEqual(sent.at(-1).to, ["info@ehcjpn.com"]);
    const patch = calls.find((c) => c.method === "PATCH");
    assert.ok(patch.url.endsWith("/pages/p1"));
    assert.ok(patch.body.properties["リマインド送信日"].date.start);
  } finally {
    global.fetch = realFetch;
    delete process.env.NOTION_TOKEN;
    delete process.env.DIAGNOSIS_MAIL_MODE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  }
});

/* ───────── 公募のお知らせ ───────── */
test("公募のお知らせ: 入力の確かめ・受付番号・Notion の行", () => {
  assert.equal(notify.readNotifySignup({ email: "a@example.com" }), null, "同意が無ければ受け付けない");
  assert.equal(notify.readNotifySignup({ email: "not-mail", consent: true }), null);
  const input = notify.readNotifySignup({ email: " a@example.co.jp ", consent: true, company: "株式会社テスト<script>", programs: ["SII 設備単位型", 3, ""], pref: "東京都" });
  assert.equal(input.email, "a@example.co.jp");
  assert.equal(input.company, "株式会社テストscript");
  assert.deepEqual(input.programs, ["SII 設備単位型"]);
  const no = notify.notifyReceiptNo(new Date(Date.UTC(2026, 8, 26, 1, 2, 3)), () => 0);
  assert.equal(no, "EHC-N-20260926-100203-AAAA");
  assert.ok(!no.startsWith("EHC-2"), "未着手の通知の対象にならない");
  const lead = notify.notifyLead(input, no, "2026-09-26");
  assert.equal(lead.status, "お知らせ希望");
  assert.equal(lead.proposalNo, no);
  assert.match(lead.memo, /関心のある制度: SII 設備単位型/);
});

test("公募のお知らせ: 登録の口（Notion に入れて、担当者に知らせる）", async () => {
  const { POST } = loadTs("app/api/notify-signup/route.ts");
  process.env.NOTION_TOKEN = "ntn_test";
  process.env.DIAGNOSIS_MAIL_MODE = "staff";
  process.env.SMTP_USER = "info@neneweb.com";
  process.env.SMTP_PASS = "pass";
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response("{}", { status: 200 });
  };
  const before = sent.length;
  try {
    const bad = await POST(request("http://localhost/api/notify-signup", { email: "a@example.com", consent: true, hp: "bot" }));
    assert.equal(bad.status, 400);
    const res = await POST(request("http://localhost/api/notify-signup", { email: "a@example.com", consent: true, company: "株式会社テスト", programs: ["SII"], elapsedMs: 8000 }, { "x-forwarded-for": "198.51.100.7" }));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.match(json.receiptNo, /^EHC-N-\d{8}-\d{6}-[A-Z2-9]{4}$/);
    const page = calls.find((c) => c.url.endsWith("/v1/pages"));
    assert.equal(page.body.properties["ステータス"].select.name, "お知らせ希望");
    assert.equal(sent.length, before + 1);
    assert.equal(sent.at(-1).replyTo, "a@example.com");
  } finally {
    global.fetch = realFetch;
    delete process.env.NOTION_TOKEN;
    delete process.env.DIAGNOSIS_MAIL_MODE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  }
});

/* ───────── 検索・転送 ───────── */
test("検索: robots.txt と sitemap.xml", () => {
  const robots = loadTs("app/robots.ts").default();
  assert.equal(robots.sitemap, "https://ehcjpn.com/sitemap.xml");
  assert.ok(robots.rules[0].disallow.includes("/kanri"));
  const map = loadTs("app/sitemap.ts").default().map((e) => e.url);
  assert.deepEqual(map, ["https://ehcjpn.com/", "https://ehcjpn.com/kaigo", "https://ehcjpn.com/tokyo", "https://ehcjpn.com/shindan", "https://ehcjpn.com/team", "https://ehcjpn.com/dropin", "https://ehcjpn.com/company", "https://ehcjpn.com/privacy"]); // 2026-10-01: /kaigo を足した。2026-10-29 EHC-0102: /tokyo・/shindan を足した
});

test("検索: 旧URLは検索に出さず、/privacy-policy は /privacy へ転送する", async () => {
  const { default: config } = await import(path.join(root, "next.config.mjs"));
  const headers = await config.headers();
  const legacy = headers.find((h) => h.has && h.has[0].value === "ehc-subsidy-app.vercel.app");
  assert.deepEqual(legacy.headers, [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
  const redirects = await config.redirects();
  assert.ok(redirects.some((r) => r.source === "/privacy-policy" && r.destination === "/privacy" && r.permanent));
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.ok(!/robots:\s*\{\s*index:\s*false/.test(layout), "サイト全体の noindex を外した");
});
