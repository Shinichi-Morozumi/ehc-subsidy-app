// v1 / 2026-09-25 / 適合チェック（お客様ご自身での確認）と、問い合わせに載せる要約。
// 実モジュールをメモリ上で読む（式を複製しない）。
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

const { resolveInvestChoice, applyInvestChoice, estimateSubtotalYenOf } = loadTs("lib/amountBasis.ts");
const { applyEquipmentEnergy } = loadTs("lib/diagnosisEnergy.ts");
const { legacyAccessFromSearch } = loadTs("lib/legacyAccess.ts");
const { estimateUpdateBreakdownGroups, kwhPerHpYear } = loadTs("lib/pricing.ts");

const { checkEligibility, assessFit } = loadTs("lib/eligibility.ts");
const { getSubsidies } = loadTs("lib/subsidies.ts");
const { evaluateSelfCheck, selfCheckKeysFor, ehcCheckItemsFor } = loadTs("lib/selfCheck.ts");
const { normalizeSubsidyCheck, subsidyCheckLines, buildDiagnosisSnapshot, staffMailText } = loadTs("lib/diagnosisSnapshot.ts");
const { clientFileName } = loadTs("lib/diagnosisPdf.ts");

const NOW = new Date("2026-08-21T10:00:00+09:00"); // SII 3次公募の受付中
const sii = getSubsidies(NOW).find((s) => s.id === "sii_iv");
const base = (over = {}) => ({
  bizType: "business", size: "sme", pref: "東京都", building: "office",
  equipGroups: [{ id: "g1", refri: "unknown", equip: "ac", installYear: 2012, units: 3, hp: 5 }],
  kwhMode: "auto", kwh: 14662.5, invest: 190,
  customerCompany: "", customerContact: "", customerEmail: "", customerPhone: "", customerAddress: "",
  ehcStaff: "", customerKind: "company", entityType: "corporation", updatePlan: "planned", desiredTiming: "within_6m",
  ...over,
});
const elig = (input) => checkEligibility(sii, input, { co2ReductionTon: 2.5, now: NOW });

test("SII: ポータル登録・規模の書類・契約の未回答は、必須要件の未確認に残る", () => {
  const r = elig(base());
  assert.ok(r.requiredUnconfirmed.some((t) => t.includes("補助事業ポータル")));
  assert.ok(r.requiredUnconfirmed.some((t) => t.includes("企業規模の裏付け")));
  assert.ok(r.requiredUnconfirmed.some((t) => t.includes("契約・発注・着工の状況が未回答")));
});

test("SII: 「登録している」「書類で示せる」「まだ契約していない」と答えると、その3件は未確認から外れる（型番は残る）", () => {
  const r = elig(base({ siiPortal: "yes", sizeDocs: "yes", contractStatus: "not_yet" }));
  assert.ok(!r.requiredUnconfirmed.some((t) => t.includes("補助事業ポータル")));
  assert.ok(!r.requiredUnconfirmed.some((t) => t.includes("企業規模")));
  assert.ok(!r.requiredUnconfirmed.some((t) => t.includes("契約・発注・着工の状況")));
  assert.ok(r.confirmations.some((t) => t.includes("登録済みとのご回答")));
  assert.ok(r.requiredUnconfirmed.some((t) => t.includes("対象製品")), "型番の照合は EHC の確認として残る");
  const fit = assessFit(sii, base({ siiPortal: "yes", sizeDocs: "yes", contractStatus: "not_yet" }), r);
  assert.notEqual(fit.level, "high", "自己申告だけで「使える見込みが高い」にはならない");
});

test("SII: 「未登録」「書類で示せない」は、理由を書き換えて未確認に残す", () => {
  const r = elig(base({ siiPortal: "no", sizeDocs: "no" }));
  assert.ok(r.requiredUnconfirmed.some((t) => t.includes("未登録とのご回答")));
  assert.ok(r.requiredUnconfirmed.some((t) => t.includes("書類で示せないとのご回答")));
});

test("問いは設備の制度だけ。SII にはポータルの問いを足す", () => {
  assert.deepEqual(selfCheckKeysFor(sii), ["contract", "sizeDocs", "siiPortal"]);
  const tokyo = getSubsidies(NOW).find((s) => s.id === "tokyo_zeroemi");
  assert.deepEqual(selfCheckKeysFor(tokyo), ["contract", "sizeDocs"]);
  const info = getSubsidies(NOW).find((s) => s.infoOnly);
  if (info) assert.deepEqual(selfCheckKeysFor(info), []);
  assert.ok(ehcCheckItemsFor(sii).some((t) => t.includes("省エネ量")));
});

const answers = (over = {}) => ({ contract: null, sizeDocs: null, siiPortal: null, ...over });
const ev = (over = {}, fitLevel = "possible", prepVerdict = "tight") =>
  evaluateSelfCheck({ subsidy: sii, fitLevel, fitWhy: ["理由"], answers: answers(over), prepVerdict });

test("結果：未回答なら「あと3点」", () => {
  const r = ev();
  assert.equal(r.outcome, "todo");
  assert.equal(r.remaining, 3);
  assert.equal(r.started, false);
});

test("結果：契約済みは「対象外になる可能性が高い」", () => {
  const r = ev({ contract: "contracted", sizeDocs: "yes", siiPortal: "yes" });
  assert.equal(r.outcome, "warn");
});

test("結果：ポータルだけ未登録なら、登録が必要と1行で言う", () => {
  const r = ev({ contract: "not_yet", sizeDocs: "yes", siiPortal: "no" });
  assert.equal(r.outcome, "todo");
  assert.match(r.headline, /補助事業ポータルへの登録が必要/);
});

test("結果：全部そろえば「満たしています」、締切に間に合わなければ次回へ", () => {
  assert.equal(ev({ contract: "quoting", sizeDocs: "yes", siiPortal: "yes" }).outcome, "ok");
  assert.equal(ev({ contract: "quoting", sizeDocs: "yes", siiPortal: "yes" }, "possible", "short").outcome, "next_round");
  assert.equal(ev({ contract: "quoting", sizeDocs: "yes", siiPortal: "yes" }, "not_possible").outcome, "ng");
  assert.equal(ev({ contract: "quoting", sizeDocs: "yes", siiPortal: "yes" }, "on_hold").outcome, "wait");
});

test("問い合わせの要約：切り詰めと本文の行", () => {
  const long = "あ".repeat(500);
  const c = normalizeSubsidyCheck({
    answers: [{ question: "この工事の契約・発注は、まだですか？", answer: "まだ契約・発注していない" }],
    programs: [{ name: "SII 省エネ・非化石転換補助金（設備単位型）", group: "今回の公募で進められる", fit: "条件次第", timing: long, amount: "最大 約63.4万円", selfCheck: "ご自身で確かめられる条件は、満たしています", ehcItems: ["型番の照合"] }, { name: "" }],
  });
  assert.equal(c.programs.length, 1, "名前の無い行は捨てる");
  assert.equal(c.programs[0].timing.length, 200);
  const lines = subsidyCheckLines(c).join("\n");
  assert.match(lines, /適合チェック: ご自身で確かめられる条件は、満たしています/);
  assert.match(lines, /この工事の契約・発注は、まだですか？ → まだ契約・発注していない/);
  assert.equal(normalizeSubsidyCheck("x"), null);
  assert.equal(normalizeSubsidyCheck({ answers: [], programs: [] }), null);
});

test("担当者宛の本文に、補助金の候補と適合チェックの節が入る", () => {
  const snap = buildDiagnosisSnapshot({
    receiptNo: "EHC-20260925-120000-TEST", issuedAtJst: "2026/09/25 12:00",
    contact: { name: "テスト", email: "t@example.invalid", company: null, phone: null },
    equipGroups: [], unpriced: [], customerBudgetYen: null, desiredTiming: null, reductionBasis: null,
    subsidyCheck: normalizeSubsidyCheck({ answers: [{ question: "Q", answer: "A" }], programs: [{ name: "制度X", group: "g", fit: "f", timing: "t", amount: null, selfCheck: "結果", ehcItems: [] }] }),
  });
  const text = staffMailText(snap);
  assert.match(text, /■ 補助金の候補と適合チェック（お客様の画面に表示した内容/);
  assert.match(text, /制度X/);
  const none = staffMailText(buildDiagnosisSnapshot({
    receiptNo: "EHC-20260925-120000-TES2", issuedAtJst: "x", contact: { name: "n", email: "e@example.invalid", company: null, phone: null },
    equipGroups: [], unpriced: [], customerBudgetYen: null, desiredTiming: null, reductionBasis: null,
  }));
  assert.match(none, /この送信には含まれていません/);
});

test("PDFのファイル名にお客様名が入る（使えない文字は置き換え）", () => {
  assert.equal(clientFileName("EHC-1", "株式会社テスト/東京 支店"), "補助金省エネ診断書_株式会社テスト_東京支店様_EHC-1.pdf");
  assert.equal(clientFileName("EHC-1", null), "補助金省エネ診断書_EHC-1.pdf");
});
