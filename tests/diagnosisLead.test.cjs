// v1 / 2026-09-25 / Web診断の相談を Notion に1行足す処理と、担当者宛メールの「転送用の文面」。
// nodemailer と fetch は記録するだけの偽物に差し替える。実メール・実Notionには1件も出ない。
const sent = [];
const notionCalls = [];
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

const { POST } = loadTs("app/api/diagnosis-submit/route.ts");
const { buildDiagnosisSnapshot, customerMailText, forwardMailText, customerMailSubject } = loadTs("lib/diagnosisSnapshot.ts");
const { diagnosisContentForId, diagnosisFingerprint, estimateDigest } = loadTs("lib/diagnosisId.ts");
const { resetSubmitLedger } = loadTs("lib/submitLedger.ts");
const { resetSubmitRateLimit } = loadTs("lib/submitRateLimit.ts");
const { buildDiagnosisLead, parseManYenToYen, wishOf, addBusinessDaysJst } = loadTs("lib/diagnosisLead.ts");
const { appendLeadToNotionOnce, buildLeadProperties } = loadTs("lib/notionLead.ts");

const { jsPDF } = require("jspdf");
const doc = new jsPDF(); doc.text("Test-only attachment", 10, 10);
const PDF = doc.output("datauristring");

const CHECK = {
  answers: [{ question: "GビズIDプライムを取得済みですか", answer: "はい" }],
  programs: [
    { name: "東京都 ゼロエミッション化推進（テスト）", group: "今回の公募で進められる", fit: "条件を満たす見込み", timing: "受付中", amount: "最大 約1,234.5万円", selfCheck: "確認できた条件: 2件", ehcItems: ["機種"] },
    { name: "省エネルギー投資促進支援事業（SII）", group: "次回の公募に備える", fit: "要確認", timing: "次回", amount: "最大 約166.3万円（参考）", selfCheck: null, ehcItems: [] },
  ],
};

function body(seq, over = {}) {
  const input = {
    contact: { name: "テスト 太郎", email: "customer@example.invalid", company: "テスト株式会社", phone: "03-0000-0000" },
    equipGroups: [{ id: "g1", equip: "ac", installYear: 2012, units: 3, hp: 5, refri: "unknown" }],
    unpriced: [], customerBudgetYen: null, desiredTiming: "within_6m", ...over,
  };
  const snapshot = buildDiagnosisSnapshot({ ...input, receiptNo: `EHC-20260925-120000-${seq}`, issuedAtJst: "2026/09/25 12:00", reductionBasis: null });
  return { ...input, receiptNo: snapshot.receiptNo, issuedAtJst: snapshot.issuedAtJst,
    contentFingerprint: diagnosisFingerprint({ kind: "diagnosis", caseKey: input.contact.email, content: diagnosisContentForId(input) }),
    estimateDigest: estimateDigest(snapshot.estimate), clientTotal: snapshot.estimate ? snapshot.estimate.total : null,
    pdfBase64: PDF, filename: "test.pdf", subsidyCheck: CHECK };
}
async function post(value, ip = "203.0.113.20") {
  return POST(new Request("http://localhost/api/diagnosis-submit", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(value) }));
}

/* Notion の偽物。rows に入っている提案No は「すでにある」と答える。queryStatus で問い合わせの失敗も作れる */
function fakeNotion({ rows = [], queryStatus = 200, createStatus = 200 } = {}) {
  return async (url, init) => {
    const u = String(url);
    const b = init && init.body ? JSON.parse(init.body) : null;
    notionCalls.push({ url: u, body: b, headers: init && init.headers });
    if (!u.startsWith("https://api.notion.com/")) throw new Error(`unexpected fetch: ${u}`);
    if (u.endsWith("/query")) {
      const no = b && b.filter && b.filter.rich_text && b.filter.rich_text.equals;
      return new Response(JSON.stringify({ results: rows.includes(no) ? [{ id: "page-1" }] : [] }), { status: queryStatus });
    }
    if (u.endsWith("/v1/pages")) {
      if (createStatus === 200) rows.push(b.properties["提案No"].rich_text[0].text.content);
      return new Response(createStatus === 200 ? "{}" : '{"message":"validation"}', { status: createStatus });
    }
    throw new Error(`unexpected Notion path: ${u}`);
  };
}

function setup(mode, notion) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehc-lead-test-"));
  process.env.EHC_TARGET_PRODUCT_DIR = dir;
  if (mode) process.env.DIAGNOSIS_MAIL_MODE = mode; else delete process.env.DIAGNOSIS_MAIL_MODE;
  process.env.SMTP_USER = "sender@example.invalid";
  process.env.SMTP_PASS = "test-only-not-a-secret";
  if (notion) process.env.NOTION_TOKEN = "test-token-not-real"; else delete process.env.NOTION_TOKEN;
  resetSubmitLedger(); resetSubmitRateLimit(); sent.length = 0; notionCalls.length = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = notion || (async (u) => { throw new Error(`network is forbidden in this test: ${u}`); });
  const logs = { info: [], warn: [], error: [] };
  const old = { info: console.info, warn: console.warn, error: console.error };
  console.info = (...a) => logs.info.push(a.join(" "));
  console.warn = (...a) => logs.warn.push(a.join(" "));
  console.error = (...a) => logs.error.push(a.join(" "));
  return {
    logs,
    done() {
      Object.assign(console, old);
      globalThis.fetch = oldFetch;
      fs.rmSync(dir, { recursive: true, force: true });
      for (const k of ["EHC_TARGET_PRODUCT_DIR", "DIAGNOSIS_MAIL_MODE", "SMTP_USER", "SMTP_PASS", "NOTION_TOKEN"]) delete process.env[k];
    },
  };
}

test("parseManYenToYen / wishOf / addBusinessDaysJst", () => {
  assert.equal(parseManYenToYen("最大 約166.3万円"), 1663000);
  assert.equal(parseManYenToYen("最大 約1,234.5万円"), 12345000);
  assert.equal(parseManYenToYen("未定"), null);
  assert.equal(parseManYenToYen(null), null);
  assert.equal(wishOf("省エネルギー投資促進支援事業（SII）"), "省エネ補助金");
  assert.equal(wishOf("東京都 ゼロエミッション化推進（テスト）"), "自治体", "a prefecture programme is 自治体 even if it says 省エネ");
  assert.equal(wishOf("神奈川県 省エネ設備導入補助"), "自治体");
  assert.equal(wishOf("小規模事業者持続化補助金"), "持続化");
  assert.equal(wishOf(""), "未定");
  // 2026-09-25 is a Friday. 5 business days later is Friday 2026-10-02.
  assert.equal(addBusinessDaysJst(5, new Date("2026-09-25T10:00:00+09:00")), "2026-10-02");
  // Late Friday night in UTC is already Saturday in JST.
  assert.equal(addBusinessDaysJst(1, new Date("2026-09-25T16:00:00Z")), "2026-09-28");
});

test("buildDiagnosisLead: 未着手, amount from the current round, follow-up date", () => {
  const b = body("LEAD0");
  const s = buildDiagnosisSnapshot({ ...b, reductionBasis: null, subsidyCheck: CHECK });
  const lead = buildDiagnosisLead(s, { now: new Date("2026-09-25T10:00:00+09:00"), staffMail: "sent" });
  assert.equal(lead.status, "未着手");
  assert.equal(lead.company, "テスト株式会社");
  assert.equal(lead.contact, "テスト 太郎");
  assert.equal(lead.email, "customer@example.invalid");
  assert.equal(lead.subsidyYen, 12345000, "the next-round (参考) amount is not used");
  assert.equal(lead.wishSubsidy, "自治体");
  assert.equal(lead.proposalNo, "EHC-20260925-120000-LEAD0");
  assert.equal(lead.sentDate, "2026-09-25");
  assert.match(lead.nextAction, /5営業日以内にご連絡（目安 2026-10-02）/);
  assert.match(lead.memo, /受付番号 EHC-20260925-120000-LEAD0/);
  assert.match(lead.memo, /設備: 業務用パッケージ 5馬力×3台（2012年）/);
  assert.match(lead.memo, /GビズIDプライムを取得済みですか→はい/);
  assert.doesNotMatch(lead.memo, /要確認】担当者宛メール/);
  const unknown = buildDiagnosisLead(s, { staffMail: "unknown" });
  assert.match(unknown.memo, /^【要確認】担当者宛メールの送信結果が不明/);
  const props = buildLeadProperties(lead);
  assert.equal(props["ステータス"].select.name, "未着手");
  assert.equal(props["次アクション"].rich_text[0].text.content, lead.nextAction);
  assert.ok(props["メモ"].rich_text[0].text.content.length <= 1900);
  // Without a company name, the person's name becomes the row title.
  const b2 = body("LEAD1", { contact: { name: "個人 花子", email: "a@example.invalid", company: null, phone: null } });
  delete b2.subsidyCheck; // an older screen that does not send the self-check
  const s2 = buildDiagnosisSnapshot({ ...b2, reductionBasis: null });
  assert.equal(buildDiagnosisLead(s2).company, "個人 花子");
  assert.equal(buildDiagnosisLead(s2).subsidyYen, undefined);
  assert.equal(buildDiagnosisLead(s2).wishSubsidy, "未定");
});

test("appendLeadToNotionOnce: skips without a token, avoids duplicates, still adds when the lookup fails", async () => {
  const oldFetch = globalThis.fetch;
  try {
    delete process.env.NOTION_TOKEN;
    globalThis.fetch = async () => { throw new Error("must not be called"); };
    const skipped = await appendLeadToNotionOnce({ company: "x", proposalNo: "P1" });
    assert.equal(skipped.skipped, true);

    process.env.NOTION_TOKEN = "test-token-not-real";
    notionCalls.length = 0;
    globalThis.fetch = fakeNotion({ rows: ["P1"] });
    const dup = await appendLeadToNotionOnce({ company: "x", proposalNo: "P1" });
    assert.equal(dup.ok, true);
    assert.equal(dup.duplicate, true);
    assert.equal(notionCalls.filter((c) => c.url.endsWith("/v1/pages")).length, 0);

    notionCalls.length = 0;
    globalThis.fetch = fakeNotion({ rows: [], queryStatus: 403 });
    const added = await appendLeadToNotionOnce({ company: "x", proposalNo: "P2", status: "未着手" });
    assert.equal(added.ok, true);
    assert.equal(notionCalls.filter((c) => c.url.endsWith("/v1/pages")).length, 1, "a failed lookup does not stop the row");
    assert.equal(notionCalls[0].headers["Notion-Version"], "2022-06-28");

    notionCalls.length = 0;
    globalThis.fetch = fakeNotion({ rows: [], createStatus: 400 });
    const failed = await appendLeadToNotionOnce({ company: "x", proposalNo: "P3" });
    assert.equal(failed.ok, false);
    assert.match(failed.error, /Notion 400/);
  } finally {
    globalThis.fetch = oldFetch;
    delete process.env.NOTION_TOKEN;
  }
});

test("staff mode: one Notion row per new inquiry, none on the repeat press", async () => {
  const rows = [];
  const env = setup("staff", fakeNotion({ rows }));
  try {
    const r1 = await (await post(body("NTN1"))).json();
    assert.equal(r1.staff, "sent");
    assert.equal(r1.leadPersisted, undefined, "the Notion result is not shown to the customer");
    const creates = notionCalls.filter((c) => c.url.endsWith("/v1/pages"));
    assert.equal(creates.length, 1);
    const p = creates[0].body.properties;
    assert.equal(creates[0].body.parent.database_id, "27c3f8fe-bc9b-49f7-bba1-430b90697cec");
    assert.equal(p["会社名"].title[0].text.content, "テスト株式会社");
    assert.equal(p["ステータス"].select.name, "未着手");
    assert.equal(p["提案No"].rich_text[0].text.content, "EHC-20260925-120000-NTN1");
    assert.equal(p["担当メール"].email, "customer@example.invalid");
    assert.equal(p["電話"].phone_number, "03-0000-0000");
    assert.equal(p["補助金額(概算)"].number, 12345000);
    assert.equal(p["希望制度"].select.name, "自治体");
    assert.match(p["次アクション"].rich_text[0].text.content, /営業日以内にご連絡/);

    const r2 = await (await post(body("NTN1"))).json();
    assert.equal(r2.duplicate, true);
    assert.equal(notionCalls.filter((c) => c.url.endsWith("/v1/pages")).length, 1, "no second row");
    assert.equal(sent.length, 1);
    assert.ok(env.logs.info.some((l) => l.includes("Notion に1行追加")));
  } finally { env.done(); }
});

test("staff mode: another instance (fresh ledger) re-sends the mail but does not add a second row", async () => {
  const rows = [];
  const env = setup("staff", fakeNotion({ rows }));
  try {
    await post(body("NTN2"));
    resetSubmitLedger(); // same as a different serverless instance
    await post(body("NTN2"), "203.0.113.21");
    assert.equal(sent.length, 2, "the in-memory ledger cannot stop the second mail (known limit)");
    assert.equal(notionCalls.filter((c) => c.url.endsWith("/v1/pages")).length, 1);
    assert.ok(env.logs.info.some((l) => l.includes("同じ受付番号の行があるため追加せず")));
  } finally { env.done(); }
});

test("a Notion failure does not change the result the customer sees", async () => {
  const env = setup("staff", fakeNotion({ createStatus: 400 }));
  try {
    const res = await post(body("NTN3"));
    const r = await res.json();
    assert.equal(res.status, 200);
    assert.equal(r.ok, true);
    assert.equal(r.staff, "sent");
    assert.ok(env.logs.error.some((l) => l.includes("Notion への追加に失敗") && l.includes("EHC-20260925-120000-NTN3")),
      "the failure is logged with the row so it can be added by hand");
  } finally { env.done(); }
});

test("dry run and missing SMTP: nothing goes to Notion", async () => {
  for (const mode of [null, "staff"]) {
    const env = setup(mode, fakeNotion());
    try {
      if (mode === "staff") { delete process.env.SMTP_USER; delete process.env.SMTP_PASS; }
      await post(body(mode ? "NTN4" : "NTN5"));
      assert.equal(notionCalls.length, 0, `mode=${mode}`);
    } finally { env.done(); }
  }
});

test("staff mail: forwarding instructions and a customer-safe template at the end", async () => {
  const env = setup("staff", null);
  try {
    await post(body("FWD1"));
    assert.equal(sent.length, 1);
    const text = sent[0].text;
    assert.match(text, /転送のしかた（Gmail）/);
    assert.match(text, /宛先に customer@example\.invalid/);
    const start = text.indexOf("▼本文（ここから）");
    const end = text.indexOf("▲本文（ここまで）");
    assert.ok(start > 0 && end > start, "template is delimited");
    const subjectLine = text.slice(text.indexOf("▼件名") + 4, start).trim();
    assert.equal(subjectLine, "【受付番号 EHC-20260925-120000-FWD1】空調更新の診断結果と概算見積（株式会社EHCソリューションズ）");
    const tpl = text.slice(start + "▼本文（ここから）".length, end);
    assert.match(tpl, /^\nテスト株式会社\nテスト 太郎 様/);
    assert.match(tpl, /〔担当者名〕/);
    assert.match(tpl, /受付番号: EHC-20260925-120000-FWD1/);
    assert.match(tpl, /■ 概算費用/);
    assert.match(tpl, /■ 補助金の候補と適合チェック/);
    assert.match(tpl, /03-5937-4340/);
    assert.match(tpl, /平日 12:00〜17:00/);
    // Internal-only content must not be inside the template.
    for (const internal of ["■ 連絡先", "■ 現地確認で埋める項目", "サーバでは判定し直していません", "担当者宛", "Web診断（5段フロー）から新規の相談"]) {
      assert.ok(!tpl.includes(internal), `template must not include: ${internal}`);
    }
    // The internal part is still there, above the template.
    assert.ok(text.indexOf("■ 現地確認で埋める項目") < start);
  } finally { env.done(); }
});

test("customer mail text is unchanged by the refactor; the forward text reuses the same sections", () => {
  const s = buildDiagnosisSnapshot({ ...body("FWD2"), reductionBasis: null, subsidyCheck: CHECK });
  const c = customerMailText(s);
  assert.match(c, /^テスト 太郎 様\n\n空調更新の診断をお申し込みいただきありがとうございます。/);
  assert.match(c, /担当者より改めてご連絡いたします。お急ぎの場合は、この受付番号をお伝えください。\n\n株式会社EHCソリューションズ$/);
  const f = forwardMailText(s, { name: "株式会社EHCソリューションズ", address: "住所", tel: "03-5937-4340", hours: "平日 12:00〜17:00" });
  const core = c.slice(c.indexOf("受付番号:"), c.indexOf("\n\n担当者より改めて"));
  assert.ok(f.includes(core), "same sections as the customer mail");
  assert.equal(customerMailSubject(s), "【受付番号 EHC-20260925-120000-FWD2】空調更新の診断結果と概算見積（株式会社EHCソリューションズ）");
});

test("send mode: no forwarding template (the customer gets the mail directly)", async () => {
  const env = setup("send", null);
  try {
    await post(body("FWD3"));
    const staff = sent.find((m) => Array.isArray(m.to));
    assert.ok(staff);
    assert.ok(!staff.text.includes("転送用の文面"));
  } finally { env.done(); }
});
