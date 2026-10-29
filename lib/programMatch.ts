/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 補助金の6問の診断（/shindan）の判定

   6問：所在地／施設の種類／定員／法人の種類と従業員数／工事の内容／工事費の目安（分かれば）
   結果：制度ごとに「可能性あり／要確認／対象外の見込み」と、合った理由・確かめる点・目安の金額。
   　　　並べ方は締切の近い順（受付の予定が無いものは後ろ）。対象外の見込みは最後にまとめる。
   　　　工事が「冷媒だけの入れ替え（ドロップイン）」なら、補助を使わない選択肢のカードも出す。

   どれも「対象になり得る」までしか言わない（景品表示法：断定しない）。
   判定の根拠は lib/programs.ts の各制度の対象・要件（2026-10-29 公式で確認）。
   ─────────────────────────────────────────────────────────── */

import { PROGRAMS, PROGRAM_ORDER, estimateFor, nextWindow, needsRecheck, type Estimate, type NextWindow, type Program, type ProgramId } from "./programs";
import { todayJst } from "./programClock";

type Opt = { readonly id: string; readonly label: string };
type IdOf<T extends readonly Opt[]> = T[number]["id"];

export const CHECK_PREFS = [
  { id: "tokyo23", label: "東京都（23区）" },
  { id: "tokyoCity", label: "東京都（23区・八王子市以外の市町村）" },
  { id: "hachioji", label: "東京都 八王子市" },
  { id: "kanagawa", label: "神奈川県" },
  { id: "saitama", label: "埼玉県" },
  { id: "chiba", label: "千葉県" },
  { id: "other", label: "そのほかの道府県" },
] as const;

/** care: A＝1,660万円の枠／B＝833万円の枠／null＝介護施設でない。askCapacity: 定員を聞くか（制度上29人以下が決まっている施設は聞かない） */
export const CHECK_FACILITIES = [
  { id: "tokuyou", label: "特別養護老人ホーム（広域型）", care: "A", askCapacity: true },
  { id: "chiikitoku", label: "地域密着型特別養護老人ホーム", care: "A", askCapacity: false },
  { id: "yougo", label: "養護老人ホーム", care: "B", askCapacity: true },
  { id: "rouken", label: "介護老人保健施設・介護医療院", care: "A", askCapacity: true },
  { id: "carehouse", label: "ケアハウス（軽費老人ホーム）", care: "A", askCapacity: true },
  { id: "toshigata", label: "都市型軽費老人ホーム", care: "B", askCapacity: false },
  { id: "gh", label: "グループホーム", care: "B", askCapacity: false },
  { id: "shotaki", label: "小規模多機能・看護小規模多機能", care: "B", askCapacity: false },
  { id: "ninchiday", label: "認知症デイサービス", care: "B", askCapacity: false },
  { id: "otherCare", label: "そのほかの介護事業所（デイ・訪問など）", care: null, askCapacity: false },
  { id: "hospital", label: "病院・クリニック", care: null, askCapacity: false },
  { id: "office", label: "事務所・店舗・倉庫・工場など", care: null, askCapacity: false },
] as const satisfies readonly { id: string; label: string; care: "A" | "B" | null; askCapacity: boolean }[];

export const CHECK_CAPACITIES = [
  { id: "le29", label: "29人以下" },
  { id: "ge30", label: "30人以上" },
  { id: "unknown", label: "わからない" },
] as const;

export const CHECK_CORPS = [
  { id: "shafuku", label: "社会福祉法人" },
  { id: "iryou", label: "医療法人" },
  { id: "company", label: "株式会社・合同会社など" },
  { id: "npo", label: "NPO法人・一般社団法人など" },
  { id: "public", label: "公立（都道府県・市区町村など）" },
  { id: "unknown", label: "わからない" },
] as const;

export const CHECK_STAFF = [
  { id: "le300", label: "300人以下" },
  { id: "gt300", label: "301人以上" },
  { id: "unknown", label: "わからない" },
] as const;

/* 2026-10-29 ご指示「新しい機器？だと初見で何となる」：何を入れ替えるのかが分かる言い方にする */
export const CHECK_WORKS = [
  { id: "renew", label: "空調機を、新しい機種に入れ替える（更新）", hint: "室外機・室内機ごと交換します" },
  { id: "building", label: "空調の入れ替えと一緒に、建物も直す", hint: "屋上の防水・給排水・浴室・外壁など" },
  { id: "dropin", label: "空調機はそのまま、冷媒（ガス）だけ入れ替える", hint: "ドロップイン。機器は交換しません" },
  { id: "undecided", label: "まだ決めていない（相談して決めたい）", hint: "現地で機器の状態を見てご提案します" },
] as const;

export type CheckPrefId = IdOf<typeof CHECK_PREFS>;
export type CheckFacilityId = IdOf<typeof CHECK_FACILITIES>;
export type CheckCapacityId = IdOf<typeof CHECK_CAPACITIES>;
export type CheckCorpId = IdOf<typeof CHECK_CORPS>;
export type CheckStaffId = IdOf<typeof CHECK_STAFF>;
export type CheckWorkId = IdOf<typeof CHECK_WORKS>;

export interface CheckAnswers {
  pref: CheckPrefId;
  facility: CheckFacilityId;
  /** 定員を聞かない施設は null（制度上29人以下） */
  capacity: CheckCapacityId | null;
  corp: CheckCorpId;
  staff: CheckStaffId;
  work: CheckWorkId;
  /** 工事費の目安（万円・税抜）。分からなければ null */
  costMan: number | null;
  /** うち機器代（万円・税抜）。分からなければ null */
  equipmentMan: number | null;
}

export const CHECK_STEPS = [
  { key: "pref", q: "施設・事業所の所在地は？", hint: "東京都は、区市町村で使える制度が分かれます。" },
  { key: "facility", q: "施設の種類は？", hint: "介護施設の種類で、国と都の補助の対象が変わります。" },
  { key: "capacity", q: "定員は何人ですか？", hint: "国の交付金は、29人以下か30人以上かで窓口と対象が変わります。" },
  { key: "corp", q: "法人の種類と、従業員の数は？", hint: "国の省エネ補助金は、従業員300人以下なら中小企業者等として扱われます（社会福祉法人・医療法人）。" },
  { key: "work", q: "どんな工事を考えていますか？", hint: "補助の多くは、空調機を新しい機種に入れ替える工事が対象です。冷媒だけの入れ替え（ドロップイン）は、多くの補助の対象外の見込みです。" },
  { key: "cost", q: "工事費の目安は？（分かれば）", hint: "税抜の金額で。分からなければ飛ばせます。入れると「結局いくら」の目安を出します。" },
] as const;

export const labelOfOpt = <T extends readonly Opt[]>(list: T, id: string | null | undefined): string => list.find((o) => o.id === id)?.label ?? "";

export function facilityOf(id: CheckFacilityId) {
  return CHECK_FACILITIES.find((f) => f.id === id) ?? CHECK_FACILITIES[CHECK_FACILITIES.length - 1];
}

/** この施設で定員の質問を出すか */
export function asksCapacity(facility: CheckFacilityId | null | undefined): boolean {
  return !!facility && facilityOf(facility).askCapacity;
}

export type MatchStatus = "可能性あり" | "要確認" | "対象外の見込み";

export interface MatchItem {
  program: Program;
  status: MatchStatus;
  /** 合った理由（✓） */
  reasons: string[];
  /** 確かめる点・対象外の理由 */
  checks: string[];
  estimate: Estimate;
  next: NextWindow;
  recheck: boolean;
}

export interface MatchResult {
  items: MatchItem[];
  excluded: MatchItem[];
  /** 補助を使わない選択肢（ドロップイン）のカードを出すか */
  showDropin: boolean;
}

const isTokyo = (p: CheckPrefId) => p === "tokyo23" || p === "tokyoCity" || p === "hachioji";

interface Judge {
  status: MatchStatus;
  reasons: string[];
  checks: string[];
}

function judge(id: ProgramId, a: CheckAnswers): Judge | null {
  const f = facilityOf(a.facility);
  const tokyo = isTokyo(a.pref);
  const pubCorp = a.corp === "public";
  const dropin = a.work === "dropin";
  const corpLabel = labelOfOpt(CHECK_CORPS, a.corp);
  const out = (status: MatchStatus, reasons: string[], checks: string[] = []): Judge => ({ status, reasons, checks });

  switch (id) {
    case "tokyoZeroemi": {
      if (!tokyo) return out("対象外の見込み", [], ["都内の事業所が対象です。"]);
      if (pubCorp) return out("対象外の見込み", [], ["公立の施設は対象外の見込みです。"]);
      if (dropin) return out("対象外の見込み", [], ["冷媒だけの入れ替えは対象外の見込みです（事務局に確認中）。"]);
      const reasons = ["都内", ...(a.corp !== "unknown" ? [corpLabel] : []), ...(a.work === "renew" || a.work === "building" ? ["空調機の入れ替え（更新）"] : [])];
      const checks: string[] = ["中小規模の事業所か（年間の光熱費がおおむね1億円未満が目安）", "CO2の削減量の区分（省エネ診断で分かります）"];
      if (a.corp === "company" && a.staff !== "le300") checks.unshift("中小企業に当たるか（資本金・従業員の数）");
      if (a.corp === "npo" || a.corp === "unknown") checks.unshift("法人の種類が対象に入るか");
      if (a.work === "undecided") checks.push("空調機を新しい機種に入れ替える工事であること");
      const sure = (a.corp === "shafuku" || a.corp === "iryou" || (a.corp === "company" && a.staff === "le300")) && a.work !== "undecided";
      return out(sure ? "可能性あり" : "要確認", reasons, checks);
    }
    case "tokyoKaishu": {
      if (a.facility !== "tokuyou" && a.facility !== "yougo") return null;
      if (!tokyo) return out("対象外の見込み", [], ["都内の施設が対象です。"]);
      if (a.pref === "hachioji") return out("対象外の見込み", [], ["八王子市内の施設は対象外です。"]);
      if (pubCorp) return out("対象外の見込み", [], ["公立の施設は対象外です。"]);
      const reasons = ["都内", f.label];
      const checks = ["建物の所有者が民間の法人であること", "創設・前回の大規模改修から10年を過ぎているか", "財務の審査", "空調の特別枠に当たるか（平成28〜令和7年度に都の大規模改修の補助を受けたか）"];
      if (dropin) return out("要確認", reasons, ["冷媒だけの入れ替えが大規模改修に当たるか", ...checks]);
      return out(a.work === "undecided" ? "要確認" : "可能性あり", [...reasons, ...(a.work === "undecided" ? [] : ["空調・建物の改修"])], checks);
    }
    case "tokyoChiiki": {
      if (a.facility !== "chiikitoku" && a.facility !== "shotaki") return null;
      if (!tokyo) return out("対象外の見込み", [], ["都内の施設が対象です。"]);
      return out("要確認", ["都内", f.label], ["区市町村がこの事業を行っているか", "金額が上限か基準額か（都に確認中）", "国の交付金とは併用できない", ...(dropin ? ["冷媒だけの入れ替えが大規模な修繕に当たるか"] : [])]);
    }
    case "kokuKaigo": {
      if (!f.care) return null;
      if (a.capacity === "ge30") return null;
      const reasons = [f.label, a.capacity === "le29" ? "定員29人以下" : a.capacity === null ? "定員29人以下の施設" : ""].filter(Boolean);
      const checks = ["所在地の市区町村が募集しているか（次の募集は未発表）", "令和9年度分から中長期の修繕計画が必要"];
      if (a.capacity === "unknown") checks.unshift("定員が29人以下か");
      if (pubCorp) checks.unshift("公立の施設の扱い");
      if (dropin) checks.unshift("冷媒だけの入れ替えが大規模修繕に当たるか");
      const sure = a.capacity !== "unknown" && !pubCorp && !dropin && a.work !== "undecided";
      return out(sure ? "可能性あり" : "要確認", reasons, checks);
    }
    case "kokuKaigo30": {
      if (!f.care || !f.askCapacity) return null;
      if (a.capacity !== "ge30" && a.capacity !== "unknown") return null;
      return out("要確認", [f.label, ...(a.capacity === "ge30" ? ["定員30人以上"] : [])], [
        ...(a.capacity === "unknown" ? ["定員が30人以上か"] : []),
        "耐震化・非常用発電などの防災対策と一体の改修か",
        "所在地の都道府県のメニューと募集の時期",
      ]);
    }
    case "sii": {
      if (dropin) return out("対象外の見込み", [], ["指定された機種への更新が対象です。冷媒だけの入れ替えは対象外の見込みです。"]);
      const reasons = ["全国が対象", ...(a.work === "renew" || a.work === "building" ? ["空調機の入れ替え（更新）"] : [])];
      if ((a.corp === "shafuku" || a.corp === "iryou") && a.staff === "le300") reasons.push("従業員300人以下（中小企業者等）");
      const checks = ["次の公募の時期（未発表）", "更新する機種が指定の設備に入っているか"];
      if (pubCorp) checks.unshift("公立の施設の扱い");
      if (a.staff === "gt300") checks.push("大企業として扱われる場合の条件");
      return out("要確認", reasons, checks);
    }
  }
}

const RANK: Record<MatchStatus, number> = { 可能性あり: 0, 要確認: 1, 対象外の見込み: 2 };

/** 締切の近さ（受付中・これからの締切までの日数。予定が無ければ大きな値） */
const urgency = (n: NextWindow) => (n.daysToEnd === null ? 100000 : n.daysToEnd);

export function matchPrograms(a: CheckAnswers, today: string = todayJst()): MatchResult {
  const all: MatchItem[] = [];
  const kaigoGroup = facilityOf(a.facility).care;
  for (const id of PROGRAM_ORDER) {
    const j = judge(id, a);
    if (!j) continue;
    const program = PROGRAMS[id];
    all.push({
      program,
      status: j.status,
      reasons: j.reasons,
      checks: j.checks,
      estimate: estimateFor(program, { costMan: a.costMan, equipmentMan: a.equipmentMan, kaigoGroup }),
      next: nextWindow(program, today),
      recheck: needsRecheck(program, today),
    });
  }
  const sorter = (x: MatchItem, y: MatchItem) => urgency(x.next) - urgency(y.next) || RANK[x.status] - RANK[y.status];
  return {
    items: all.filter((i) => i.status !== "対象外の見込み").sort(sorter),
    excluded: all.filter((i) => i.status === "対象外の見込み"),
    showDropin: a.work === "dropin" || a.work === "undecided",
  };
}

/* ───────── 送られてきた答えを確かめる（サーバ側） ───────── */

const pickId = <T extends readonly Opt[]>(list: T, v: unknown): T[number]["id"] | null =>
  typeof v === "string" && list.some((o) => o.id === v) ? (v as T[number]["id"]) : null;

const readMan = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,，\s]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n * 10) / 10 : null;
};

export function readCheckAnswers(raw: unknown): CheckAnswers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const pref = pickId(CHECK_PREFS, o.pref);
  const facility = pickId(CHECK_FACILITIES, o.facility);
  const corp = pickId(CHECK_CORPS, o.corp);
  const staff = pickId(CHECK_STAFF, o.staff);
  const work = pickId(CHECK_WORKS, o.work);
  if (!pref || !facility || !corp || !staff || !work) return null;
  const capacity = asksCapacity(facility) ? pickId(CHECK_CAPACITIES, o.capacity) : null;
  if (asksCapacity(facility) && !capacity) return null;
  const costMan = readMan(o.costMan);
  const equipmentMan = readMan(o.equipmentMan);
  return { pref, facility, capacity, corp, staff, work, costMan, equipmentMan: equipmentMan !== null && costMan !== null && equipmentMan > costMan ? null : equipmentMan };
}

/** 担当者宛メールと Notion のメモに書く答え */
export function checkAnswerLines(a: CheckAnswers): string[] {
  return [
    `所在地: ${labelOfOpt(CHECK_PREFS, a.pref)}`,
    `施設: ${labelOfOpt(CHECK_FACILITIES, a.facility)}${a.capacity ? `／定員: ${labelOfOpt(CHECK_CAPACITIES, a.capacity)}` : ""}`,
    `法人: ${labelOfOpt(CHECK_CORPS, a.corp)}／従業員: ${labelOfOpt(CHECK_STAFF, a.staff)}`,
    `工事: ${labelOfOpt(CHECK_WORKS, a.work)}`,
    `工事費の目安: ${a.costMan !== null ? `${a.costMan.toLocaleString("ja-JP")}万円（税抜）` : "未入力"}${a.equipmentMan !== null ? `／うち機器代 ${a.equipmentMan.toLocaleString("ja-JP")}万円` : ""}`,
  ];
}

/** 担当者宛メールと Notion のメモに書く判定（画面に出したものと同じ） */
export function matchLines(r: MatchResult): string[] {
  const line = (i: MatchItem) => {
    const est = i.estimate.kind === "ok" ? `／目安 ${i.estimate.lines.map((l) => `${l.label} 最大${l.subsidyMan.toLocaleString("ja-JP")}万円`).join("・")}` : "";
    return `・[${i.status}] ${i.program.tag} ${i.program.title}（${i.program.rate.value}）${est}`;
  };
  return [...r.items.map(line), ...r.excluded.map(line), ...(r.showDropin ? ["・[別の選択肢] ドロップイン（補助を使わない進め方）"] : [])];
}
