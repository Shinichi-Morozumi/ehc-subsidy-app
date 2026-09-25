// v1 / 2026-09-25 / EHC-0043 — DIAGNOSIS_MAIL_MODE の3つの運用（dry_run / staff / send）と連続送信の制限。
// nodemailer は記録するだけの偽物に差し替える。実メールは1通も出ない。
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
const { resetSubmitRateLimit, SUBMIT_RATE_MAX } = loadTs("lib/submitRateLimit.ts");

const { jsPDF } = require("jspdf");
const doc = new jsPDF(); doc.text("Test-only attachment", 10, 10);
const PDF = doc.output("datauristring");

function body(seq = "TEST") {
  const input = { contact: { name: "Test", email: "customer@example.invalid", company: null, phone: null },
    equipGroups: [], unpriced: [], customerBudgetYen: null, desiredTiming: null };
  const snapshot = buildDiagnosisSnapshot({ ...input, receiptNo: `EHC-20260925-120000-${seq}`, issuedAtJst: "2026-09-25", reductionBasis: null });
  return { ...input, receiptNo: snapshot.receiptNo, issuedAtJst: snapshot.issuedAtJst,
    contentFingerprint: diagnosisFingerprint({ kind: "diagnosis", caseKey: input.contact.email, content: diagnosisContentForId(input) }),
    estimateDigest: estimateDigest(snapshot.estimate), clientTotal: null, pdfBase64: PDF, filename: "test.pdf" };
}
async function post(value, ip = "203.0.113.10") {
  return POST(new Request("http://localhost/api/diagnosis-submit", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(value) }));
}
function setup(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehc-mailmode-test-"));
  process.env.EHC_TARGET_PRODUCT_DIR = dir;
  if (mode) process.env.DIAGNOSIS_MAIL_MODE = mode; else delete process.env.DIAGNOSIS_MAIL_MODE;
  process.env.SMTP_USER = "sender@example.invalid";
  process.env.SMTP_PASS = "test-only-not-a-secret";
  resetSubmitLedger(); resetSubmitRateLimit(); sent.length = 0;
  const oldInfo = console.info, oldWarn = console.warn; console.info = () => {}; console.warn = () => {};
  return () => {
    console.info = oldInfo; console.warn = oldWarn;
    fs.rmSync(dir, { recursive: true, force: true });
    for (const k of ["EHC_TARGET_PRODUCT_DIR", "DIAGNOSIS_MAIL_MODE", "SMTP_USER", "SMTP_PASS"]) delete process.env[k];
  };
}

test("mail mode unset: dry run, nothing is sent", async () => {
  const done = setup(null);
  try {
    const res = await post(body("DRY1"));
    const r = await res.json();
    assert.equal(res.status, 200);
    assert.equal(r.mode, "dry_run");
    assert.equal(r.customerMail, "dry_run");
    assert.equal(r.customer, "dry_run");
    assert.equal(r.staff, "dry_run");
    assert.equal(sent.length, 0);
  } finally { done(); }
});

test("staff mode: only the staff mail is sent, never the customer", async () => {
  const done = setup("staff");
  try {
    const res = await post(body("STF1"));
    const r = await res.json();
    assert.equal(res.status, 200);
    assert.equal(r.ok, true);
    assert.equal(r.mode, "send");
    assert.equal(r.customerMail, "off");
    assert.equal(r.customer, "skipped");
    assert.equal(r.staff, "sent");
    assert.equal(r.pdf, "ok");
    assert.equal(sent.length, 1);
    const m = sent[0];
    assert.deepEqual(m.to, ["info@ehcjpn.com"]);
    assert.deepEqual(m.cc, ["info@project-neo.co.jp"]);
    assert.equal(m.replyTo, "customer@example.invalid");
    assert.ok(Array.isArray(m.attachments) && m.attachments.length === 1, "staff mail carries the PDF");
    for (const s of sent) {
      const rcpt = [].concat(s.to || [], s.cc || [], s.bcc || []).join(",");
      assert.ok(!rcpt.includes("customer@example.invalid"), "customer address must never be a recipient");
    }
  } finally { done(); }
});

test("staff mode: pressing again does not send the staff mail twice", async () => {
  const done = setup("staff");
  try {
    const first = await (await post(body("STF2"))).json();
    assert.equal(first.staff, "sent");
    const second = await post(body("STF2"));
    const r = await second.json();
    assert.equal(second.status, 200);
    assert.equal(r.duplicate, true);
    assert.equal(r.staff, "already_sent");
    assert.equal(r.customer, "skipped");
    assert.equal(r.customerMail, "off");
    assert.equal(sent.length, 1);
  } finally { done(); }
});

test("send mode: customer and staff each get one mail (existing behaviour)", async () => {
  const done = setup("send");
  try {
    const r = await (await post(body("SND1"))).json();
    assert.equal(r.customerMail, "on");
    assert.equal(r.customer, "sent");
    assert.equal(r.staff, "sent");
    assert.equal(sent.length, 2);
    assert.equal(sent[0].to, "customer@example.invalid");
  } finally { done(); }
});

test("rate limit: after the limit from one address, no mail and 429", async () => {
  const done = setup("staff");
  try {
    for (let i = 0; i < SUBMIT_RATE_MAX; i++) {
      const res = await post(body(`RL${String(i).padStart(2, "0")}`), "198.51.100.7");
      assert.equal(res.status, 200, `request ${i + 1} is accepted`);
    }
    const before = sent.length;
    const blocked = await post(body("RLXX"), "198.51.100.7");
    const r = await blocked.json();
    assert.equal(blocked.status, 429);
    assert.equal(r.rateLimited, true);
    assert.equal(r.ok, false);
    assert.equal(sent.length, before, "blocked request sends nothing");
    const other = await post(body("RLYY"), "198.51.100.8");
    assert.equal(other.status, 200, "another address is not blocked");
  } finally { done(); }
});

test("rate limit does not apply in dry run", async () => {
  const done = setup(null);
  try {
    for (let i = 0; i < SUBMIT_RATE_MAX + 2; i++) {
      const res = await post(body(`DR${String(i).padStart(2, "0")}`), "192.0.2.5");
      assert.equal(res.status, 200);
    }
    assert.equal(sent.length, 0);
  } finally { done(); }
});
