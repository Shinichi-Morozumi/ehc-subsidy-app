// v1 / 2026-10-29 / EHC-0102 制度カードからの相談（lib/programLead.ts・app/api/program-lead）の検査。
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

const L = loadTs("lib/programLead.ts");
const answers = { pref: "tokyo23", facility: "tokuyou", capacity: "ge30", corp: "shafuku", staff: "le300", work: "renew", costMan: 3000, equipmentMan: null };
const landed = (ref) => ({ ref, landedAt: new Date(Date.now() - 60000).toISOString(), landing: "/tokyo" });
const form = (o = {}) => ({ company: "社会福祉法人テスト会 特養あおば", name: "山田 花子", reach: "hanako@example.co.jp", consent: true, source: "shindan", programId: "tokyoZeroemi", answers, referral: landed("krh01-care"), hp: "", elapsedMs: 8000, ...o });
const request = (body) => new Request("https://ehcjpn.com/api/program-lead", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${Math.floor(Math.random() * 200)}` }, body: JSON.stringify(body) });

test("ご連絡先の1欄: @ があればメール、なければ電話として確かめる", () => {
  assert.deepEqual(L.splitReach("a@example.co.jp"), { phone: null, email: "a@example.co.jp", error: null });
  assert.deepEqual(L.splitReach("03-1234-5678"), { phone: "03-1234-5678", email: null, error: null });
  assert.match(L.splitReach("a@b").error, /メールアドレス/);
  assert.match(L.splitReach("123").error, /お電話番号/);
  assert.match(L.splitReach(null).error, /どちら|ご入力/);
});

test("3項目: 同意・法人名・お名前・ご連絡先が無ければ受け付けない。制度と入口は決まった値だけ", () => {
  assert.equal(L.readProgramSubmit(form({ consent: false })).ok, false);
  assert.equal(L.readProgramSubmit(form({ company: " " })).ok, false);
  assert.equal(L.readProgramSubmit(form({ name: "" })).ok, false);
  assert.equal(L.readProgramSubmit(form({ reach: "" })).ok, false);
  const r = L.readProgramSubmit(form({ programId: "__proto__", source: "evil" }));
  assert.equal(r.ok, true);
  assert.equal(r.input.programId, null);
  assert.equal(r.input.source, "top");
  const ok = L.readProgramSubmit(form());
  assert.equal(ok.input.referral.partnerId, "KRH01");
  assert.equal(ok.input.answers.costMan, 3000);
});

test("Notion の行: 未着手・希望制度（都＝自治体／SII＝省エネ補助金）・メモに6問の答えと判定・紹介元", () => {
  const input = L.readProgramSubmit(form()).input;
  const lead = L.programLead(input, "EHC-20261106-100000-ABCD", "2026-11-06");
  assert.equal(lead.status, "未着手");
  assert.equal(lead.wishSubsidy, "自治体");
  assert.equal(lead.proposalNo, "EHC-20261106-100000-ABCD");
  assert.equal(lead.address, "東京都（23区）");
  assert.match(lead.memo, /相談したい制度: 東京都｜省エネ/);
  assert.match(lead.memo, /工事費の目安: 3,000万円（税抜）/);
  assert.match(lead.memo, /\[可能性あり\] 東京都｜省エネ .*最大2,250万円/);
  assert.match(lead.memo, /紹介元 KRH01/);
  assert.match(lead.nextAction, /紹介 KRH01・介護/);
  assert.equal(L.wishOf("sii"), "省エネ補助金");
  assert.equal(L.wishOf(null), "未定");
});

test("担当者宛メール: 件名に受付番号・制度・紹介。本文に行政書士の注意", () => {
  const input = L.readProgramSubmit(form()).input;
  const m = L.programStaffMail(input, "EHC-20261106-100000-ABCD", "2026-11-06");
  assert.match(m.subject, /^【補助金サイトの相談 EHC-20261106-100000-ABCD】社会福祉法人テスト会 特養あおば（東京都｜省エネ）［紹介 KRH01・介護］$/);
  assert.match(m.text, /行政書士/);
  assert.ok(!/申請代行/.test(m.text));
});

test("受け口: Notion に1行・担当者宛メール1通（確認用ページからは info@ehcjpn.com だけ・件名に印）", async () => {
  const { POST } = loadTs("app/api/program-lead/route.ts");
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
    const res = await POST(request(form()));
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.ok, true);
    assert.match(json.receiptNo, /^EHC-\d{8}-\d{6}-[2-9A-Z]{4}$/);
    const page = calls.find((c) => c.url.endsWith("/v1/pages"));
    assert.ok(page);
    assert.equal(page.body.properties["ステータス"].select.name, "未着手");
    assert.equal(page.body.properties["希望制度"].select.name, "自治体");
    assert.equal(sent.length, before + 1);
    assert.match(sent.at(-1).subject, /^【確認用ページから】【補助金サイトの相談/);
    assert.deepEqual(sent.at(-1).to, ["info@ehcjpn.com"]);
    assert.equal(sent.at(-1).replyTo, "hanako@example.co.jp");
    const phoneOnly = await POST(request(form({ reach: "03-1234-5678" })));
    assert.equal(phoneOnly.status, 200);
    assert.equal(sent.at(-1).replyTo, undefined, "電話だけなら返信先を付けない");
  } finally {
    global.fetch = realFetch;
    delete process.env.NOTION_TOKEN;
    delete process.env.DIAGNOSIS_MAIL_MODE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  }
});

test("受け口: 見えない欄・速すぎる送信は止める。どこにも残せないときは電話の案内で失敗を返す", async () => {
  const { POST } = loadTs("app/api/program-lead/route.ts");
  assert.equal((await POST(request(form({ hp: "x" })))).status, 400);
  assert.equal((await POST(request(form({ elapsedMs: 500 })))).status, 400);
  const none = await POST(request(form()));
  assert.equal(none.status, 502);
  assert.match((await none.json()).error, /03-5937-4340/);
});
