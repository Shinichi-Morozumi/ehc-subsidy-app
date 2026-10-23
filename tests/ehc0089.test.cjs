// v1 / 2026-10-23 / EHC-0089: 外部送信・本番保存なし。fetchは必ず差し替える。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const modules = new Map();
function load(file) {
  const absolute = path.resolve(root, file);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const mod = { exports: {} }; modules.set(absolute, mod);
  const native = createRequire(absolute);
  const req = spec => {
    if (spec === "nodemailer") return { createTransport() { throw new Error("外部送信は禁止"); } };
    const local = spec.startsWith("@/") ? path.resolve(root, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(absolute), spec) : null;
    if (local && fs.existsSync(`${local}.ts`)) return load(`${local}.ts`);
    return native(spec);
  };
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(exports,require,module){${code}\n})`, { filename: absolute })(mod.exports, req, mod);
  return mod.exports;
}
const { readConsultation, consultationLines } = load("lib/consultation.ts");
const { planPdfSlices } = load("lib/pdfPagination.ts");
const { buildDiagnosisSnapshot, staffMailText, customerMailText, forwardMailText } = load("lib/diagnosisSnapshot.ts");
const { diagnosisContentForId, diagnosisFingerprint } = load("lib/diagnosisId.ts");
const { buildDiagnosisLead } = load("lib/diagnosisLead.ts");
const { createNotionTargetProductStore } = load("lib/targetProductNotionStore.ts");
const { ensureTargetProductStore, openTargetProductStore, forgetTargetProductStoreStatus } = load("lib/targetProductStore.ts");
const target = load("lib/targetProduct.ts");
const proposed = { mode: "zoom", timezone: "Asia/Tokyo", preferredDates: ["2027-02-01T10:00", "2027-02-02T11:00", "2027-02-03T12:00"] };
const now = new Date("2026-10-23T00:00:00Z");

test("候補日時: 3件・日本時間、旧画面は未受領として後方互換", () => {
  assert.deepEqual(readConsultation(proposed, now).value, proposed);
  assert.deepEqual(readConsultation(undefined, now), { value: null, error: null });
  for (const bad of [false, [], {}, { ...proposed, timezone: "UTC" }, { ...proposed, mode: "meet" },
    { ...proposed, preferredDates: ["", "", ""] }, { ...proposed, preferredDates: proposed.preferredDates.slice(0, 2) },
    { ...proposed, preferredDates: ["2027-02-30T10:00", ...proposed.preferredDates.slice(1)] },
    { ...proposed, preferredDates: ["2026-10-23T08:59", ...proposed.preferredDates.slice(1)] },
    { ...proposed, preferredDates: Array(3).fill(proposed.preferredDates[0]) }]) {
    assert.ok(readConsultation(bad, now).error, JSON.stringify(bad));
  }
});
test("候補日時: 指紋・メール・転送・CRMが同じ3件を使う", () => {
  const input = { contact: { name: "ローカルテスト・営業対象外", email: "test@example.invalid", company: null, phone: null, consultation: proposed }, equipGroups: [], unpriced: [], customerBudgetYen: null, desiredTiming: null };
  const snap = buildDiagnosisSnapshot({ ...input, receiptNo: "EHC-20261023-120000-TEST", issuedAtJst: "2026-10-23", reductionBasis: null });
  const lead = buildDiagnosisLead(snap);
  for (const text of [staffMailText(snap), customerMailText(snap), forwardMailText(snap, { name: "EHC", address: "", tel: "", hours: "" }), lead.memo]) {
    for (const date of proposed.preferredDates) assert.ok(text.includes(date.replace("T", " ")));
    assert.ok(text.includes("予約未確定")); assert.ok(!text.includes("calendar.google"));
  }
  assert.ok(lead.nextAction.includes("Zoom"));
  const fp = content => diagnosisFingerprint({ kind: "diagnosis", caseKey: input.contact.email, content: diagnosisContentForId(content) });
  assert.notEqual(fp(input), fp({ ...input, contact: { ...input.contact, consultation: { ...proposed, preferredDates: ["2027-02-01T10:30", ...proposed.preferredDates.slice(1)] } } }));
  assert.ok(consultationLines(null).join("").includes("3つ"));
});
test("PDF: 行・段落を境界から次ページへ、欠落・重複なく全高を覆う", () => {
  const slices = planPdfSlices(250, 100, [{ top: 90, bottom: 110 }, { top: 175, bottom: 205 }]);
  assert.deepEqual(slices, [{ top: 0, height: 90 }, { top: 90, height: 85 }, { top: 175, height: 75 }]);
  assert.equal(slices.reduce((n, s) => n + s.height, 0), 250);
  assert.deepEqual(planPdfSlices(100, 100, []), [{ top: 0, height: 100 }]);
  assert.throws(() => planPdfSlices(6100, 100, []), /60/);
  assert.throws(() => planPdfSlices(100, 0, []));
});

const sourceId = "11111111-1111-1111-1111-111111111111";
const check = { subsidyId: "test", fiscalYear: 2026, frame: "test", equipKind: "ac", plannedModel: "TEST-ONLY", officialSource: "https://example.invalid/test-only", checkedOn: "2026-10-23", verdict: "listed", checkedBy: "ローカル試験担当・実データではない" };
function row(c, id = "record") { return { id, properties: { Evidence: { rich_text: [{ plain_text: JSON.stringify(c) }] } } }; }
const schema = { object: "data_source", properties: { Name: { type: "title" }, Evidence: { type: "rich_text" } } };
test("Notion: 全ページ読込・追記・再接続で残る（擬似APIのみ）", async () => {
  const old = global.fetch;
  const rows = [row(check, "first")]; const calls = [];
  global.fetch = async (url, options) => {
    assert.ok(String(url).startsWith("https://api.notion.com/v1/"));
    assert.equal(options.headers["Notion-Version"], "2025-09-03"); calls.push({ url, options });
    if (String(url).endsWith(`/data_sources/${sourceId}`)) return Response.json(schema);
    if (String(url).endsWith("/query")) {
      const body = JSON.parse(options.body);
      return Response.json(body.start_cursor ? { results: rows.slice(1), has_more: false } : { results: rows.slice(0, 1), has_more: rows.length > 1, next_cursor: "next" });
    }
    if (String(url).endsWith("/pages")) {
      const data = JSON.parse(options.body); assert.equal(data.parent.data_source_id, sourceId);
      const c = JSON.parse(data.properties.Evidence.rich_text.map(t => t.text.content).join(""));
      rows.push(row(c, "saved")); return Response.json({ id: "saved" });
    }
    if (String(url).endsWith("/pages/saved")) return Response.json(rows.at(-1));
    throw new Error("想定外の接続は禁止");
  };
  try {
    const first = await createNotionTargetProductStore(sourceId, "local-mock-only");
    await first.add({ ...check, plannedModel: "TEST-SECOND" });
    const fresh = await createNotionTargetProductStore(sourceId, "local-mock-only");
    assert.equal((await fresh.list("test", 2026)).length, 2);
    assert.deepEqual(await fresh.list("other", 2026), []);
    assert.ok(calls.some(c => c.options.body?.includes("start_cursor")));
  } finally { global.fetch = old; }
});
test("Notion: 空・権限エラー・不正記録・不完全なページ送りを確認済みにしない", async () => {
  const old = global.fetch;
  try {
    for (const bad of [{ results: [row({})], has_more: false }, { results: [], has_more: true }, { no: "results" }]) {
      global.fetch = async url => Response.json(String(url).endsWith("/query") ? bad : schema);
      await assert.rejects(createNotionTargetProductStore(sourceId, "mock"));
    }
    global.fetch = async () => new Response("private body must not be exposed", { status: 403 });
    await assert.rejects(createNotionTargetProductStore(sourceId, "mock"), /HTTP 403/);
    global.fetch = async url => Response.json(String(url).endsWith("/query") ? { results: [], has_more: false } : schema);
    const empty = await createNotionTargetProductStore(sourceId, "mock");
    assert.deepEqual(await empty.list("test", 2026), []);
  } finally { global.fetch = old; }
});
test("Vercel: 未設定・障害時にローカル/tmpへ逃げず未接続。回復時に読み直す", async () => {
  const old = global.fetch; const env = { ...process.env };
  try {
    process.env.VERCEL = "1"; delete process.env.EHC_TARGET_PRODUCT_NOTION_DATA_SOURCE_ID;
    forgetTargetProductStoreStatus(); target.resetTargetProductStore();
    assert.equal((await ensureTargetProductStore()).connected, false);
    process.env.EHC_TARGET_PRODUCT_NOTION_DATA_SOURCE_ID = sourceId;
    process.env.EHC_TARGET_PRODUCT_NOTION_TOKEN = "mock";
    global.fetch = async url => Response.json(String(url).endsWith("/query") ? { results: [], has_more: false } : schema);
    assert.equal((await ensureTargetProductStore()).connected, true);
    const isolated = await openTargetProductStore();
    global.fetch = async () => new Response("", { status: 503 });
    assert.equal((await ensureTargetProductStore()).connected, false);
    assert.equal(target.describeTargetProductStore().connected, false);
    assert.deepEqual(await target.listChecks("test", 2026), []);
    assert.equal(isolated.client.connected, true, "別要求の障害で取得済みの接続は入れ替わらない");
  } finally {
    global.fetch = old;
    for (const key of ["VERCEL", "EHC_TARGET_PRODUCT_NOTION_DATA_SOURCE_ID", "EHC_TARGET_PRODUCT_NOTION_TOKEN"]) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
    forgetTargetProductStoreStatus(); target.resetTargetProductStore();
  }
});
