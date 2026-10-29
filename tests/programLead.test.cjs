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
  assert.match(lead.memo, /\[可能性あり\] 東京都｜省エネ（通称ゼロエミ） .*最大2,250万円/);
  assert.match(lead.memo, /紹介元 KRH01/);
  assert.match(lead.nextAction, /紹介 KRH01・介護/);
  assert.equal(L.wishOf("sii"), "省エネ補助金");
  assert.equal(L.wishOf(null), "未定");
});

test("担当者宛メール: 件名に受付番号・制度・紹介。本文に行政書士の注意", () => {
  const input = L.readProgramSubmit(form()).input;
  const m = L.programStaffMail(input, "EHC-20261106-100000-ABCD", "2026-11-06");
  assert.match(m.subject, /^【補助金サイトの相談 EHC-20261106-100000-ABCD】社会福祉法人テスト会 特養あおば（東京都｜省エネ（通称ゼロエミ））［紹介 KRH01・介護］$/);
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

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 2)]);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200, 3)]);

test("添付: 写真とPDFは中身の先頭で確かめる。ほかの形式・数・合計の大きさは止める。名前は整える", () => {
  const ok = L.readAttachments([{ name: "../銘板 1.HEIC", data: `data:image/jpeg;base64,${JPEG.toString("base64")}` }, { name: "明細.pdf", data: PDF.toString("base64") }]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.files.map((f) => [f.filename, f.contentType, f.kind]), [["01_銘板 1.jpg", "image/jpeg", "photo"], ["02_明細.pdf", "application/pdf", "pdf"]]);
  assert.match(L.readAttachments([{ name: "a.exe", data: EXE.toString("base64") }]).error, /写真（JPEG・PNG・HEIC）か PDF/);
  assert.match(L.readAttachments(Array.from({ length: 6 }, () => ({ name: "x", data: JPEG.toString("base64") }))).error, /5つまで/);
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(3_300_000, 0)]).toString("base64");
  assert.match(L.readAttachments([{ name: "big", data: big }]).error, /大きすぎます/);
  assert.deepEqual(L.readAttachments(undefined), { ok: true, files: [] });
  assert.equal(L.readAttachments("nope").ok, false);
});

test("添付: 担当者宛メールに付き、Notion のメモに件数が残る。画面には届いたかを返す", async () => {
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
  try {
    const res = await POST(request(form({ attachments: [{ name: "銘板.jpg", data: JPEG.toString("base64") }, { name: "図面.pdf", data: PDF.toString("base64") }] })));
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.attachments, 2);
    assert.equal(json.attachmentsDelivered, true);
    const mail = sent.at(-1);
    assert.equal(mail.attachments.length, 2);
    assert.equal(mail.attachments[1].contentType, "application/pdf");
    assert.ok(Buffer.isBuffer(mail.attachments[0].content));
    const page = calls.find((c) => c.url.endsWith("/v1/pages"));
    assert.match(page.body.properties["メモ"].rich_text[0].text.content, /添付: 2件（写真1・PDF1/);
    const bad = await POST(request(form({ attachments: [{ name: "a.exe", data: EXE.toString("base64") }] })));
    assert.equal(bad.status, 400);
  } finally {
    global.fetch = realFetch;
    delete process.env.NOTION_TOKEN;
    delete process.env.DIAGNOSIS_MAIL_MODE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  }
});

test("メンバーと実績: 名前と役割だけ。確かめられない数字（累計台数）や学歴は載せない", () => {
  const T = loadTs("lib/team.ts");
  assert.deepEqual(T.TEAM.map((m) => m.name), ["相澤 圭太", "碓井 涼太", "両角 慎一", "桝口 卓摩"]);
  const all = JSON.stringify(T);
  assert.ok(!/10,000台|1万台|東京大学|キーエンス/.test(all));
  assert.ok(T.TEAM_SOURCES.every((s) => s.url.startsWith("https://")));
});

test("直し2回目: 相談したい制度を複数・任意の印・ご相談の内容を受ける（古い画面の programId だけでも受ける）", () => {
  const multi = L.readProgramSubmit(form({ programId: "tokyoKaishu", programIds: ["tokyoKaishu", "kokuKaigo", "evil", "tokyoKaishu"], flags: ["urgent", "mailOnly", "nope"], note: "夏に1台止まった\r\n\r\n\r\n施設は3つ\u0007" })).input;
  assert.deepEqual(multi.programIds, ["tokyoKaishu", "kokuKaigo"]);
  assert.equal(multi.programId, "tokyoKaishu");
  assert.deepEqual(multi.flags, ["urgent", "mailOnly"]);
  assert.equal(multi.note, "夏に1台止まった\n\n施設は3つ");
  const legacy = L.readProgramSubmit(form()).input;
  assert.deepEqual(legacy.programIds, ["tokyoZeroemi"]);
  assert.deepEqual(legacy.flags, []);
  assert.equal(legacy.note, null);
  assert.equal(L.cleanNote("あ".repeat(900)).length, 600);
  const m = L.programStaffMail(multi, "EHC-20261106-100000-ABCD", "2026-11-06");
  assert.match(m.subject, /^【急ぎ】【補助金サイトの相談 EHC-20261106-100000-ABCD】.*（東京都｜介護施設 ほか1件）/);
  assert.match(m.text, /ご希望の連絡方法: メール（お電話は控えてください）/);
  assert.match(m.text, /相談したい制度: 東京都｜介護施設 特養・養護の空調・建物の改修.*／国｜介護施設/);
  assert.match(m.text, /印: 急ぎ（空調が止まった・壊れた）・連絡はメールを希望/);
  assert.match(m.text, /ご相談の内容: 夏に1台止まった/);
  const lead = L.programLead(multi, "EHC-20261106-100000-ABCD", "2026-11-06");
  assert.match(lead.nextAction, /^【急ぎ】メールで折り返し/);
  assert.match(lead.memo, /ご相談の内容: 夏に1台止まった/);
});
