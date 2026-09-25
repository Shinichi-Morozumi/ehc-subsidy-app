// v1 / 2026-09-25 / 電気料金の明細（任意）で、年間の電気代削減を実際の単価で計算し直す。
// 使い道は2つだけ: 単価（請求額÷使用量・10〜80円/kWh）と、空調の推計の上限（明細の年間使用量）。
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

const { readEnergyBill, applyEquipmentEnergy, parseBillNumber, EMPTY_ENERGY_BILL } = loadTs("lib/diagnosisEnergy.ts");
const { matchSubsidies } = loadTs("lib/match.ts");
const { ELECTRIC_PRICE_YEN_PER_KWH, estimateAnnualKwhFromGroups } = loadTs("lib/pricing.ts");
const { normalizeEnergyBill, energyBillLine, buildDiagnosisSnapshot, staffMailText, customerMailText } = loadTs("lib/diagnosisSnapshot.ts");
const { buildDiagnosisLead } = loadTs("lib/diagnosisLead.ts");
const { newDiagnosisState } = loadTs("lib/diagnosisState.ts");

const baseInput = (over = {}) => ({
  bizType: "business", size: "sme", pref: "東京都", building: "office",
  equipGroups: [{ id: "g1", refri: "unknown", equip: "ac", installYear: 2012, units: 3, hp: 5 }],
  kwhMode: "auto", kwh: 80000, invest: 190,
  customerCompany: "", customerContact: "", customerEmail: "", customerPhone: "", customerAddress: "",
  ehcStaff: "", customerKind: "company", entityType: "corporation", updatePlan: "planned", desiredTiming: "within_6m",
  ...over,
});

test("the new state starts with an empty bill (nothing is assumed)", () => {
  assert.deepEqual(newDiagnosisState().energyBill, { period: "month", kwh: null, yen: null });
  assert.deepEqual(EMPTY_ENERGY_BILL, { period: "month", kwh: null, yen: null });
});

test("readEnergyBill: price, annualised kWh, and why a value is not used", () => {
  const month = readEnergyBill({ period: "month", kwh: 1200, yen: 38000 });
  assert.equal(month.annualKwh, 14400);
  assert.ok(Math.abs(month.priceYenPerKwh - 38000 / 1200) < 1e-9);
  assert.equal(month.note, null);
  const year = readEnergyBill({ period: "year", kwh: 15000, yen: 450000 });
  assert.equal(year.annualKwh, 15000);
  assert.equal(year.priceYenPerKwh, 30);
  // Thousand-yen typing (38 instead of 38,000) -> 0.03 yen/kWh: not used, with the reason.
  const typo = readEnergyBill({ period: "month", kwh: 1200, yen: 38 });
  assert.equal(typo.priceYenPerKwh, null);
  assert.equal(typo.note.kind, "warn");
  assert.match(typo.note.text, /範囲（10〜80円\/kWh）を外れている/);
  const hintYen = readEnergyBill({ period: "month", kwh: 1200, yen: null });
  assert.equal(hintYen.note.kind, "hint");
  assert.equal(hintYen.annualKwh, 14400);
  const hintKwh = readEnergyBill({ period: "month", kwh: null, yen: 38000 });
  assert.equal(hintKwh.annualKwh, null);
  assert.equal(hintKwh.note.kind, "hint");
  assert.equal(readEnergyBill(EMPTY_ENERGY_BILL).entered, false);
  assert.equal(readEnergyBill(null).entered, false);
});

test("applyEquipmentEnergy: without a bill nothing changes (estimate price, equipment kWh)", () => {
  const expected = estimateAnnualKwhFromGroups([{ units: 3, hp: 5 }], "office");
  const { input, energy } = applyEquipmentEnergy(baseInput());
  assert.equal(energy.source, "equipment_estimate");
  assert.equal(energy.annualKwh, expected);
  assert.equal(energy.priceSource, "estimate");
  assert.equal(energy.priceYenPerKwh, ELECTRIC_PRICE_YEN_PER_KWH);
  assert.equal(energy.cappedByBill, false);
  assert.equal(input.kwh, expected);
  assert.equal(input.electricPriceYenPerKwh, undefined);
});

test("applyEquipmentEnergy: the bill's price is used, and the bill caps the air-conditioning estimate", () => {
  const equip = estimateAnnualKwhFromGroups([{ units: 3, hp: 5 }], "office");
  // A bill larger than the estimate: price only, no cap.
  const big = applyEquipmentEnergy(baseInput(), { period: "year", kwh: equip * 3, yen: equip * 3 * 31 });
  assert.equal(big.energy.priceSource, "bill");
  assert.equal(big.energy.priceYenPerKwh, 31);
  assert.equal(big.energy.cappedByBill, false);
  assert.equal(big.input.kwh, equip, "the building total never replaces the air-conditioning estimate");
  assert.equal(big.input.electricPriceYenPerKwh, 31);
  // A bill smaller than the estimate: capped to the bill.
  const small = applyEquipmentEnergy(baseInput(), { period: "month", kwh: 500, yen: 15000 });
  assert.equal(small.energy.cappedByBill, true);
  assert.equal(small.energy.billAnnualKwh, 6000);
  assert.equal(small.energy.equipmentAnnualKwh, equip);
  assert.equal(small.input.kwh, 6000);
  // Out-of-range price: not used, but the kWh cap still applies.
  const typo = applyEquipmentEnergy(baseInput(), { period: "month", kwh: 500, yen: 15 });
  assert.equal(typo.energy.priceSource, "estimate");
  assert.equal(typo.input.electricPriceYenPerKwh, undefined);
  assert.equal(typo.energy.cappedByBill, true);
  // Unknown equipment (horsepower missing): still unknown; the bill does not invent a number.
  const unknown = applyEquipmentEnergy(baseInput({ equipGroups: [{ id: "g1", refri: "unknown", equip: "ac", installYear: 2012, units: 3 }] }), { period: "month", kwh: 1200, yen: 38000 });
  assert.equal(unknown.energy.source, "unknown");
  assert.equal(unknown.input.kwh, 0);
});

test("matchSubsidies: the yen saving follows the bill's price; kWh and CO2 do not", () => {
  const plain = matchSubsidies(applyEquipmentEnergy(baseInput()).input);
  const billed = matchSubsidies(applyEquipmentEnergy(baseInput(), { period: "year", kwh: 999999, yen: 999999 * 40 }).input);
  assert.equal(billed.totalKwh, plain.totalKwh);
  assert.equal(billed.co2ReductionTon, plain.co2ReductionTon);
  const ratio = billed.saveYenPerYear / plain.saveYenPerYear;
  assert.ok(Math.abs(ratio - 40 / ELECTRIC_PRICE_YEN_PER_KWH) < 0.01, `ratio ${ratio}`);
});

test("parseBillNumber: reads what people type from a bill", () => {
  assert.deepEqual(parseBillNumber("1,200"), { value: 1200, error: null });
  assert.deepEqual(parseBillNumber("１，２００"), { value: 1200, error: null });
  assert.deepEqual(parseBillNumber("38,000円"), { value: 38000, error: null });
  assert.deepEqual(parseBillNumber("¥38000"), { value: 38000, error: null });
  assert.deepEqual(parseBillNumber("1200 kWh"), { value: 1200, error: null });
  assert.deepEqual(parseBillNumber("1234.5"), { value: 1234.5, error: null });
  assert.deepEqual(parseBillNumber(""), { value: null, error: null });
  assert.equal(parseBillNumber("約1200").value, null);
  assert.ok(parseBillNumber("約1200").error);
  assert.ok(parseBillNumber("0").error);
});

test("inquiry: the bill reaches the staff mail and the Notion memo; the price is recomputed on the server", () => {
  assert.equal(normalizeEnergyBill(null), null);
  assert.equal(normalizeEnergyBill({ period: "month", kwh: null, yen: null }), null);
  assert.equal(normalizeEnergyBill({ period: "weekly", kwh: 1, yen: 1 }), null);
  const n = normalizeEnergyBill({ period: "month", kwh: 1200, yen: 38000, priceYenPerKwh: 999 });
  assert.ok(Math.abs(n.priceYenPerKwh - 31.666) < 0.01, "the client's price is ignored");
  assert.equal(normalizeEnergyBill({ period: "month", kwh: -5, yen: "38000" }), null);
  assert.equal(energyBillLine(n), "1か月分　使用量 1,200kWh／請求額 ¥38,000（単価 約31.7円/kWh・画面の削減額はこの単価で計算）");
  const src = {
    receiptNo: "EHC-20260925-140000-BIL1", issuedAtJst: "2026/09/25 14:00",
    contact: { name: "明細 太郎", email: "a@example.invalid", company: null, phone: null },
    equipGroups: [{ id: "g1", refri: "unknown", equip: "ac", installYear: 2012, units: 3, hp: 5 }],
    unpriced: [], customerBudgetYen: null, desiredTiming: null, reductionBasis: null, energyBill: n,
  };
  const s = buildDiagnosisSnapshot(src);
  assert.match(staffMailText(s), /■ 電気料金の明細（お客様の任意入力）\n　1か月分　使用量 1,200kWh／請求額 ¥38,000/);
  assert.ok(!customerMailText(s).includes("電気料金の明細"), "not repeated back to the customer");
  assert.match(buildDiagnosisLead(s).memo, /電気料金の明細: 1か月分　使用量 1,200kWh/);
  const none = buildDiagnosisSnapshot({ ...src, energyBill: null });
  assert.ok(!staffMailText(none).includes("電気料金の明細"));
});
