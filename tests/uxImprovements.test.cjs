// v1 / 2026-09-25 / UXレビューの反映 — 金額の一本化・年間kWhの推計・旧シミュレーターの出し分け。
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
const { matchSubsidies } = loadTs("lib/match.ts");
const { COMPANY } = loadTs("lib/company.ts");

const baseInput = (over = {}) => ({
  bizType: "business", size: "sme", pref: "東京都", building: "office",
  equipGroups: [{ id: "g1", refri: "unknown", equip: "ac", installYear: 2012, units: 3, hp: 5 }],
  kwhMode: "auto", kwh: 80000, invest: 500,
  customerCompany: "", customerContact: "", customerEmail: "", customerPhone: "", customerAddress: "",
  ehcStaff: "", customerKind: "company", entityType: "corporation", updatePlan: "planned", desiredTiming: "within_6m",
  ...over,
});

test("概算が出せるときは、既定で概算（税抜小計）を補助額の計算に使う", () => {
  const input = baseInput();
  const expected = estimateUpdateBreakdownGroups([{ units: 3, hp: 5 }]).subtotal;
  assert.equal(estimateSubtotalYenOf(input), expected);
  const choice = resolveInvestChoice(input, "estimate");
  assert.equal(choice.source, "estimate");
  assert.equal(choice.answerManYen, 500);
  assert.equal(choice.differs, true);
  const applied = applyInvestChoice(input, choice);
  assert.equal(applied.invest, expected / 10000);
  assert.equal(applied.investQuoted, false);
  assert.equal(input.invest, 500, "元の input は変えない");
});

test("「お答えの金額で計算」を選ぶと、7問目の金額を使う", () => {
  const choice = resolveInvestChoice(baseInput(), "answer");
  assert.equal(choice.source, "answer");
  assert.equal(applyInvestChoice(baseInput(), choice).invest, 500);
});

test("馬力が無く概算を出せないときは、7問目の金額へ落ちる。どちらも無ければ未算定（0）", () => {
  const noHp = baseInput({ equipGroups: [{ id: "g1", refri: "unknown", equip: "ac", installYear: 2012, units: 3 }] });
  const c1 = resolveInvestChoice(noHp, "estimate");
  assert.equal(c1.estimateSubtotalYen, null);
  assert.equal(c1.source, "answer");
  assert.equal(c1.differs, false);
  const none = { ...noHp, invest: 0 };
  const c2 = resolveInvestChoice(none, "estimate");
  assert.equal(c2.source, null);
  assert.equal(applyInvestChoice(none, c2).invest, 0);
});

test("7問目が未回答でも、概算があれば概算で計算する（選択肢は出さない）", () => {
  const c = resolveInvestChoice(baseInput({ invest: 0 }), "estimate");
  assert.equal(c.source, "estimate");
  assert.equal(c.differs, false);
});

test("年間kWhは設備（台数×馬力）と建物用途から推計し、旧シミュレーターの初期値 80,000kWh を使わない", () => {
  const { input, energy } = applyEquipmentEnergy(baseInput());
  const expected = 3 * 5 * kwhPerHpYear("office");
  assert.equal(energy.source, "equipment_estimate");
  assert.equal(energy.annualKwh, expected);
  assert.equal(input.kwh, expected);
  assert.equal(input.kwhMode, "auto");
  const r = matchSubsidies(input);
  assert.equal(r.totalKwh, Math.round(expected));
  assert.ok(r.totalKwh < 80000);
});

test("馬力が未入力の設備があるときは推計せず、kWh は不明（0）として扱う", () => {
  const two = baseInput({ equipGroups: [
    { id: "g1", refri: "unknown", equip: "ac", installYear: 2012, units: 3, hp: 5 },
    { id: "g2", refri: "unknown", equip: "multi", installYear: 2010, units: 2 },
  ] });
  const { input, energy } = applyEquipmentEnergy(two);
  assert.equal(energy.source, "unknown");
  assert.equal(energy.annualKwh, null);
  assert.equal(input.kwh, 0);
  const r = matchSubsidies(input);
  assert.equal(r.co2ReductionTon, null, "kWh が不明なら CO2 は算定しない（0t と言わない）");
});

test("旧シミュレーターは ?staff=1 と共有リンク（?d=）のときだけ出す", () => {
  assert.deepEqual(legacyAccessFromSearch(""), { staff: false, sharedLink: false, showLegacy: false });
  assert.deepEqual(legacyAccessFromSearch("?staff=1"), { staff: true, sharedLink: false, showLegacy: true });
  assert.deepEqual(legacyAccessFromSearch("?staff=0"), { staff: false, sharedLink: false, showLegacy: false });
  assert.deepEqual(legacyAccessFromSearch("?d=abc"), { staff: false, sharedLink: true, showLegacy: true });
  assert.deepEqual(legacyAccessFromSearch("?d="), { staff: false, sharedLink: false, showLegacy: false });
});

test("運営会社の表示情報がそろっている", () => {
  assert.equal(COMPANY.name, "株式会社EHCソリューションズ");
  assert.match(COMPANY.tel, /^0\d{1,3}-\d{2,4}-\d{4}$/);
  assert.equal(COMPANY.telHref, `tel:${COMPANY.tel.replace(/-/g, "")}`);
  assert.match(COMPANY.email, /@ehcjpn\.com$/);
});
