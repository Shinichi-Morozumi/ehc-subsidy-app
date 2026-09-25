/* v1 / 2026-09-17 / EHC-0043 不足入力の安全性・既存計算口との整合。
   Run: node --test components/estimateInputFields.test.cjs
   実モジュールをメモリ上で読む。金額の式を複製せず、ブラウザ操作やPDF描画の証拠とはしない。 */
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

const { missingEstimateInputs, parseEstimateNumber, applyEstimateGroupPatches } = loadTs("components/estimateInputFields.ts");
const { newDiagnosisState } = loadTs("lib/diagnosisState.ts");
const { projectEquipGroups, toMatchInput, UNRESOLVED_REASON_LABEL } = loadTs("lib/diagnosisProjection.ts");
const { pricedGroupsOf, buildDiagnosisSnapshot } = loadTs("lib/diagnosisSnapshot.ts");
const { estimateUpdateBreakdownGroups } = loadTs("lib/pricing.ts");
const { buildConstructionTimeline } = loadTs("lib/timeline.ts");

const CURRENT_YEAR = 2026; // 固定の検証時計。実画面は実行時の年を渡す。
function group(id, values = {}) {
  return { id, kind: "ac", units: 2, installYear: 2010, hp: null, maker: null,
    modelSet: null, modelIndoor: null, modelOutdoor: null, ...values };
}
function state(groups, values = {}) {
  return { groups, plannedUnits: [], customerBudgetYen: null, desiredTiming: null, contractStatus: null, ...values };
}
function missing(groups) {
  return missingEstimateInputs(groups, projectEquipGroups(state(groups)));
}
function snapshot(input, projection, diagnosis = state([])) {
  return buildDiagnosisSnapshot({
    receiptNo: "TEST-ONLY", issuedAtJst: "2026-09-17 12:00 JST",
    contact: { name: "テスト", email: "test@example.invalid", company: null, phone: null },
    equipGroups: input?.equipGroups ?? [],
    unpriced: projection.unresolvedGroups.map(({ group: item, reasons }) => ({
      label: item.id, reason: reasons.map(reason => UNRESOLVED_REASON_LABEL[reason]).join("・"),
    })),
    customerBudgetYen: diagnosis.customerBudgetYen, desiredTiming: diagnosis.desiredTiming, reductionBasis: null,
  });
}

test("未回答の初期状態に種類・台数・設置年・馬力や金額を補わない", () => {
  const initial = newDiagnosisState();
  const original = structuredClone(initial);
  const { input, projection } = toMatchInput(initial, { equipGroups: [] });
  assert.deepEqual(missingEstimateInputs(initial.groups, projection), []);
  assert.equal(input, null);
  assert.equal(projection.canCompute, false);
  assert.deepEqual(initial, original);
  for (const field of ["kind", "units", "installYear", "hp"]) assert.equal(initial.groups[0][field], null);
  const result = snapshot(input, projection);
  assert.equal(result.estimate, null);
  assert.equal(result.workDays, null);
  assert.equal(result.pricedUnits, 0);
});

test("業務用で数字がすべて未回答なら3項目を示すだけで原本を変えない", () => {
  const groups = [group("a", { units: null, installYear: null })];
  const original = structuredClone(groups);
  assert.deepEqual(missing(groups).map(item => ({ id: item.group.id, index: item.index, fields: item.fields })), [
    { id: "a", index: 0, fields: ["units", "installYear", "hp"] },
  ]);
  assert.deepEqual(groups, original);
});

test("空欄・空白は全数値項目でnullのまま、0や既定値にしない", () => {
  for (const field of ["units", "installYear", "hp"]) {
    for (const raw of ["", " ", "\t\n"]) assert.deepEqual(parseEstimateNumber(field, raw, CURRENT_YEAR), { value: null });
  }
});

test("HPの0・負値・非有限・非数値はエラーとなり、正の小数は丸めない", () => {
  for (const raw of ["0", "-0", "-1", "-2.5", "NaN", "Infinity", "-Infinity", "1e309", "abc"]) {
    const parsed = parseEstimateNumber("hp", raw, CURRENT_YEAR);
    assert.equal(parsed.value, null, raw);
    assert.ok(parsed.error, raw);
  }
  for (const [raw, expected] of [["2.5", 2.5], [" 12 ", 12], ["3.25", 3.25]]) {
    assert.deepEqual(parseEstimateNumber("hp", raw, CURRENT_YEAR), { value: expected });
  }
});

test("台数は正整数、設置年は1970年から渡された現在年まで", () => {
  assert.deepEqual(parseEstimateNumber("units", "1", CURRENT_YEAR), { value: 1 });
  for (const raw of ["0", "-1", "1.5", "Infinity"]) assert.ok(parseEstimateNumber("units", raw, CURRENT_YEAR).error, raw);
  for (const raw of ["1970", String(CURRENT_YEAR)]) assert.deepEqual(parseEstimateNumber("installYear", raw, CURRENT_YEAR), { value: Number(raw) });
  for (const raw of ["1969", String(CURRENT_YEAR + 1), "2010.5", "0"]) assert.ok(parseEstimateNumber("installYear", raw, CURRENT_YEAR).error, raw);
});

test("不足している数値だけを示し、入力済みHPや設備の順序を守る", () => {
  const groups = [group("hp-only"), group("units-only", { kind: "multi", units: null, hp: 3 }), group("complete", { hp: 4 })];
  assert.deepEqual(missing(groups).map(item => [item.group.id, item.index, item.fields]), [
    ["hp-only", 0, ["hp"]], ["units-only", 1, ["units"]],
  ]);
});

test("別段から来たHPの0・負値・非有限も概算には含めない", () => {
  const groups = [0, -1, NaN, Infinity].map((hp, i) => group(`invalid-${i}`, { hp }));
  const projection = projectEquipGroups(state(groups));
  assert.equal(projection.equipGroups.length, groups.length);
  assert.ok(projection.equipGroups.every(item => item.hp === undefined));
  assert.deepEqual(pricedGroupsOf(projection.equipGroups), []);
  assert.ok(missingEstimateInputs(groups, projection).every(item => item.fields.length === 1 && item.fields[0] === "hp"));
  assert.equal(snapshot({ equipGroups: projection.equipGroups }, projection).estimate, null);
});

test("room・種類不明・未選択は数字があっても業務用へ変換せず未算定を保つ", () => {
  const groups = [group("room", { kind: "room", hp: 3 }), group("unknown", { kind: "unknown", hp: 4 }), group("unselected", { kind: null, hp: 5 })];
  assert.deepEqual(missing(groups), []);
  const { input, projection } = toMatchInput(state(groups), { equipGroups: [] });
  assert.equal(input, null);
  assert.deepEqual(projection.equipGroups, []);
  assert.deepEqual(projection.excludedKinds, ["room", "unknown", null]);
  assert.equal(snapshot(input, projection).estimate, null);
  assert.deepEqual(groups.map(item => item.kind), ["room", "unknown", null]);
});

test("IDで反映するため並び替え後も正しい群だけ更新し、型番・メーカー等は保持", () => {
  const original = group("a", { kind: "multi", maker: "テストメーカー", modelSet: "SET-A", modelIndoor: "IN-A", modelOutdoor: "OUT-A" });
  const untouched = group("b", { hp: 4 });
  Object.freeze(original);
  Object.freeze(untouched);
  const groups = Object.freeze([untouched, original]);
  const updated = applyEstimateGroupPatches(groups, [{ id: "a", values: { hp: 3.25 } }]);
  assert.deepEqual(updated.map(item => item.id), ["b", "a"]);
  assert.strictEqual(updated[0], untouched);
  assert.notStrictEqual(updated[1], original);
  assert.deepEqual(updated[1], { ...original, hp: 3.25 });
  assert.equal(original.hp, null);
});

test("削除済みの古いIDは無視し、別群への誤反映や群の再作成をしない", () => {
  const current = group("current", { hp: 3 });
  const updated = applyEstimateGroupPatches([current], [{ id: "deleted", values: { units: 99, hp: 12 } }]);
  assert.deepEqual(updated, [current]);
  assert.strictEqual(updated[0], current);
  assert.deepEqual(applyEstimateGroupPatches([], [{ id: "deleted", values: { hp: 12 } }]), []);
});

test("2群の片方だけHPを入力し他方を空欄にすると、その片方だけ概算対象になる", () => {
  const groups = [group("answered", { units: 2 }), group("skipped", { kind: "multi", units: 8 })];
  const updated = applyEstimateGroupPatches(groups, [
    { id: "answered", values: { hp: parseEstimateNumber("hp", "12", CURRENT_YEAR).value } },
    { id: "skipped", values: { hp: parseEstimateNumber("hp", "", CURRENT_YEAR).value } },
  ]);
  const { input, projection } = toMatchInput(state(updated), { equipGroups: [] });
  assert.equal(updated[1].hp, null);
  assert.deepEqual(pricedGroupsOf(input.equipGroups).map(item => item.id), ["answered"]);
  assert.deepEqual(missing(updated).map(item => item.group.id), ["skipped"]);
  const result = snapshot(input, projection);
  assert.equal(result.pricedUnits, 2);
  assert.equal(result.estimate.units, 2);
  assert.deepEqual(groups.map(item => item.hp), [null, null]);
});

test("台数・年が未回答の群は一部だけ入力しても算定せず、揃ってから投影する", () => {
  let groups = [group("a", { units: null, installYear: null, hp: null })];
  groups = applyEstimateGroupPatches(groups, [{ id: "a", values: { units: 3, installYear: null, hp: 2.5 } }]);
  assert.equal(toMatchInput(state(groups), { equipGroups: [] }).input, null);
  assert.deepEqual(missing(groups)[0].fields, ["installYear"]);
  groups = applyEstimateGroupPatches(groups, [{ id: "a", values: { installYear: 2012 } }]);
  const { input, projection } = toMatchInput(state(groups), { equipGroups: [] });
  assert.equal(input.equipGroups[0].hp, 2.5);
  assert.equal(input.equipGroups[0].units, 3);
  assert.equal(input.equipGroups[0].installYear, 2012);
  assert.equal(projection.unresolvedGroups.length, 0);
  assert.deepEqual(missing(groups), []);
});

test("反映後の実projection→priced→概算と診断書snapshotが同じ群・金額・工期になる", () => {
  const original = state([
    group("answered", { units: 3, maker: "テストメーカー", modelSet: " SET-A ", modelIndoor: "IN-A", modelOutdoor: "OUT-A" }),
    group("skipped", { kind: "multi", units: 7 }),
    group("room", { kind: "room", units: 9, hp: 4 }),
    group("unknown", { kind: "unknown", units: 6, hp: 5 }),
  ], { desiredTiming: "within_6m", customerBudgetYen: 0, contractStatus: "quoting" });
  const base = { equipGroups: [], invest: 1234567, pref: "東京都", interest: "update" };
  const before = toMatchInput(original, base);
  const issuedBefore = snapshot(before.input, before.projection, original);
  assert.equal(issuedBefore.estimate, null);
  const updated = { ...original, groups: applyEstimateGroupPatches(original.groups, [{ id: "answered", values: { hp: 3.25 } }]) };
  const { input, projection } = toMatchInput(updated, base);
  const priced = pricedGroupsOf(input.equipGroups);
  const priceInput = priced.map(item => ({ units: item.units, hp: item.hp }));
  const estimate = estimateUpdateBreakdownGroups(priceInput);
  const result = snapshot(input, projection, updated);
  assert.deepEqual(priced.map(item => item.id), ["answered"]);
  assert.strictEqual(input.equipGroups, projection.equipGroups);
  assert.strictEqual(result.equipGroups, input.equipGroups);
  for (const field of ["machine", "work", "subtotal", "tax", "taxRate", "total", "units", "systems", "kg"]) {
    assert.equal(result.estimate[field], estimate[field], field);
  }
  assert.deepEqual(result.estimate.lines, estimate.lines.map(({ label, detail, amount }) => ({ label, detail, amount })));
  assert.equal(result.estimate.lowTotal, estimateUpdateBreakdownGroups(priceInput, { costClass: "value" }).total);
  assert.equal(result.estimate.highTotal, estimateUpdateBreakdownGroups(priceInput, { costClass: "premium" }).total);
  assert.equal(result.workDays, buildConstructionTimeline({ ...input, equipGroups: priced }, { dropinOnly: false }).workDays);
  assert.equal(result.pricedUnits, 3);
  assert.deepEqual(result.unpriced.map(item => item.label), ["room", "unknown"]);
  assert.ok(result.unpriced.every(item => item.reason.length > 0));
  assert.equal(input.equipGroups.find(item => item.id === "skipped").hp, undefined);
  assert.equal(input.equipGroups[0].models.set, "SET-A");
  assert.equal(input.equipGroups[0].maker, "テストメーカー");
  assert.equal(input.invest, base.invest); // 回答した予算や概算で制度計算の投資額を上書きしない。
  assert.equal(input.contractStatus, "quoting");
  assert.equal(result.customerBudgetYen, 0); // 確認した0はnullへ潰さない。
  assert.equal(result.desiredTiming, "within_6m");
  assert.strictEqual(updated.plannedUnits, original.plannedUnits);
  assert.equal(original.groups[0].hp, null);
  assert.equal(issuedBefore.equipGroups[0].hp, undefined);
  assert.equal(issuedBefore.estimate, null); // 以前の発行内容を後の追加入力で書き換えない。
});
