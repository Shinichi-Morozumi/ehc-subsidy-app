// v1 / 2026-11-06 / EHC-0150 ゼロエミ専用ページ（/zeroemi・/zeroemi/reizo）の簡易診断・相談の受け口・Zoom予約の照合の検査。
// SMTP・Notion・Zoom はすべて差し替え。外部への送信なし。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
function harness() {
  const cache = new Map();
  function load(file) {
    const p = path.resolve(root, file);
    if (cache.has(p)) return cache.get(p).exports;
    const m = { exports: {} }; cache.set(p, m);
    const native = createRequire(p);
    const req = (s) => {
      if (s === "nodemailer") return { createTransport: () => ({ sendMail: async () => ({ messageId: "mock" }) }) };
      const q = s.startsWith("@/") ? path.resolve(root, s.slice(2)) : s.startsWith(".") ? path.resolve(path.dirname(p), s) : null;
      if (q && fs.existsSync(q + ".ts")) return load(q + ".ts");
      return native(s);
    };
    const code = ts.transpileModule(fs.readFileSync(p, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInThisContext("(function(exports,require,module){" + code + "})", { filename: p })(m.exports, req, m);
    return m.exports;
  }
  return { load };
}
const RID = "a1b2c3d4-1234-4567-8901-123456789abc";
const kuchoAnswers = { kind: "kucho", place: "tokyo", city: "中野区", org: "sme", equip: ["ac", "light"], budget: "1000" };

test("簡易診断（空調）：都内の中小企業は見込みあり・目安は2/3〜3/4。都外と大企業は対象外", () => {
  const Z = harness().load("lib/zeroemiFlow.ts");
  const j = Z.judgeZeroemi(kuchoAnswers);
  assert.equal(j.level, "likely");
  assert.equal(j.estimate.text, "667万〜2,250万円");
  assert.equal(Z.judgeZeroemi({ ...kuchoAnswers, budget: "3000" }).estimate.text, "1,000万〜4,500万円");
  assert.equal(Z.judgeZeroemi({ ...kuchoAnswers, budget: "lt500" }).estimate.text, "〜375万円");
  assert.equal(Z.judgeZeroemi({ ...kuchoAnswers, budget: "unknown" }).estimate, null);
  assert.equal(Z.judgeZeroemi({ ...kuchoAnswers, place: "other", city: "" }).level, "other");
  const large = Z.judgeZeroemi({ ...kuchoAnswers, org: "large" });
  assert.equal(large.level, "other"); assert.equal(large.estimate, null);
  assert.equal(Z.judgeZeroemi({ ...kuchoAnswers, org: "unknown" }).marks[0].mark, "△");
});

test("簡易診断（冷凍冷蔵）：機械ごとに【1】【2】の見込みを出す。大企業はノンフロンだけ・1/2", () => {
  const Z = harness().load("lib/zeroemiFlow.ts");
  const base = { kind: "reizo", place: "tokyo", city: "江東区", org: "sme", equip: ["sc_out"], budget: "500" };
  const j = Z.judgeZeroemi(base);
  assert.equal(j.level, "likely"); assert.deepEqual(j.marks.map((m) => m.mark), ["○", "○"]);
  assert.equal(j.estimate.text, "333万〜750万円");
  const fridge = Z.judgeZeroemi({ ...base, equip: ["fridge"] });
  assert.equal(fridge.level, "check"); assert.deepEqual(fridge.marks.map((m) => m.mark), ["△", "×"]);
  const large = Z.judgeZeroemi({ ...base, org: "large" });
  assert.equal(large.marks[0].mark, "×"); assert.equal(large.marks[1].mark, "○");
  assert.match(large.title, /ノンフロン/); assert.equal(large.estimate.text, "250万〜500万円");
  assert.equal(Z.judgeZeroemi({ ...base, org: "large", equip: ["fridge"] }).level, "other");
});

test("これから準備する回：11/6なら第5回は準備が足りず、第6回（1/29締切）をすすめる", () => {
  const Z = harness().load("lib/zeroemiFlow.ts");
  const w = Z.zeroemiTargetWindow("2026-11-06");
  assert.equal(w.target.end, "2027-01-29"); assert.equal(w.tooSoon.end, "2026-11-20");
  assert.equal(Z.zeroemiTargetWindow("2027-01-01").target, null);
  assert.equal(Z.zeroemiTargetWindow("2027-01-01").tooSoon.end, "2027-01-29");
});

test("答えの確かめ：都内なら区市町村が必須。知らない設備は落とす。連絡の方法は2つだけ", () => {
  const Z = harness().load("lib/zeroemiFlow.ts");
  assert.equal(Z.readZeroemiAnswers({ ...kuchoAnswers, city: "" }), null);
  assert.equal(Z.readZeroemiAnswers({ ...kuchoAnswers, equip: ["sc_in"] }), null);
  assert.deepEqual(Z.readZeroemiAnswers({ ...kuchoAnswers, equip: ["ac", "ac", "x", "vent"] }).equip, ["ac", "vent"]);
  assert.equal(Z.readZeroemiAnswers({ ...kuchoAnswers, city: "<script>" }), null);
  assert.ok(Z.readZeroemiLead({ answers: kuchoAnswers, contact: "fax" }).error);
  assert.equal(Z.readZeroemiLead({ answers: kuchoAnswers, contact: "callback", campaign: "Bad Value!" }).value.campaign, null);
});

test("相談の受け口：折り返しなら日程なしで受ける。Zoomなら予約が必須。入口の食い違いは断る", () => {
  const P = harness().load("lib/programLead.ts");
  const body = { company: "営業対象外", name: "試験", reach: "03-1234-5678", consent: true, source: "zeroemi", requestId: RID, programIds: ["tokyoZeroemi"], zeroemi: { kind: "kucho", answers: kuchoAnswers, contact: "callback", campaign: "ehc_zeroemi_flow_202611", test: true } };
  const r = P.readProgramSubmit(body);
  assert.equal(r.ok, true, r.error);
  const lead = P.programLead(r.input, `EHC-${RID}`, "2026-11-06"), mail = P.programStaffMail(r.input, `EHC-${RID}`, "2026-11-06");
  assert.match(lead.memo, /ゼロエミ専用ページ（空調 \/zeroemi）/); assert.match(lead.memo, /工事場所: 東京都内 中野区/); assert.match(lead.memo, /空調（業務用エアコン）・LED照明/);
  assert.match(lead.memo, /電話かメールで折り返し/); assert.match(lead.nextAction, /電話で折り返し/); assert.match(lead.nextAction, /営業対象外/);
  assert.equal(lead.address, "東京都 中野区");
  assert.match(mail.subject, /【ゼロエミ・空調】【折り返し希望】/); assert.match(mail.subject, /営業対象外/);
  assert.doesNotMatch(mail.text, /候補日時3件を確認/);
  assert.equal(P.readProgramSubmit({ ...body, source: "zeroemiReizo" }).ok, false);
  const zoomNoBooking = P.readProgramSubmit({ ...body, reach: "a@example.com", zeroemi: { ...body.zeroemi, contact: "zoom" } });
  assert.equal(zoomNoBooking.ok, false); assert.match(zoomNoBooking.error, /空き枠から予約/);
  const consultation = { mode: "zoom", timezone: "Asia/Tokyo", booking: { eventId: "evt_12345678", attendeeId: "att_12345678" } };
  assert.equal(P.readProgramSubmit({ ...body, consultation }).ok, false);
  const zoom = P.readProgramSubmit({ ...body, reach: "a@example.com", consultation, zeroemi: { ...body.zeroemi, contact: "zoom" } });
  assert.equal(zoom.ok, true, zoom.error);
  assert.match(P.programStaffMail(zoom.input, `EHC-${RID}`, "2026-11-06").subject, /【Zoom予約済み】/);
  // 既存の入口（候補3日時が必須）は変わらない
  assert.equal(P.readProgramSubmit({ company: "a", name: "b", reach: "x@example.com", source: "top", consent: true, requestId: RID }).ok, false);
});

test("Zoom予約をメールアドレスで探す：1件だけなら結び付ける（参加URLは返さない）。0件・2件は確定しない", async () => {
  const Zs = harness().load("lib/zoomBookingServer.ts"), Zb = harness().load("lib/zoomBooking.ts");
  const oldFetch = global.fetch, oldEnv = { ...process.env };
  Object.assign(process.env, { ZOOM_ACCOUNT_ID: "a", ZOOM_CLIENT_ID: "b", ZOOM_CLIENT_SECRET: "c", ZOOM_EHC_SCHEDULE_ID: "sch_1" });
  const start = new Date(Date.now() + 3 * 86400000).toISOString(), end = new Date(Date.parse(start) + 30 * 60000).toISOString();
  const item = (eventId, email) => ({ event_id: eventId, schedule_id: "sch_1", summary: Zb.ZOOM_BOOKING_TITLE, status: "confirmed", attendees: [{ attendee_id: `att_${eventId}`, email, booker: true }] });
  let items = [];
  global.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith("https://zoom.us/oauth/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
    if (u.startsWith("https://api.zoom.us/v2/scheduler/events?")) return Response.json({ items });
    const id = decodeURIComponent(u.split("/events/")[1]);
    const it = items.find((x) => x.event_id === id);
    return Response.json({ ...it, start_date_time: start, end_date_time: end, external_location: { kind: "zoom", meeting_join_url: "https://us06web.zoom.us/j/123" } });
  };
  try {
    items = [item("evt_aaaaaaaa", "Taro@Example.com"), item("evt_bbbbbbbb", "other@example.com")];
    const b = await Zs.findZoomBookingByEmail("taro@example.com");
    assert.equal(b.eventId, "evt_aaaaaaaa"); assert.equal(b.attendeeId, "att_evt_aaaaaaaa"); assert.equal(b.start, start); assert.equal(b.joinUrl, undefined);
    items = [item("evt_cccccccc", "other@example.com")];
    await assert.rejects(() => Zs.findZoomBookingByEmail("taro@example.com"), /見つかりません/);
    items = [item("evt_dddddddd", "taro@example.com"), item("evt_eeeeeeee", "taro@example.com")];
    await assert.rejects(() => Zs.findZoomBookingByEmail("taro@example.com"), /2件以上/);
    await assert.rejects(() => Zs.findZoomBookingByEmail("not-mail"), /メールアドレス/);
  } finally { global.fetch = oldFetch; process.env = oldEnv; }
});
