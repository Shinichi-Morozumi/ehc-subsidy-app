// v1 / 2026-09-23 / Actual POST handler tests; SMTP is replaced before module loading.
let transportCalls = 0;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const modules = new Map();
function loadTs(filename) {
  const absolute = path.resolve(root, filename);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const module = { exports: {} };
  modules.set(absolute, module);
  const nativeRequire = createRequire(absolute);
  const localRequire = (specifier) => {
    const candidate = specifier.startsWith("@/")
      ? path.resolve(root, specifier.slice(2))
      : specifier.startsWith(".") ? path.resolve(path.dirname(absolute), specifier) : null;
    if (candidate) {
      if (candidate.endsWith(".ts") && fs.existsSync(candidate)) return loadTs(candidate);
      if (fs.existsSync(`${candidate}.ts`)) return loadTs(`${candidate}.ts`);
    }
    if (specifier === "nodemailer") return { createTransport() { transportCalls++; throw new Error("Real mail is forbidden in this test"); } };
    return nativeRequire(specifier);
  };
  const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: absolute,
  }).outputText;
  vm.runInThisContext(`(function(exports, require, module, __filename, __dirname) {\n${compiled}\n})`, { filename: absolute })(
    module.exports, localRequire, module, absolute, path.dirname(absolute),
  );
  return module.exports;
}


const { POST } = loadTs("app/api/diagnosis-submit/route.ts");
const { buildDiagnosisSnapshot } = loadTs("lib/diagnosisSnapshot.ts");
const { diagnosisContentForId, diagnosisFingerprint, estimateDigest } = loadTs("lib/diagnosisId.ts");
const { resetSubmitLedger } = loadTs("lib/submitLedger.ts");
const { resetSubmitRateLimit } = loadTs("lib/submitRateLimit.ts");
function body() {
  const input = { contact: { name: "Test", email: "test@example.invalid", company: null, phone: null },
    equipGroups: [], unpriced: [], customerBudgetYen: null, desiredTiming: null };
  const snapshot = buildDiagnosisSnapshot({ ...input, receiptNo: "EHC-20260923-120000-TEST", issuedAtJst: "2026-09-23", reductionBasis: null });
  return { ...input, receiptNo: snapshot.receiptNo, issuedAtJst: snapshot.issuedAtJst,
    contentFingerprint: diagnosisFingerprint({ kind: "diagnosis", caseKey: input.contact.email, content: diagnosisContentForId(input) }),
    estimateDigest: estimateDigest(snapshot.estimate), clientTotal: null };
}
async function post(value) {
  return POST(new Request("http://localhost/api/diagnosis-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }));
}
test("non-object JSON returns 400 rather than throwing", async () => {
  for (const value of [null, [], "text", 123, true]) {
    const response = await post(value);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).ok, false);
  }
});
// 2026-09-25: a missing/invalid client PDF is now replaced by a server-made PDF (tests/diagnosisLead.test.cjs).
// When the server cannot make one either (fonts unavailable here), nothing is sent, as before.
test("missing, oversized and invalid PDF never reach mail transport (server PDF unavailable)", async () => {
  process.env.DIAGNOSIS_MAIL_MODE = "send";
  process.env.SMTP_USER = "test@example.invalid";
  process.env.SMTP_PASS = "test-only-not-a-secret";
  process.env.EHC_PDF_FONT_DIR = path.join(root, "tests", "no-such-font-dir");
  const oldError = console.error; console.error = () => {};
  try {
    for (const [pdfBase64, expectedStatus, expectedPdf] of [
      [undefined, 422, "missing"], ["", 422, "missing"],
      ["A".repeat(14_000_004), 413, "too_large"],
      ["not base64", 422, "invalid"],
      [Buffer.from("plain text").toString("base64"), 422, "invalid"],
      ["data:text/html;base64,SGVsbG8=", 422, "invalid"],
      [Buffer.from("%PDF-1.3\ntruncated").toString("base64"), 422, "invalid"],
    ]) {
      resetSubmitLedger(); resetSubmitRateLimit(); // 2026-09-25: the rate limit is now checked before the PDF
      const response = await post({ ...body(), pdfBase64 });
      const result = await response.json();
      assert.equal(response.status, expectedStatus, expectedPdf);
      assert.equal(result.pdf, expectedPdf);
      assert.equal(result.ok, false);
      assert.equal(result.customer, "skipped");
      assert.equal(result.staff, "skipped");
      assert.equal(transportCalls, 0);
    }
  } finally {
    console.error = oldError;
    delete process.env.DIAGNOSIS_MAIL_MODE; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
    delete process.env.EHC_PDF_FONT_DIR;
  }
});

test("jsPDF raw base64 and data URI still pass in dry-run without sending", async () => {
  const os = require("node:os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehc-submit-test-"));
  process.env.EHC_TARGET_PRODUCT_DIR = dir;
  process.env.DIAGNOSIS_MAIL_MODE = "dry_run";
  const { jsPDF } = require("jspdf");
  const doc = new jsPDF(); doc.text("Test-only attachment", 10, 10);
  const uri = doc.output("datauristring");
  const oldInfo = console.info; console.info = () => {};
  try {
    for (const pdfBase64 of [uri, uri.slice(uri.indexOf(",") + 1)]) {
      resetSubmitLedger();
      const response = await post({ ...body(), pdfBase64 });
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(result.mode, "dry_run");
      assert.equal(result.pdf, "ok");
      assert.equal(result.allDelivered, false);
      assert.equal(transportCalls, 0);
    }
  } finally {
    console.info = oldInfo;
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.EHC_TARGET_PRODUCT_DIR; delete process.env.DIAGNOSIS_MAIL_MODE;
  }
});
