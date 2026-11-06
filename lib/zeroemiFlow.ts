/* ───────────────────────────────────────────────────────────
   v1 / 2026-11-06 / EHC-0150 ゼロエミ専用ページ（広告の遷移先・東京都内の事業者向け）の決め事
   ・/zeroemi（空調）と /zeroemi/reizo（冷凍冷蔵庫・ショーケース）。本人の指示「空調と冷凍冷蔵ページは分ける」。
   ・流れ：4問の簡易診断 → 結果と助成の目安 → そのまま問い合わせ。
     Zoom面談を希望するなら空き枠から予約（Zoomで照合）、希望しないなら電話かメールで折り返し。
   ・ここで出すのは「使える見込み」と「目安」。採択・金額・対象の確定はしない（景表法・要綱の確認が先）。
   ・数字の出典：クール・ネット東京（ゼロエミ・2026-11-06確認）／東京都環境公社（ノンフロン・2026-11-06確認）。
   ─────────────────────────────────────────────────────────── */

import { PROGRAMS, PREP_DAYS, upcomingWindows, type ProgramWindow } from "./programs";
import { daysBetween } from "./programClock";

export type ZeroemiKind = "kucho" | "reizo";
export const ZEROEMI_KINDS = ["kucho", "reizo"] as const;
export type ZeroemiContact = "zoom" | "callback";

export const ZE_PLACES = [
  { id: "tokyo", label: "東京都内" },
  { id: "other", label: "東京都の外" },
] as const;
export type ZePlace = (typeof ZE_PLACES)[number]["id"];

export const ZE_ORGS = [
  { id: "sme", label: "中小企業・個人事業主" },
  { id: "corp", label: "医療法人・社会福祉法人・学校法人など" },
  { id: "large", label: "大企業、または大企業が株式の半分以上を持つ会社" },
  { id: "unknown", label: "分からない" },
] as const;
export type ZeOrg = (typeof ZE_ORGS)[number]["id"];

export const ZE_EQUIP = {
  kucho: [
    { id: "ac", label: "空調（業務用エアコン）" },
    { id: "vent", label: "換気（全熱交換器など）" },
    { id: "light", label: "LED照明" },
    { id: "water", label: "給湯・ボイラー" },
    { id: "other", label: "その他（変圧器・断熱窓など）" },
  ],
  reizo: [
    { id: "sc_in", label: "内蔵型ショーケース（コンセント式）" },
    { id: "sc_out", label: "別置型ショーケース（冷凍機が別）" },
    { id: "unit", label: "プレハブ冷蔵庫・冷凍庫の冷凍機" },
    { id: "fridge", label: "業務用冷凍冷蔵庫・コールドテーブル" },
    { id: "chiller", label: "チリングユニット" },
    { id: "unknown", label: "まだ分からない" },
  ],
} as const;

export const ZE_BUDGETS = [
  { id: "lt500", label: "500万円未満", min: 0, max: 500 },
  { id: "500", label: "500万〜1,000万円", min: 500, max: 1000 },
  { id: "1000", label: "1,000万〜3,000万円", min: 1000, max: 3000 },
  { id: "3000", label: "3,000万円以上", min: 3000, max: null },
  { id: "unknown", label: "まだ分からない", min: null, max: null },
] as const;
export type ZeBudget = (typeof ZE_BUDGETS)[number]["id"];

/** ノンフロン機器の申請受付の終わり（東京都環境公社・令和8年度。予算に達したらその時点で終了） */
export const NONFURON_END = "2027-03-31";
export const NONFURON_URL = "https://www.tokyokankyo.jp/apply/nonfuron/nonfuron-r8/";
/** ゼロエミの工事完了届の最終提出期限（第5回・第6回とも。クール・ネット東京） */
export const ZEROEMI_REPORT_END = "2027-11-30";

export interface ZeroemiAnswers {
  kind: ZeroemiKind;
  place: ZePlace;
  city: string;
  org: ZeOrg;
  equip: string[];
  budget: ZeBudget;
}

export interface ZeroemiMark {
  name: string;
  mark: "○" | "△" | "×";
  note: string;
}

export interface ZeroemiJudge {
  level: "likely" | "check" | "other";
  title: string;
  reason: string;
  marks: ZeroemiMark[];
  /** 助成の目安（万円）。予算が分からない・対象外なら null */
  estimate: { min: number; max: number | null; text: string; note: string } | null;
}

const labelOf = (list: readonly { readonly id: string; readonly label: string }[], id: string): string => list.find((x) => x.id === id)?.label ?? id;

/** 万円を「1,500万円」の形に */
const man = (v: number) => `${Math.round(v).toLocaleString("ja-JP")}万円`;

function rangeText(min: number, max: number | null): string {
  if (max === null) return `${man(min)}〜`;
  if (min <= 0) return `〜${man(max)}`;
  if (Math.round(min) === Math.round(max)) return man(max);
  return `${Math.round(min).toLocaleString("ja-JP")}万〜${man(max)}`;
}

/** 簡易診断の判定。使える見込みと目安だけを出す（確定はしない）。 */
export function judgeZeroemi(a: ZeroemiAnswers): ZeroemiJudge {
  const b = ZE_BUDGETS.find((x) => x.id === a.budget) ?? ZE_BUDGETS[4];
  if (a.place !== "tokyo") {
    return {
      level: "other",
      title: "東京都の外の工事は、ゼロエミの対象外です",
      reason: "ゼロエミは都内の事業所が対象です。国の省エネ補助金（SII）など、工事場所で使える制度があるか一緒に確かめます。このままご相談ください。",
      marks: [{ name: "東京都のゼロエミ", mark: "×", note: "都内の事業所が対象" }],
      estimate: null,
    };
  }
  if (a.kind === "kucho") {
    if (a.org === "large") {
      return {
        level: "other",
        title: "大企業は、ゼロエミの対象外です",
        reason: "ゼロエミは中小企業・医療法人・社会福祉法人などが対象です。国の省エネ補助金（SII）など、ほかの制度を一緒に確かめます。",
        marks: [{ name: "東京都のゼロエミ", mark: "×", note: "中小企業等が対象" }],
        estimate: null,
      };
    }
    const est = b.min === null ? null : {
      min: Math.min(b.min * 2 / 3, 1000),
      max: b.max === null ? 4500 : Math.min(b.max * 3 / 4, 4500),
    };
    return {
      level: "likely",
      title: "ゼロエミが使える見込みがあります",
      reason: a.org === "unknown"
        ? "会社の区分（中小企業等か）を確かめたうえで、CO2をどれだけ減らせるかで助成の割合（3/4か2/3）が決まります。現地で今の設備と電気の使い方を確かめます。"
        : "CO2をどれだけ減らせるかで、助成の割合（3/4か2/3）と上限が決まります。現地で今の設備と電気の使い方を確かめ、どの区分になるかをお伝えします。",
      marks: [{ name: "東京都のゼロエミ", mark: a.org === "unknown" ? "△" : "○", note: "空調・換気・照明・給湯などの入れ替え" }],
      estimate: est ? {
        ...est,
        text: rangeText(est.min, est.max),
        note: "補助の対象になる費用（税抜）がこの予算の場合の目安です。年28トン以上減らすなら3/4（上限4,500万円）、それ以外は2/3（上限2,500万円か1,000万円）。撤去・処分費と消費税は対象外です。",
      } : null,
    };
  }
  // 冷凍冷蔵：機械ごとに【1】ゼロエミ・【2】ノンフロンの見込みを出す（EHC-0136 の早見表と同じ）
  const ze: Record<string, ZeroemiMark["mark"]> = { sc_in: "○", sc_out: "○", unit: "○", fridge: "△", chiller: "△", unknown: "△" };
  const nf: Record<string, ZeroemiMark["mark"]> = { sc_in: "○", sc_out: "○", unit: "○", fridge: "×", chiller: "○", unknown: "△" };
  const best = (m: Record<string, ZeroemiMark["mark"]>): ZeroemiMark["mark"] => {
    const marks = (a.equip.length ? a.equip : ["unknown"]).map((e) => m[e] ?? "△");
    return marks.includes("○") ? "○" : marks.includes("△") ? "△" : "×";
  };
  const zeMark: ZeroemiMark["mark"] = a.org === "large" ? "×" : a.org === "unknown" && best(ze) === "○" ? "△" : best(ze);
  const nfMark = best(nf);
  const marks: ZeroemiMark[] = [
    { name: "【1】ゼロエミ（省エネの機械へ）", mark: zeMark, note: a.org === "large" ? "中小企業等が対象" : "インバータ圧縮機などの省エネ機種への入れ替え" },
    { name: "【2】ノンフロン機器（フロンを使わない機械へ）", mark: nfMark, note: "自然冷媒の機種。業務用冷凍冷蔵庫・コールドテーブルは対象外" },
  ];
  const level: ZeroemiJudge["level"] = marks.some((m) => m.mark === "○") ? "likely" : marks.some((m) => m.mark === "△") ? "check" : "other";
  const large = a.org === "large";
  const rateLow = large ? 1 / 2 : 2 / 3;
  const rateHigh = large ? 1 / 2 : zeMark === "×" ? 2 / 3 : 3 / 4;
  const est = b.min === null || level === "other" ? null : { min: b.min * rateLow, max: b.max === null ? null : b.max * rateHigh };
  return {
    level,
    title: level === "likely" ? (large ? "ノンフロン機器の助成が使える見込みがあります" : "ゼロエミかノンフロンの助成が使える見込みがあります")
      : level === "check" ? "機種しだいで、使える見込みがあります" : "選んだ機械は、2つの制度の対象外の見込みです",
    reason: level === "other"
      ? "業務用冷凍冷蔵庫・コールドテーブルは、ノンフロンの対象外です。大企業はゼロエミの対象外です。ほかの方法も含めてご相談ください。"
      : "同じ機械に2つの制度は使えません。今の機械・冷媒・電気の使い方を現地で見て、どちらが合うかと、助成の目安をお伝えします。",
    marks,
    estimate: est ? {
      ...est,
      text: rangeText(est.min, est.max),
      note: large
        ? "大企業はノンフロン機器の助成（1/2）だけです。上限は機械1台ごとに決まっています。"
        : "ゼロエミは最大3/4（上限4,500万円）、ノンフロンは2/3（上限は機械1台ごと）。予算が補助の対象になる費用（税抜）の場合の目安です。",
    } : null,
  };
}

/** これから準備するならどの回か（締切まで準備の日数がある最初の回）。無ければ最後の回。 */
export function zeroemiTargetWindow(today: string): { target: ProgramWindow | null; tooSoon: ProgramWindow | null } {
  const ws = upcomingWindows(PROGRAMS.tokyoZeroemi, today);
  const target = ws.find((w) => daysBetween(today, w.end) >= PREP_DAYS) ?? null;
  const tooSoon = ws.find((w) => daysBetween(today, w.end) < PREP_DAYS) ?? null;
  return { target, tooSoon };
}

/* ───────── 送信の確かめ（サーバ側） ───────── */

export interface ZeroemiLead {
  kind: ZeroemiKind;
  answers: ZeroemiAnswers;
  contact: ZeroemiContact;
  campaign: string | null;
  test: boolean;
}

const CITY_BAD = /[\u0000-\u001f<>]/;

export function readZeroemiAnswers(raw: unknown): ZeroemiAnswers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!(ZEROEMI_KINDS as readonly unknown[]).includes(r.kind)) return null;
  const kind = r.kind as ZeroemiKind;
  if (!ZE_PLACES.some((x) => x.id === r.place)) return null;
  if (!ZE_ORGS.some((x) => x.id === r.org)) return null;
  if (!ZE_BUDGETS.some((x) => x.id === r.budget)) return null;
  const city = typeof r.city === "string" ? r.city.trim() : "";
  if (city.length > 60 || CITY_BAD.test(city)) return null;
  if (r.place === "tokyo" && !city) return null;
  const allowed = ZE_EQUIP[kind].map((x) => x.id as string);
  const equip = Array.isArray(r.equip) ? Array.from(new Set(r.equip.filter((e): e is string => typeof e === "string" && allowed.includes(e)))).slice(0, 6) : [];
  if (!equip.length) return null;
  return { kind, place: r.place as ZePlace, city, org: r.org as ZeOrg, equip, budget: r.budget as ZeBudget };
}

export function readZeroemiLead(raw: unknown): { value: ZeroemiLead | null; error: string | null } {
  if (raw == null) return { value: null, error: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { value: null, error: "簡易診断の答えを確認できません。ページを開き直してください。" };
  const r = raw as Record<string, unknown>;
  const answers = readZeroemiAnswers(r.answers);
  if (!answers) return { value: null, error: "簡易診断の答え（工事場所・会社の区分・設備・予算）をご確認ください。" };
  if (r.contact !== "zoom" && r.contact !== "callback") return { value: null, error: "連絡の方法（Zoomで面談か、電話・メールで連絡か）をお選びください。" };
  const campaign = typeof r.campaign === "string" && /^[a-z0-9_]{1,60}$/.test(r.campaign) ? r.campaign : null;
  return { value: { kind: answers.kind, answers, contact: r.contact, campaign, test: r.test === true }, error: null };
}

/** 担当者宛メールと Notion のメモに載せる行 */
export function zeroemiLines(z: ZeroemiLead): string[] {
  const a = z.answers;
  const j = judgeZeroemi(a);
  return [
    ...(z.test ? ["【営業対象外・公開確認テスト／月次集計から除外】"] : []),
    `入口: ゼロエミ専用ページ（${z.kind === "kucho" ? "空調 /zeroemi" : "冷凍冷蔵 /zeroemi/reizo"}）`,
    `キャンペーン: ${z.campaign ?? "広告以外／未確認"}`,
    `連絡の方法: ${z.contact === "zoom" ? "Zoomで面談（空き枠から予約）" : "電話かメールで折り返し"}`,
    "簡易診断の答え:",
    `・工事場所: ${labelOf(ZE_PLACES, a.place)}${a.city ? ` ${a.city}` : ""}`,
    `・会社の区分: ${labelOf(ZE_ORGS, a.org)}`,
    `・入れ替える設備: ${a.equip.map((e) => labelOf(ZE_EQUIP[a.kind], e)).join("・")}`,
    `・予算の目安（税抜）: ${labelOf(ZE_BUDGETS, a.budget)}`,
    `画面に出した結果（確定ではない）: ${j.title}`,
    ...j.marks.map((m) => `・${m.mark} ${m.name}（${m.note}）`),
    ...(j.estimate ? [`・助成の目安: ${j.estimate.text}`] : []),
    "補助対象・補助額: 未確定。法人規模・所有関係・実機・CO2削減量の確認が必要。",
  ];
}
