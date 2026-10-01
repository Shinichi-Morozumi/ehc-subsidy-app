// v1 / 2026-10-01 / 介護施設向けの事前確認（/kaigo・EHC-0056）の検査。
// nodemailer と fetch は記録するだけの偽物に差し替える。実メール・実Notionには1件も出ない。
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

const k = loadTs("lib/kaigo.ts");
const base = { facility: "gh", capacity: "le29", pref: "tokyo", city: "世田谷区", buildingAge: "ge20", acType: "package", acAge: "ge15", troubles: ["heat"], wants: ["light"] };
const contact = { company: "社会福祉法人テスト会 グループホームあおば", name: "山田 花子", phone: "03-1234-5678", email: "hanako@example.co.jp", scope: "multi", callTime: "pm" };
const request = (body) => new Request("https://ehcjpn.com/api/kaigo-lead", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200)}` }, body: JSON.stringify(body) });

test("紹介コード: 英数・-_ の20字まで、小文字にそろえる。ほかは捨てる", () => {
  assert.equal(k.sanitizeRef("P01"), "p01");
  assert.equal(k.sanitizeRef("  e01 "), "e01");
  assert.equal(k.sanitizeRef("ehc"), "ehc");
  assert.equal(k.sanitizeRef("a/b"), null);
  assert.equal(k.sanitizeRef("<script>"), null);
  assert.equal(k.sanitizeRef("x".repeat(21)), null);
  assert.equal(k.sanitizeRef(undefined), null);
});

test("目安: グループホーム（都内）は国10/10・833万円。東京都の特養向けは出さない・省エネ補助金も出さない", () => {
  const e = k.kaigoEstimate(base);
  assert.equal(e.programs[0].key, "kokuB");
  assert.equal(e.programs[0].rate, "10/10");
  assert.match(e.headline, /10\/10（1施設 最大833万円）/);
  assert.ok(!e.programs.some((p) => p.key === "tokyo"));
  assert.ok(!e.programs.some((p) => p.key === "sii"));
});

test("目安: 都内の特養・29人以下は 1,660万円＋東京都3/4（条件しだい）", () => {
  const e = k.kaigoEstimate({ ...base, facility: "tokuyou" });
  assert.deepEqual(e.programs.map((p) => p.key), ["kokuA", "tokyo"]);
  assert.equal(e.programs[1].level, "maybe");
});

test("目安: 30人以上は 2/3（防災対策と一体）。都内なら東京都3/4・省エネの選択肢も並べる", () => {
  const e = k.kaigoEstimate({ ...base, facility: "tokuyou", capacity: "ge30" });
  assert.deepEqual(e.programs.map((p) => p.key), ["koku30", "tokyo", "sii", "zeroemi"]);
  assert.match(e.headline, /2\/3/);
  const e2 = k.kaigoEstimate({ ...base, facility: "rouken", capacity: "ge30", pref: "kanagawa" });
  assert.deepEqual(e2.programs.map((p) => p.key), ["koku30", "sii"]);
});

test("目安: 定員が分からない・施設の種類が分からないときは、条件しだいで並べる（断定しない）", () => {
  const e = k.kaigoEstimate({ ...base, facility: "yougo", capacity: "unknown", pref: "chiba" });
  assert.deepEqual(e.programs.map((p) => [p.key, p.level]), [["kokuB", "maybe"], ["koku30", "maybe"]]);
  assert.match(e.headline, /定員や施設の種類によって/);
  const e2 = k.kaigoEstimate({ ...base, facility: "other", capacity: "le29", pref: "saitama" });
  assert.deepEqual(e2.programs.map((p) => p.key), ["kokuA", "kokuB"]);
});

test("注意: ルームエアコンだけ・10年未満は注意を出す。採択と内示の注意はいつも出す", () => {
  const e = k.kaigoEstimate({ ...base, acType: "room", acAge: "lt10" });
  assert.ok(e.cautions.some((c) => c.includes("備品")));
  assert.ok(e.cautions.some((c) => c.includes("おおむね10年")));
  assert.ok(e.cautions.at(-1).includes("内示"));
  for (const c of e.cautions.concat(e.headline)) assert.ok(!/実質0円|必ず|確実/.test(c), c);
});

test("送信の確かめ: 同意・法人名・お名前・電話かメールが無ければ止める。知らない選択肢は捨てる", () => {
  const ok = { answers: base, contact, consent: true, ref: "P01" };
  assert.equal(k.readKaigoSubmit({ ...ok, consent: false }).ok, false);
  assert.equal(k.readKaigoSubmit({ ...ok, contact: { ...contact, company: " " } }).ok, false);
  assert.equal(k.readKaigoSubmit({ ...ok, contact: { ...contact, name: "" } }).ok, false);
  assert.equal(k.readKaigoSubmit({ ...ok, contact: { ...contact, phone: "", email: "" } }).ok, false);
  assert.equal(k.readKaigoSubmit({ ...ok, contact: { ...contact, email: "bad@" } }).ok, false);
  assert.equal(k.readKaigoSubmit({ ...ok, answers: { ...base, facility: "hospital" } }).ok, false);
  const r = k.readKaigoSubmit({ ...ok, answers: { ...base, wants: ["light", "pool", "light"] }, contact: { ...contact, email: null } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.input.answers.wants, ["light"]);
  assert.equal(r.input.ref, "p01");
  assert.equal(r.input.contact.email, null);
});

test("Notion の行: 未着手・提案No＝受付番号・紹介コードと答えをメモに残す", () => {
  const r = k.readKaigoSubmit({ answers: base, contact, consent: true, ref: "p01" });
  const lead = k.kaigoLead(r.input, "EHC-20261001-153000-ABCD", "2026-10-01");
  assert.equal(lead.status, "未着手");
  assert.equal(lead.proposalNo, "EHC-20261001-153000-ABCD");
  assert.equal(lead.address, "東京都 世田谷区");
  assert.match(lead.memo, /^【介護施設パンフ（QR）の事前確認】紹介コード: P01/);
  assert.match(lead.memo, /施設: グループホーム／定員: 29人以下/);
  assert.match(lead.memo, /相談の範囲: 法人のほかの施設もまとめて/);
  assert.match(lead.nextAction, /P01/);
  const mail = k.kaigoStaffMail(r.input, "EHC-20261001-153000-ABCD");
  assert.match(mail.subject, /紹介コード P01/);
  assert.match(mail.text, /行政書士/);
});

test("受け口: Notion に1行・担当者宛メール1通。受付番号は診断と同じ形（未着手の通知の対象）", async () => {
  const { POST } = loadTs("app/api/kaigo-lead/route.ts");
  process.env.NOTION_TOKEN = "ntn_test";
  process.env.DIAGNOSIS_MAIL_MODE = "staff";
  process.env.SMTP_USER = "info@neneweb.com";
  process.env.SMTP_PASS = "pass";
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init && init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith("/query")) return new Response(JSON.stringify({ results: [] }), { status: 200 });
    return new Response(JSON.stringify({ id: "page" }), { status: 200 });
  };
  const before = sent.length;
  try {
    const res = await POST(request({ answers: base, contact, consent: true, ref: "P01", hp: "", elapsedMs: 20000 }));
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.ok, true);
    assert.match(json.receiptNo, /^EHC-\d{8}-\d{6}-[2-9A-Z]{4}$/);
    const page = calls.find((c) => c.url.endsWith("/v1/pages"));
    assert.ok(page, "Notion に追加した");
    assert.equal(page.body.properties["ステータス"].select.name, "未着手");
    assert.equal(page.body.properties["提案No"].rich_text[0].text.content, json.receiptNo);
    assert.match(page.body.properties["メモ"].rich_text[0].text.content, /紹介コード: P01/);
    assert.equal(sent.length, before + 1);
    assert.match(sent.at(-1).subject, /^【確認用ページから】【介護施設の事前確認/);
    assert.deepEqual(sent.at(-1).to, ["info@ehcjpn.com"], "確認用ページからは info@ehcjpn.com だけ");
    assert.equal(sent.at(-1).cc, undefined, "確認用ページからは CC を付けない");
    assert.equal(sent.at(-1).replyTo, "hanako@example.co.jp");
  } finally {
    global.fetch = realFetch;
    delete process.env.NOTION_TOKEN;
    delete process.env.DIAGNOSIS_MAIL_MODE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  }
});

test("受け口: 見えない欄に入力がある・速すぎる送信は止める。どこにも残せないときは電話の案内で失敗を返す", async () => {
  const { POST } = loadTs("app/api/kaigo-lead/route.ts");
  const hp = await POST(request({ answers: base, contact, consent: true, hp: "http://spam", elapsedMs: 20000 }));
  assert.equal(hp.status, 400);
  const fast = await POST(request({ answers: base, contact, consent: true, hp: "", elapsedMs: 500 }));
  assert.equal(fast.status, 400);
  const none = await POST(request({ answers: base, contact, consent: true, hp: "", elapsedMs: 20000 }));
  assert.equal(none.status, 502);
  assert.match((await none.json()).error, /03-5937-4340/);
});

test("通知メール: 本番では info@ehcjpn.com を必ず宛先に入れ、担当者宛の宛先を変えても外れない。CC は診断と同じ", () => {
  const { mailConfig } = loadTs("lib/mailConfig.ts");
  const env = { VERCEL_ENV: "production", DIAGNOSIS_MAIL_MODE: "staff", SMTP_USER: "info@neneweb.com", SMTP_PASS: "x", DIAGNOSIS_STAFF_TO_EMAIL: "ito@ehcjpn.com" };
  const plan = k.kaigoMailPlan(mailConfig(env), env);
  assert.equal(plan.send, true);
  assert.deepEqual(plan.to, ["info@ehcjpn.com", "ito@ehcjpn.com"]);
  assert.deepEqual(plan.cc, ["info@project-neo.co.jp"]);
  assert.equal(plan.subjectPrefix, "");
  const env2 = { VERCEL_ENV: "production", SMTP_USER: "info@neneweb.com", SMTP_PASS: "x" };
  const plan2 = k.kaigoMailPlan(mailConfig(env2), env2);
  assert.equal(plan2.send, true, "DIAGNOSIS_MAIL_MODE が未設定でも社内宛の通知は送る");
  assert.deepEqual(plan2.to, ["info@ehcjpn.com"], "既定の宛先と重ならない");
});

test("通知メール: dry_run などで明示的に止めたとき・送信アカウントが無いときは送らない", () => {
  const { mailConfig } = loadTs("lib/mailConfig.ts");
  const env = { VERCEL_ENV: "production", DIAGNOSIS_MAIL_MODE: "dry_run", SMTP_USER: "a", SMTP_PASS: "b" };
  assert.equal(k.kaigoMailPlan(mailConfig(env), env).send, false);
  const env2 = { VERCEL_ENV: "production", DIAGNOSIS_MAIL_MODE: "staff" };
  assert.equal(k.kaigoMailPlan(mailConfig(env2), env2).send, false);
});

test("通知メール: Notion に入らなかったときは、手で追加するよう本文に書く", () => {
  const r = k.readKaigoSubmit({ answers: base, contact, consent: true, ref: "p01" });
  assert.match(k.kaigoStaffMail(r.input, "EHC-20261001-153000-ABCD", { notionSaved: false }).text, /Notion への追加に失敗/);
  assert.match(k.kaigoStaffMail(r.input, "EHC-20261001-153000-ABCD", { notionSaved: true }).text, /1行追加しています/);
});
