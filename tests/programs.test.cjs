// v1 / 2026-10-29 / EHC-0102 制度カード（lib/programs.ts）と6問の判定（lib/programMatch.ts）の検査。
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

const P = loadTs("lib/programs.ts");
const M = loadTs("lib/programMatch.ts");
const fs2 = require("node:fs");

test("いつ: 10/29 時点で ゼロエミ第5回は「これから」（開始まで11日・締切まで22日）、SII 4次は受付中（締切まで1日）", () => {
  const z = P.nextWindow(P.PROGRAMS.tokyoZeroemi, "2026-10-29");
  assert.equal(z.state, "upcoming");
  assert.equal(z.window.short, "第5回");
  assert.equal(z.daysToStart, 11);
  assert.equal(z.daysToEnd, 22);
  const s = P.nextWindow(P.PROGRAMS.sii, "2026-10-29");
  assert.equal(s.state, "open");
  assert.equal(s.daysToEnd, 1);
});

test("いつ: 締切を過ぎたら次の回へ。次が無ければ none（受付中と言い続けない）", () => {
  assert.equal(P.nextWindow(P.PROGRAMS.sii, "2026-10-31").state, "none");
  const z = P.nextWindow(P.PROGRAMS.tokyoZeroemi, "2026-11-21");
  assert.equal(z.window.short, "第6回（最終回）");
  assert.equal(z.state, "upcoming");
  assert.equal(P.nextWindow(P.PROGRAMS.tokyoZeroemi, "2027-01-20").state, "open");
  assert.equal(P.nextWindow(P.PROGRAMS.tokyoZeroemi, "2027-01-30").state, "none");
  assert.equal(P.nextWindow(P.PROGRAMS.kokuKaigo, "2026-10-29").state, "none");
});

test("いつ: 締切ボードは近い順。今日を過ぎた節目は出さない", () => {
  const m = P.upcomingMilestones("2026-10-29");
  assert.equal(m[0].programId, "sii");
  assert.equal(m[0].days, 1);
  assert.deepEqual(m.slice(1, 4).map((x) => `${x.programId}:${x.kind}:${x.date}`), [
    "tokyoZeroemi:start:2026-11-09", "tokyoZeroemi:end:2026-11-20", "tokyoChiiki:end:2026-11-27",
  ]);
  const later = P.upcomingMilestones("2026-11-21");
  assert.ok(later.every((x) => x.date >= "2026-11-21"));
  assert.equal(later[0].programId, "tokyoChiiki");
});

test("確認日から14日を過ぎたら「公式で再確認中」", () => {
  assert.equal(P.needsRecheck(P.PROGRAMS.sii, "2026-11-12"), false);
  assert.equal(P.needsRecheck(P.PROGRAMS.sii, "2026-11-13"), true);
});

test("結局いくら: ゼロエミ 工事費1,000万円 → 3/4で750万円・自己負担250万円〜（2/3は666万円）", () => {
  const e = P.estimateFor(P.PROGRAMS.tokyoZeroemi, { costMan: 1000 });
  assert.equal(e.kind, "ok");
  assert.deepEqual(e.lines.map((l) => [l.subsidyMan, l.selfMan, l.capped]), [[750, 250, false], [666, 334, false], [666, 334, false]]);
  const big = P.estimateFor(P.PROGRAMS.tokyoZeroemi, { costMan: 10000 });
  assert.deepEqual(big.lines.map((l) => [l.subsidyMan, l.capped]), [[4500, true], [2500, true], [1000, true]]);
  assert.equal(big.lines[0].selfMan, 5500);
});

test("結局いくら: 国の介護交付金10/10は、工事費が上限内なら自己負担を数字で出さない（0円とは言わない）", () => {
  const e = P.estimateFor(P.PROGRAMS.kokuKaigo, { costMan: 1000, kaigoGroup: "A" });
  assert.equal(e.lines.length, 1);
  assert.equal(e.lines[0].subsidyMan, 1000);
  assert.equal(e.lines[0].selfMan, null);
  const over = P.estimateFor(P.PROGRAMS.kokuKaigo, { costMan: 2000, kaigoGroup: "A" });
  assert.deepEqual([over.lines[0].subsidyMan, over.lines[0].selfMan], [1660, 340]);
  const b = P.estimateFor(P.PROGRAMS.kokuKaigo, { costMan: 2000, kaigoGroup: "B" });
  assert.equal(b.lines[0].subsidyMan, 833);
  assert.equal(P.estimateFor(P.PROGRAMS.kokuKaigo, { costMan: 50, kaigoGroup: "B" }).kind, "belowMin");
});

test("結局いくら: 30人以上は 基準額3,160万円 と工事費の低い方 × 2/3", () => {
  assert.equal(P.estimateFor(P.PROGRAMS.kokuKaigo30, { costMan: 1000 }).lines[0].subsidyMan, 666);
  const e = P.estimateFor(P.PROGRAMS.kokuKaigo30, { costMan: 5000 });
  assert.deepEqual([e.lines[0].subsidyMan, e.lines[0].selfMan], [2106, 2894]);
});

test("結局いくら: SII は機器代だけが対象。機器代が無いと数字を出さない。トップ性能枠の行は出さない", () => {
  assert.equal(P.estimateFor(P.PROGRAMS.sii, { costMan: 1000 }).kind, "needEquipment");
  assert.equal(P.estimateFor(P.PROGRAMS.sii, {}).kind, "needCost");
  const e = P.estimateFor(P.PROGRAMS.sii, { costMan: 1000, equipmentMan: 600 });
  assert.equal(e.lines.length, 1);
  assert.deepEqual([e.lines[0].subsidyMan, e.lines[0].selfMan], [200, 800]);
});

test("結局いくら: 都の地域密着型（上限か基準額か確認中）は目安を出さない", () => {
  assert.equal(P.estimateFor(P.PROGRAMS.tokyoChiiki, { costMan: 1000 }).kind, "unknownRate");
});

test("金額の書き方: 1億8,419.2万円・1億円・833万円", () => {
  assert.equal(P.fmtMan(18419.2), "1億8,419.2万円");
  assert.equal(P.fmtMan(10000), "1億円");
  assert.equal(P.fmtMan(30000), "3億円");
  assert.equal(P.fmtMan(833), "833万円");
  assert.equal(P.fmtMan(6759.7), "6,759.7万円");
  assert.equal(P.jaDate("2026-11-09"), "2026年11月9日（月）");
});

const ans = (o) => ({ pref: "tokyo23", facility: "tokuyou", capacity: "ge30", corp: "shafuku", staff: "le300", work: "renew", costMan: 3000, equipmentMan: null, ...o });
const ids = (list) => list.map((i) => `${i.program.id}:${i.status}`);

test("判定: 23区の広域型特養（80床・社会福祉法人・更新）→ ゼロエミと都の改修費は可能性あり、30人以上の国の交付金とSIIは要確認。締切の近い順", () => {
  const r = M.matchPrograms(ans({}), "2026-11-06");
  assert.deepEqual(ids(r.items), ["tokyoZeroemi:可能性あり", "tokyoKaishu:可能性あり", "kokuKaigo30:要確認", "sii:要確認"]);
  assert.equal(r.excluded.length, 0);
  assert.equal(r.showDropin, false);
  const z = r.items[0];
  assert.equal(z.estimate.lines[0].subsidyMan, 2250);
  assert.ok(z.reasons.includes("都内"));
});

test("判定: 八王子市の特養は都の改修費が対象外の見込み（理由つき）", () => {
  const r = M.matchPrograms(ans({ pref: "hachioji" }), "2026-11-06");
  const x = r.excluded.find((i) => i.program.id === "tokyoKaishu");
  assert.ok(x);
  assert.match(x.checks[0], /八王子市/);
});

test("判定: 神奈川のグループホームで冷媒だけ → 国の交付金は要確認、ゼロエミ・SIIは対象外の見込み、ドロップインの選択肢を出す", () => {
  const r = M.matchPrograms(ans({ pref: "kanagawa", facility: "gh", capacity: null, work: "dropin", costMan: 500 }), "2026-11-06");
  assert.deepEqual(ids(r.items), ["kokuKaigo:要確認"]);
  assert.deepEqual(r.excluded.map((i) => i.program.id).sort(), ["sii", "tokyoZeroemi"]);
  assert.equal(r.showDropin, true);
  assert.equal(r.items[0].estimate.lines[0].subsidyMan, 500);
  assert.equal(r.items[0].estimate.lines[0].selfMan, null);
});

test("判定: 23区の地域密着型特養 → 都の地域密着型（要確認）と国の交付金（可能性あり・1,660万円の枠）。併用不可の注意", () => {
  const r = M.matchPrograms(ans({ facility: "chiikitoku", capacity: null, costMan: 2000 }), "2026-11-06");
  const chiiki = r.items.find((i) => i.program.id === "tokyoChiiki");
  const koku = r.items.find((i) => i.program.id === "kokuKaigo");
  assert.equal(chiiki.status, "要確認");
  assert.ok(chiiki.checks.some((c) => c.includes("併用できない")));
  assert.equal(koku.status, "可能性あり");
  assert.equal(koku.estimate.lines[0].subsidyMan, 1660);
});

test("判定: 埼玉の事務所 → SII（要確認）だけ。介護の制度は出さない", () => {
  const r = M.matchPrograms(ans({ pref: "saitama", facility: "office", capacity: null, corp: "company" }), "2026-11-06");
  assert.deepEqual(ids(r.items), ["sii:要確認"]);
  assert.deepEqual(r.excluded.map((i) => i.program.id), ["tokyoZeroemi"]);
});

test("判定: 定員が分からない老健 → 29人以下と30人以上の両方を要確認で出す", () => {
  const r = M.matchPrograms(ans({ facility: "rouken", capacity: "unknown" }), "2026-11-06");
  assert.equal(r.items.find((i) => i.program.id === "kokuKaigo").status, "要確認");
  assert.equal(r.items.find((i) => i.program.id === "kokuKaigo30").status, "要確認");
});

test("送られてきた答え: 選択肢に無い値・定員の抜けは受け付けない。金額はカンマを外して読む", () => {
  assert.equal(M.readCheckAnswers({ pref: "tokyo23", facility: "tokuyou", corp: "shafuku", staff: "le300", work: "renew" }), null);
  assert.equal(M.readCheckAnswers({ pref: "mars", facility: "gh", corp: "shafuku", staff: "le300", work: "renew" }), null);
  const a = M.readCheckAnswers({ pref: "tokyo23", facility: "gh", capacity: "ge30", corp: "shafuku", staff: "le300", work: "renew", costMan: "1,200", equipmentMan: 2000 });
  assert.equal(a.capacity, null);
  assert.equal(a.costMan, 1200);
  assert.equal(a.equipmentMan, null);
  assert.equal(M.readCheckAnswers(null), null);
  assert.equal(M.readCheckAnswers({ pref: "tokyo23", facility: "gh", corp: "shafuku", staff: "le300", work: "renew", costMan: -5 }).costMan, null);
});

test("言葉: 景品表示法・行政書士法で使わない言い方が、制度データと判定に無い", () => {
  for (const f of ["lib/programs.ts", "lib/programMatch.ts"]) {
    const body = fs2.readFileSync(path.resolve(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const ng of ["実質0円", "実質ゼロ", "自己負担ゼロ", "自己負担0円", "必ず採択", "確実", "申請代行", "代行します"]) {
      assert.ok(!body.includes(ng), `${f} に「${ng}」`);
    }
  }
});

test("入口と締切ボード：受付を1行ずつ、次の節目が近い順。いつからいつまでの書き方（年が違えば年を付ける）", () => {
  const items = P.upcomingWindowItems("2026-11-06");
  assert.deepEqual(items.map((i) => `${i.programId}:${i.window.short}:${i.state}:${i.nextDays}`), [
    "tokyoZeroemi:第5回:upcoming:3",
    "tokyoChiiki:協議の最終期限（区市町村→都）:open:21",
    "tokyoKaishu:第2回 協議書:open:63",
    "tokyoZeroemi:第6回（最終回）:upcoming:73",
  ]);
  assert.equal(P.windowRangeText(P.PROGRAMS.tokyoZeroemi.windows[0], "2026-11-06"), "11月9日（月）〜11月20日（金）");
  assert.equal(P.windowRangeText(P.PROGRAMS.tokyoZeroemi.windows[1], "2026-11-06"), "2027年1月18日（月）〜1月29日（金）");
  assert.equal(P.windowRangeText(P.PROGRAMS.tokyoKaishu.windows[0], "2026-11-06"), "2027年1月8日（金）まで");
  assert.equal(P.windowRangeText(P.PROGRAMS.tokyoKaishu.windows[0], "2027-01-02"), "1月8日（金）まで");
});

test("残り日数の書き方は「開始まで」「終了まで」（ご指示 2026-10-29）", () => {
  const [z5] = P.upcomingWindowItems("2026-11-06", ["tokyoZeroemi"]);
  assert.equal(P.countdownLabel(z5), "開始まであと3日");
  const [open] = P.upcomingWindowItems("2026-11-10", ["tokyoZeroemi"]);
  assert.equal(P.countdownLabel(open), "終了まであと10日");
  assert.equal(P.countdownLabel(P.upcomingWindowItems("2026-11-19", ["tokyoZeroemi"])[0]), "明日で終了");
  assert.equal(P.countdownLabel(P.upcomingWindowItems("2026-11-20", ["tokyoZeroemi"])[0]), "今日で終了");
  assert.equal(P.countdownLabel(P.nextWindow(P.PROGRAMS.tokyoKaishu, "2026-11-06")), "終了まであと63日");
});

test("入口カードの一言：どの制度にも 何に使える・いくら・受付が無いときの一言 がある", () => {
  for (const id of P.PROGRAM_ORDER) {
    const p = P.PROGRAMS[id];
    assert.ok(p.useShort && p.amountShort && p.noneText, id);
  }
});
