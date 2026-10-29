// v1 / 2026-10-14 / PJ-20261013-EHC-0070 紹介代理店の専用リンク（?ref=）を、受付番号・担当者宛メール・Notion の行まで運ぶ検査。
// nodemailer は記録するだけの偽物、Notion は fetch の偽物。実メール・実Notionには1件も出ない。
const sent = [];
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
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

const R = loadTs("lib/referral.ts");
const NOW = Date.parse("2026-10-14T06:00:00Z"); // 15:00 JST
const DAY = 86400000;

/* ───────── U01: 表と QR の URL が一致する ───────── */
test("U01 表の3つの専用URLは、チラシの QR とリンク（EHC-0074 v3）と完全に一致する", () => {
  assert.deepEqual(Object.keys(R.REFERRAL_LINKS).sort(), ["krh01-care", "krh01-clinic", "krh01-dropin"]);
  assert.equal(R.REFERRAL_LINKS["krh01-care"].entryUrl, "https://ehcjpn.com/kaigo?ref=krh01-care");
  assert.equal(R.REFERRAL_LINKS["krh01-dropin"].entryUrl, "https://ehcjpn.com/?ref=krh01-dropin");
  assert.equal(R.REFERRAL_LINKS["krh01-clinic"].entryUrl, "https://ehcjpn.com/?ref=krh01-clinic");
  for (const [ref, link] of Object.entries(R.REFERRAL_LINKS)) {
    const u = new URL(link.entryUrl);
    assert.equal(u.searchParams.get("ref"), ref, "URL の ref と表のキーが同じ");
    assert.equal(link.partnerId, "KRH01");
  }
});

/* ───────── サーバ側の確かめ（U04） ───────── */
test("U04 サーバの確かめ：表にあるコードだけ紹介元に割り当てる。未知・壊れ・期限切れ・未来は割り当てない", () => {
  const at = new Date(NOW - 2 * DAY).toISOString();
  const ok = R.readReferralClaim({ ref: "KRH01-DROPIN", landedAt: at, landing: "/" }, NOW);
  assert.equal(ok.known, true);
  assert.equal(ok.ref, "krh01-dropin", "大文字は小文字にそろえる");
  assert.equal(ok.partnerId, "KRH01");
  assert.equal(ok.material, "dropin");
  assert.equal(ok.entryUrl, "https://ehcjpn.com/?ref=krh01-dropin");

  const unknown = R.readReferralClaim({ ref: "krh02-dropin", landedAt: at, landing: "/" }, NOW);
  assert.equal(unknown.known, false, "表に無いコードは未登録扱い");
  assert.equal(unknown.partnerId, null, "KRH01 に割り当てない");

  assert.equal(R.readReferralClaim({ ref: "krh01-clinic", landedAt: new Date(NOW - 31 * DAY).toISOString(), landing: "/" }, NOW), null, "30日を過ぎたら紹介なし");
  assert.equal(R.readReferralClaim({ ref: "krh01-clinic", landedAt: new Date(NOW + DAY).toISOString(), landing: "/" }, NOW), null, "未来の時刻は信用しない");
  for (const bad of [null, "krh01-dropin", [], { ref: "x y" }, { ref: "<script>", landedAt: at }, { ref: "a".repeat(21), landedAt: at }, { ref: "krh01-dropin", landedAt: "きのう" }]) {
    assert.equal(R.readReferralClaim(bad, NOW), null, `壊れた値は紹介なし: ${JSON.stringify(bad)}`);
  }
  assert.equal(R.readReferralClaim({ ref: "krh01-dropin", landedAt: at, landing: "/admin" }, NOW).landing, "/", "着いたページは決まったものだけ");
  assert.equal(R.readReferralClaim({ ref: "__proto__", landedAt: at }, NOW).known, false, "表の外のキー名でも割り当てない");
});

test("担当者向けの行：表にあれば 紹介元・資料・専用URL・着いた日時・受付番号。率は確定しないと書く", () => {
  const r = R.readReferralClaim({ ref: "krh01-clinic", landedAt: "2026-10-14T05:02:00Z", landing: "/" }, NOW);
  const lines = R.referralLines(r, "EHC-20261014-140500-AB2C").join("\n");
  assert.match(lines, /紹介元 KRH01／資料 クリニック・歯科医院のチラシ（ref=krh01-clinic）/);
  assert.match(lines, /流入した専用URL: https:\/\/ehcjpn\.com\/\?ref=krh01-clinic/);
  assert.match(lines, /着いた日時: 2026-10-14 14:02（日本時間）／着いたページ: \/／受付番号: EHC-20261014-140500-AB2C/);
  assert.match(lines, /紹介料の対象・率は契約書と紹介の管理記録で確かめる/);
  assert.doesNotMatch(lines, /10%|10％|3%|3％/, "料率は書かない");
  assert.equal(R.referralTag(r), "紹介 KRH01・クリニック");
  assert.equal(R.referralTag(null), "");
  assert.deepEqual(R.referralLines(null), ["紹介リンク: なし"]);
});

/* ───────── 画面側の覚え方（U03・U04） ───────── */
function fakeStore({ broken = false } = {}) {
  const m = new Map();
  return {
    getItem(k) { if (broken) throw new Error("blocked"); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (broken) throw new Error("blocked"); m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    _m: m,
  };
}
function withWindow(stores, fn) {
  const old = global.window;
  global.window = { localStorage: stores.local, sessionStorage: stores.session };
  try { return fn(); } finally { if (old === undefined) delete global.window; else global.window = old; }
}
const C = loadTs("lib/referralClient.ts");

test("U03 URL の ref を覚え、ref の無いページへ移っても・開き直しても運ぶ（30日まで）", () => {
  const stores = { local: fakeStore(), session: fakeStore() };
  withWindow(stores, () => {
    C.resetReferralMemoryForTest();
    const first = C.captureReferral("?ref=krh01-dropin", "/", NOW);
    assert.equal(first.ref, "krh01-dropin");
    C.resetReferralMemoryForTest(); // 再読み込み・タブを閉じて開き直したのと同じ
    assert.equal(C.captureReferral("", "/", NOW + DAY).ref, "krh01-dropin", "ref なしで開き直しても端末から戻る");
    C.resetReferralMemoryForTest();
    assert.equal(C.captureReferral("", "/", NOW + 31 * DAY), null, "30日を過ぎたら紹介なし");
  });
});

test("U03 端末への保存を断られても、同じページの中（送信まで）は運ぶ。開き直して ref が無ければ『未取得』", () => {
  const stores = { local: fakeStore({ broken: true }), session: fakeStore({ broken: true }) };
  withWindow(stores, () => {
    C.resetReferralMemoryForTest();
    assert.equal(C.captureReferral("?ref=krh01-clinic", "/", NOW).ref, "krh01-clinic");
    assert.equal(C.currentReferral(NOW + 60000).ref, "krh01-clinic", "同じページの中ではメモリから運ぶ");
    assert.equal(C.captureReferral("?ref=krh01-clinic", "/", NOW).ref, "krh01-clinic", "再読み込みでも URL に ref が残っていれば覚え直す");
    C.resetReferralMemoryForTest();
    assert.equal(C.captureReferral("", "/", NOW), null, "保存できず ref も無い→未取得（コードの入力は求めない）");
  });
});

test("U04 最後に開いた有効な紹介リンクを優先。表に無いコードでは、表にある紹介リンクを上書きしない", () => {
  const stores = { local: fakeStore(), session: fakeStore() };
  withWindow(stores, () => {
    C.resetReferralMemoryForTest();
    C.captureReferral("?ref=krh01-dropin", "/", NOW);
    assert.equal(C.captureReferral("?ref=krh01-clinic", "/", NOW + 1000).ref, "krh01-clinic", "別の有効なリンクは上書き");
    assert.equal(C.captureReferral("?ref=unknown01", "/", NOW + 2000).ref, "krh01-clinic", "未知のコードでは上書きしない");
    assert.equal(C.captureReferral("?ref=<bad>", "/", NOW + 3000).ref, "krh01-clinic", "壊れた値は無視して、覚えている方を使う");
  });
  const fresh = { local: fakeStore(), session: fakeStore() };
  withWindow(fresh, () => {
    C.resetReferralMemoryForTest();
    assert.equal(C.captureReferral("?ref=unknown01", "/", NOW).ref, "unknown01", "何も覚えていなければ、未知のコードも覚える（サーバで未登録扱い）");
    const saved = JSON.parse(fresh.local._m.get("ehc_ref"));
    assert.deepEqual(Object.keys(saved).sort(), ["landedAt", "landing", "ref"], "端末に残すのはコード・時刻・ページだけ");
  });
});

/* ───────── 受け口（diagnosis-submit）：U02・U05・U06 ───────── */
const { POST } = loadTs("app/api/diagnosis-submit/route.ts");
const { buildDiagnosisSnapshot } = loadTs("lib/diagnosisSnapshot.ts");
const { diagnosisContentForId, diagnosisFingerprint, estimateDigest } = loadTs("lib/diagnosisId.ts");
const { resetSubmitLedger } = loadTs("lib/submitLedger.ts");
const { resetSubmitRateLimit } = loadTs("lib/submitRateLimit.ts");
const { jsPDF } = require("jspdf");
const doc = new jsPDF(); doc.text("Test-only attachment", 10, 10);
const PDF = doc.output("datauristring");

function body(seq, referral) {
  const input = { contact: { name: "架空 太郎", email: "customer@example.invalid", company: "架空クリニック", phone: null },
    equipGroups: [], unpriced: [], customerBudgetYen: null, desiredTiming: null };
  const snapshot = buildDiagnosisSnapshot({ ...input, receiptNo: `EHC-20261014-150000-${seq}`, issuedAtJst: "2026-10-14", reductionBasis: null });
  const b = { ...input, receiptNo: snapshot.receiptNo, issuedAtJst: snapshot.issuedAtJst,
    contentFingerprint: diagnosisFingerprint({ kind: "diagnosis", caseKey: input.contact.email, content: diagnosisContentForId(input) }),
    estimateDigest: estimateDigest(snapshot.estimate), clientTotal: null, pdfBase64: PDF, filename: "test.pdf", hp: "", elapsedMs: 30000 };
  if (referral !== undefined) b.referral = referral;
  return b;
}
const landed = (ref, ago = 60000) => ({ ref, landedAt: new Date(Date.now() - ago).toISOString(), landing: "/" });

function setup(mode, { notion = "ok" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehc-referral-test-"));
  process.env.EHC_TARGET_PRODUCT_DIR = dir;
  process.env.DIAGNOSIS_MAIL_MODE = mode;
  process.env.SMTP_USER = "sender@example.invalid";
  process.env.SMTP_PASS = "test-only-not-a-secret";
  process.env.NOTION_TOKEN = "ntn_test_only";
  resetSubmitLedger(); resetSubmitRateLimit(); sent.length = 0;
  const pages = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => {
    const u = String(url);
    const b = init && init.body ? JSON.parse(init.body) : null;
    if (!u.startsWith("https://api.notion.com/")) throw new Error(`外への通信は禁止: ${u}`);
    if (u.endsWith("/query")) {
      const no = b.filter.rich_text.equals;
      const hit = pages.filter((p) => p.properties["提案No"].rich_text[0].text.content === no);
      return new Response(JSON.stringify({ results: hit }), { status: 200 });
    }
    if (notion === "fail") return new Response("{\"message\":\"test failure\"}", { status: 500 });
    pages.push(b);
    return new Response(JSON.stringify({ id: `page-${pages.length}` }), { status: 200 });
  };
  const logs = [];
  const old = { info: console.info, warn: console.warn, error: console.error };
  console.info = () => {}; console.warn = () => {}; console.error = (...a) => logs.push(a.join(" "));
  return {
    pages, logs,
    done() {
      global.fetch = realFetch;
      Object.assign(console, old);
      fs.rmSync(dir, { recursive: true, force: true });
      for (const k of ["EHC_TARGET_PRODUCT_DIR", "DIAGNOSIS_MAIL_MODE", "SMTP_USER", "SMTP_PASS", "NOTION_TOKEN"]) delete process.env[k];
    },
  };
}
async function post(value, ip = "203.0.113.20") {
  return POST(new Request("http://localhost/api/diagnosis-submit", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(value) }));
}
const memoOf = (p) => p.properties["メモ"].rich_text[0].text.content;
const nextOf = (p) => p.properties["次アクション"].rich_text[0].text.content;

for (const [ref, label, short] of [["krh01-dropin", "ドロップイン導入のチラシ", "ドロップイン"], ["krh01-clinic", "クリニック・歯科医院のチラシ", "クリニック"]]) {
  test(`U02/U05 ${ref}: 同じ受付番号で、担当者宛メールと Notion の行の両方に 紹介元・資料・専用URL が残る`, async () => {
    const env = setup("staff");
    try {
      const b = body(ref === "krh01-dropin" ? "DRP1" : "CLN1", landed(ref));
      const res = await post(b);
      const r = await res.json();
      assert.equal(res.status, 200);
      assert.equal(r.ok, true);
      assert.equal(r.staff, "sent");
      assert.equal(sent.length, 1, "担当者宛だけ（お客様宛は staff モードでは送らない）");
      const m = sent[0];
      assert.match(m.subject, new RegExp(`^【Web診断 ${b.receiptNo}】.*（紹介 KRH01・${short}）$`));
      assert.match(m.text, new RegExp(`紹介元 KRH01／資料 ${label}（ref=${ref}）`));
      assert.match(m.text, new RegExp(`流入した専用URL: https://ehcjpn\\.com/\\?ref=${ref}`));
      assert.match(m.text, new RegExp(`受付番号: ${b.receiptNo}`));
      assert.equal(env.pages.length, 1, "Notion に1行");
      const page = env.pages[0];
      assert.equal(page.properties["提案No"].rich_text[0].text.content, b.receiptNo, "Notion の行とメールが同じ受付番号");
      assert.match(memoOf(page), new RegExp(`紹介元 KRH01／資料 ${label}（ref=${ref}）`));
      assert.match(memoOf(page), new RegExp(`流入した専用URL: https://ehcjpn\\.com/\\?ref=${ref}`));
      assert.match(nextOf(page), new RegExp(`（紹介 KRH01・${short}）$`));
      const forward = m.text.split("━━━━━━━━━━ 転送用の文面 ━━━━━━━━━━")[1] || "";
      assert.ok(forward.length > 0, "転送用の文面がある");
      assert.doesNotMatch(forward, /KRH01|紹介元|ref=/, "お客様へ転送する文面には紹介の情報を入れない");
    } finally { env.done(); }
  });
}

test("U05 send モード：お客様宛のメールには紹介の情報が入らない", async () => {
  const env = setup("send");
  try {
    const r = await (await post(body("SND1", landed("krh01-dropin")))).json();
    assert.equal(r.customer, "sent");
    assert.equal(sent.length, 2);
    const customer = sent.find((m) => m.to === "customer@example.invalid");
    assert.ok(customer, "お客様宛がある");
    assert.doesNotMatch(`${customer.subject}\n${customer.text}`, /KRH01|紹介元|ref=|紹介リンク/);
    const staff = sent.find((m) => m.to !== "customer@example.invalid");
    assert.match(staff.subject, /（紹介 KRH01・ドロップイン）/);
  } finally { env.done(); }
});

test("U04 未知のコード：相談は通常どおり受け付け、紹介元には割り当てない（未登録と分かる）", async () => {
  const env = setup("staff");
  try {
    const r = await (await post(body("UNK1", landed("krh02-dropin")))).json();
    assert.equal(r.ok, true);
    assert.match(sent[0].subject, /（未登録の紹介コード）$/);
    assert.match(sent[0].text, /未登録のコード（ref=krh02-dropin）。紹介元には割り当てていません/);
    assert.doesNotMatch(sent[0].text, /KRH01/);
    assert.match(memoOf(env.pages[0]), /未登録のコード（ref=krh02-dropin）/);
  } finally { env.done(); }
});

test("U07 紹介リンクなし・期限切れ・壊れた値：これまでと同じ件名と行（紹介の行は付かない）", async () => {
  const env = setup("staff");
  try {
    for (const [seq, referral] of [["NON1", undefined], ["NUL1", null], ["OLD1", landed("krh01-dropin", 31 * DAY)], ["BAD1", { ref: "<x>" }]]) {
      sent.length = 0;
      const b = body(seq, referral);
      const r = await (await post(b)).json();
      assert.equal(r.ok, true, seq);
      assert.equal(sent[0].subject, `【Web診断 ${b.receiptNo}】架空クリニック 様からのご相談`, `${seq}: 件名は従来どおり`);
      assert.doesNotMatch(sent[0].text, /紹介リンク|KRH01/, `${seq}: 本文に紹介の行が無い`);
    }
    for (const p of env.pages) assert.doesNotMatch(memoOf(p), /紹介リンク|KRH01/);
    assert.equal(env.pages.length, 4);
  } finally { env.done(); }
});

test("U06 二重送信・再試行：同じ受付番号ではメールも Notion の行も増えず、帰属も変わらない", async () => {
  const env = setup("staff");
  try {
    const first = await (await post(body("DUP1", landed("krh01-dropin")))).json();
    assert.equal(first.staff, "sent");
    const again = await post(body("DUP1", landed("krh01-clinic")));
    const r = await again.json();
    assert.equal(again.status, 200);
    assert.equal(r.staff, "already_sent");
    assert.equal(sent.length, 1, "メールは1通のまま");
    assert.equal(env.pages.length, 1, "Notion の行は1行のまま");
    assert.match(memoOf(env.pages[0]), /資料 ドロップイン導入のチラシ/, "最初に送った帰属のまま");
  } finally { env.done(); }
});

test("U05 片側失敗：Notion に入らなくても、担当者宛メールに紹介の情報が残り、失敗は行の中身ごとログに出る", async () => {
  const env = setup("staff", { notion: "fail" });
  try {
    const r = await (await post(body("NTF1", landed("krh01-clinic")))).json();
    assert.equal(r.ok, true, "お客様への受付の結果は変えない（担当者にはメールが届いている）");
    assert.match(sent[0].text, /紹介元 KRH01／資料 クリニック・歯科医院のチラシ/);
    assert.equal(env.pages.length, 0);
    const log = env.logs.find((l) => l.includes("Notion への追加に失敗"));
    assert.ok(log, "失敗をログに出す");
    assert.match(log, /krh01-clinic/, "ログの行の中身から手で足せる");
  } finally { env.done(); }
});

/* ───────── /kaigo（介護）：既存の動きを保ったまま、紹介元・資料を足す ───────── */
const K = loadTs("lib/kaigo.ts");
const base = { facility: "gh", capacity: "le29", pref: "tokyo", city: "世田谷区", buildingAge: "ge20", acType: "package", acAge: "ge15", troubles: ["heat"], wants: ["light"] };
const contact = { company: "架空の家", name: "架空 花子", phone: "03-0000-0000", email: "hanako@example.invalid", scope: null, callTime: null };

test("介護：表にあるコードは 紹介元・資料・専用URL を足す。従来の『紹介コード: …』はそのまま", () => {
  const read = K.readKaigoSubmit({ answers: base, contact, consent: true, ref: "KRH01-CARE" });
  assert.equal(read.ok, true);
  const lead = K.kaigoLead(read.input, "EHC-20261014-150000-KG22", "2026-10-14");
  assert.match(lead.memo, /^【介護施設パンフ（QR）の事前確認】紹介コード: KRH01-CARE/);
  assert.match(lead.memo, /紹介元 KRH01／資料 介護施設向け補助金のチラシ（ref=krh01-care）/);
  assert.match(lead.memo, /流入した専用URL: https:\/\/ehcjpn\.com\/kaigo\?ref=krh01-care/);
  const mail = K.kaigoStaffMail(read.input, "EHC-20261014-150000-KG22");
  assert.match(mail.subject, /紹介コード KRH01-CARE/);
  assert.match(mail.text, /紹介元 KRH01／資料 介護施設向け補助金のチラシ/);
  const other = K.kaigoLead(K.readKaigoSubmit({ answers: base, contact, consent: true, ref: "p01" }).input, "EHC-20261014-150000-KG23", "2026-10-14");
  assert.match(other.memo, /紹介コード: P01/);
  assert.match(other.memo, /未登録のコード（ref=p01）/, "ほかのコードは紹介元に割り当てない（従来の数え方は残す）");
  const none = K.kaigoLead(K.readKaigoSubmit({ answers: base, contact, consent: true, ref: null }).input, "EHC-20261014-150000-KG24", "2026-10-14");
  assert.doesNotMatch(none.memo, /紹介リンク/);
});

/* ───────── U01: お客様の画面に紹介コードを出さない ───────── */
test("U01 お客様の画面のソースに、紹介コードの表示・入力欄が無い", () => {
  const kaigo = fs.readFileSync(path.join(root, "components/kaigo/KaigoChat.tsx"), "utf8");
  assert.doesNotMatch(kaigo, /ref\.toUpperCase\(\)|<p[^>]*>\s*紹介コード/, "介護の画面の下に紹介コードを出さない（コメントは除く）");
  assert.match(kaigo, /紹介リンクからのご相談として受け付けます/);
  for (const f of ["app/page.tsx", "components/ContactStage.tsx", "components/home/HomeV17.tsx"]) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    assert.doesNotMatch(src, /紹介コードを入力|紹介コード：|ID: KRH01/, `${f} に紹介コードの表示・入力が無い`);
  }
});
