// v1 / 2026-09-25 / サーバで作る診断書PDF（lib/serverPdf.ts）と、その使いどころ。
//   ・画面のPDFが無い・壊れている・大きすぎる → 担当者宛にサーバのPDFを付けて受け付ける（画面から来たバイト列は付けない）
//   ・お客様宛（send のときだけ）→ サーバのPDFだけを付ける。名前欄のURLはお客様宛から除く
// nodemailer は記録するだけの偽物。実メールは1通も出ない。
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

const { POST } = loadTs("app/api/diagnosis-submit/route.ts");
const { buildDiagnosisSnapshot } = loadTs("lib/diagnosisSnapshot.ts");
const { diagnosisContentForId, diagnosisFingerprint, estimateDigest } = loadTs("lib/diagnosisId.ts");
const { resetSubmitLedger } = loadTs("lib/submitLedger.ts");
const { resetSubmitRateLimit } = loadTs("lib/submitRateLimit.ts");
const { buildServerDiagnosisPdf } = loadTs("lib/serverPdf.ts");
const { stripLinks, customerSafeContact } = loadTs("lib/customerSafe.ts");

const { jsPDF } = require("jspdf");
const doc = new jsPDF(); doc.text("Client-made attachment", 10, 10);
const CLIENT_PDF = doc.output("datauristring");
const CLIENT_BYTES = Buffer.from(CLIENT_PDF.slice(CLIENT_PDF.indexOf(",") + 1), "base64");
const COMPANY = { name: "株式会社EHCソリューションズ", address: "東京都中野区弥生町1丁目9-8 トーソービル4F", tel: "03-5937-4340", hours: "平日 12:00〜17:00" };

function body(seq, over = {}) {
  const input = {
    contact: { name: "髙井 﨑山", email: "customer@example.invalid", company: "テスト株式会社", phone: null },
    equipGroups: [{ id: "g1", equip: "ac", installYear: 2010, units: 4, hp: 6, refri: "unknown" }],
    unpriced: [], customerBudgetYen: null, desiredTiming: null, ...over,
  };
  const snapshot = buildDiagnosisSnapshot({ ...input, receiptNo: `EHC-20260925-130000-${seq}`, issuedAtJst: "2026/09/25 13:00", reductionBasis: null });
  return { ...input, receiptNo: snapshot.receiptNo, issuedAtJst: snapshot.issuedAtJst,
    contentFingerprint: diagnosisFingerprint({ kind: "diagnosis", caseKey: input.contact.email, content: diagnosisContentForId(input) }),
    estimateDigest: estimateDigest(snapshot.estimate), clientTotal: snapshot.estimate ? snapshot.estimate.total : null,
    pdfBase64: CLIENT_PDF, filename: "client.pdf" };
}
async function post(value, ip = "203.0.113.30") {
  return POST(new Request("http://localhost/api/diagnosis-submit", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(value) }));
}
function setup(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehc-serverpdf-test-"));
  process.env.EHC_TARGET_PRODUCT_DIR = dir;
  process.env.DIAGNOSIS_MAIL_MODE = mode;
  process.env.SMTP_USER = "sender@example.invalid";
  process.env.SMTP_PASS = "test-only-not-a-secret";
  delete process.env.NOTION_TOKEN;
  delete process.env.EHC_PDF_FONT_DIR;
  resetSubmitLedger(); resetSubmitRateLimit(); sent.length = 0;
  const old = { info: console.info, warn: console.warn, error: console.error };
  console.info = () => {}; console.warn = () => {}; console.error = () => {};
  return () => {
    Object.assign(console, old);
    fs.rmSync(dir, { recursive: true, force: true });
    for (const k of ["EHC_TARGET_PRODUCT_DIR", "DIAGNOSIS_MAIL_MODE", "SMTP_USER", "SMTP_PASS", "EHC_PDF_FONT_DIR"]) delete process.env[k];
  };
}
const isPdf = (buf) => Buffer.isBuffer(buf) && /^%PDF-1\.[0-7]/.test(buf.subarray(0, 8).toString("latin1")) && /%%EOF\s*$/.test(buf.subarray(-16).toString("latin1"));
const hasJapaneseFont = (buf) => buf.toString("latin1").includes("BIZUDPGothic") && buf.toString("latin1").includes("/FontFile2");
const staffMail = () => sent.find((m) => Array.isArray(m.to));
const customerMail = () => sent.find((m) => m.to === "customer@example.invalid");

test("buildServerDiagnosisPdf: a real A4 PDF with the Japanese font embedded", () => {
  const s = buildDiagnosisSnapshot({ ...body("PDF0"), reductionBasis: null });
  const buf = buildServerDiagnosisPdf(s, { company: COMPANY });
  assert.ok(isPdf(buf));
  assert.ok(hasJapaneseFont(buf));
  assert.ok(buf.length > 20_000 && buf.length < 3_000_000, `size ${buf.length}`);
  assert.match(buf.toString("latin1"), /\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
  // Works with nothing entered at all, too.
  const empty = buildDiagnosisSnapshot({ receiptNo: "EHC-20260925-130000-PDF1", issuedAtJst: "x", contact: { name: "A", email: "a@example.invalid", company: null, phone: null }, equipGroups: [], unpriced: [], customerBudgetYen: null, desiredTiming: null, reductionBasis: null });
  assert.ok(isPdf(buildServerDiagnosisPdf(empty, { company: COMPANY })));
});

test("staff mode: no PDF from the screen -> accepted, the staff mail carries the server PDF", async () => {
  const done = setup("staff");
  try {
    const b = body("MIS1"); b.pdfBase64 = ""; b.filename = "";
    const res = await post(b);
    const r = await res.json();
    assert.equal(res.status, 200);
    assert.equal(r.ok, true);
    assert.equal(r.pdf, "missing", "the screen's own PDF status is still reported");
    assert.equal(r.serverPdf, true);
    assert.equal(r.staff, "sent");
    assert.equal(sent.length, 1);
    const m = staffMail();
    assert.equal(m.attachments.length, 1);
    assert.ok(isPdf(m.attachments[0].content) && hasJapaneseFont(m.attachments[0].content));
    assert.match(m.attachments[0].filename, /^補助金省エネ診断書_テスト株式会社様_EHC-20260925-130000-MIS1\.pdf$/);
    assert.match(m.text, /お客様の画面では診断書PDFを用意できませんでした（画面から診断書PDFが届きませんでした）/);
    assert.match(m.text, /このPDFをお客様へお送りください/);
    assert.ok(!m.text.includes("お客様は送信直後に画面から同じPDFを保存しています"));
  } finally { done(); }
});

test("staff mode: a broken or oversized PDF from the screen is never attached; the server PDF is", async () => {
  for (const [pdfBase64, status, seq] of [
    ["data:text/html;base64,SGVsbG8=", "invalid", "BAD1"],
    [Buffer.from("%PDF-1.3\ntruncated").toString("base64"), "invalid", "BAD2"],
    ["A".repeat(14_000_004), "too_large", "BAD3"],
  ]) {
    const done = setup("staff");
    try {
      const b = body(seq); b.pdfBase64 = pdfBase64;
      const r = await (await post(b)).json();
      assert.equal(r.ok, true, status);
      assert.equal(r.pdf, status);
      assert.equal(r.serverPdf, true);
      const att = staffMail().attachments[0].content;
      assert.ok(isPdf(att) && hasJapaneseFont(att));
      assert.ok(!att.toString("latin1").includes("truncated"));
    } finally { done(); }
  }
});

test("staff mode: a good PDF from the screen is attached as it is (same file the customer saved)", async () => {
  const done = setup("staff");
  try {
    const r = await (await post(body("GOD1"))).json();
    assert.equal(r.pdf, "ok");
    assert.equal(r.serverPdf, false);
    const m = staffMail();
    assert.ok(m.attachments[0].content.equals(CLIENT_BYTES));
    assert.equal(m.attachments[0].filename, "client.pdf");
    assert.match(m.text, /お客様は送信直後に画面から同じPDFを保存しています/);
  } finally { done(); }
});

test("send mode: the customer gets only the server PDF; links in the name never reach the customer", async () => {
  const done = setup("send");
  try {
    const b = body("SND1", { contact: { name: "山田 https://evil.example/login", email: "customer@example.invalid", company: "evil.example 株式会社", phone: null } });
    const r = await (await post(b)).json();
    assert.equal(r.customer, "sent");
    assert.equal(r.staff, "sent");
    const c = customerMail();
    assert.ok(c, "customer mail was sent");
    assert.equal(c.attachments.length, 1);
    const att = c.attachments[0].content;
    assert.ok(isPdf(att) && hasJapaneseFont(att), "server-made PDF");
    assert.ok(!att.equals(CLIENT_BYTES), "the screen's PDF is never mailed to the customer");
    assert.ok(!c.text.includes("evil.example"), "no link in the customer mail");
    assert.match(c.text, /^山田 様/);
    assert.ok(!c.attachments[0].filename.includes("evil"));
    // Staff still see exactly what was typed, and get the screen's PDF.
    const s = staffMail();
    assert.ok(s.text.includes("https://evil.example/login"));
    assert.ok(s.attachments[0].content.equals(CLIENT_BYTES));
  } finally { done(); }
});

test("send mode: if the server PDF cannot be made, the customer mail is not sent (no mail without its PDF)", async () => {
  const done = setup("send");
  try {
    process.env.EHC_PDF_FONT_DIR = path.join(root, "tests", "no-such-font-dir");
    const r = await (await post(body("SND2"))).json();
    assert.equal(r.ok, true, "the staff still got the inquiry");
    assert.equal(r.customer, "failed");
    assert.equal(r.staff, "sent");
    assert.equal(customerMail(), undefined);
    assert.match(staffMail().text, /お客様宛のメールは送っていません（サーバで診断書PDFを作れなかったため）/);
    assert.ok(staffMail().attachments[0].content.equals(CLIENT_BYTES));
  } finally { done(); }
});

test("stripLinks / customerSafeContact", () => {
  assert.equal(stripLinks("株式会社サンプル商事"), "株式会社サンプル商事");
  assert.equal(stripLinks("ABC Co., Ltd."), "ABC Co., Ltd.");
  assert.equal(stripLinks("詳しくは https://evil.example/login へ"), "詳しくは へ");
  assert.equal(stripLinks("www.evil.jp を見て"), "を見て");
  assert.equal(stripLinks("山田 太郎 test@example.com"), "山田 太郎");
  assert.equal(stripLinks("foo.co.jp 太郎"), "太郎");
  assert.equal(stripLinks("<script>"), "script");
  assert.equal(stripLinks("田中　花子"), "田中　花子", "a full-width space in a name is kept");
  assert.deepEqual(customerSafeContact({ name: "https://x.example", email: "a@example.invalid", company: "evil.com", phone: null }),
    { name: "お客様", email: "a@example.invalid", company: null, phone: null });
});
