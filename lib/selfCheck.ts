/* ───────────────────────────────────────────────────────────
   適合チェック（お客様ご自身での確認）2026-09-25

   ■ 何をするか
   　　第3段階で、可能性の高い制度ごとに「この制度に合うか、今確認する」を出し、
   　　お客様にしか答えられない要件を2〜3問だけ伺って、その場で結果を1行で返す。
   　　伺うのは、制度の必須要件のうち自分で確かめられるものだけ:
   　　　・契約・発注はまだか（交付決定前の着手は多くの制度で対象外）
   　　　・資本金と従業員数を書類で示せるか（中小企業などの区分の裏付け）
   　　　・SII の補助事業ポータルに登録済みか（SII の2制度だけ）
   　　型番（対象製品一覧）・省エネ量の計算・申請枠は EHC が確認するので、問いにしない。

   ■ 判定を二重に持たない
   　　回答は MatchInput（contractStatus / sizeDocs / siiPortal）へ入り、
   　　適合度は lib/eligibility.ts がこれまでどおり1本で判定する。
   　　ここが持つのは「どの問いを出すか」と、適合度・回答・締切の見通しを
   　　1行の言葉にまとめることだけ。要件の条件式はここに書かない。
   ─────────────────────────────────────────────────────────── */

import type { SelfAnswer, Subsidy } from "./types";
import type { FitLevel5 } from "./eligibility";
import type { PrepVerdict } from "./prep";
import type { ContractAnswer } from "./diagnosisState";

export type SelfCheckKey = "contract" | "sizeDocs" | "siiPortal";

export interface SelfCheckAnswers {
  contract: ContractAnswer | null;
  sizeDocs: SelfAnswer | null;
  siiPortal: SelfAnswer | null;
}

export interface SelfCheckOption {
  value: string;
  label: string;
}

export interface SelfCheckQuestion {
  key: SelfCheckKey;
  title: string;
  help: string;
  options: SelfCheckOption[];
}

export const SELF_CHECK_QUESTIONS: Record<SelfCheckKey, SelfCheckQuestion> = {
  contract: {
    key: "contract",
    title: "この工事の契約・発注は、まだですか？",
    help: "多くの制度は、交付決定（補助金を出すと決まる通知）より前に契約・発注・着工すると対象外になります。",
    options: [
      { value: "not_yet", label: "まだ契約・発注していない" },
      { value: "quoting", label: "見積を取っているところ" },
      { value: "contracted", label: "もう契約・発注した" },
      { value: "unknown", label: "分からない" },
    ],
  },
  sizeDocs: {
    key: "sizeDocs",
    title: "資本金と従業員数を、書類で示せますか？",
    help: "中小企業などの区分は、決算書・登記事項証明書（資本金）と、賃金台帳など（常時使用する従業員数）で確かめられます。",
    options: [
      { value: "yes", label: "示せる" },
      { value: "no", label: "示せない" },
      { value: "unknown", label: "分からない" },
    ],
  },
  siiPortal: {
    key: "siiPortal",
    title: "SII の「補助事業ポータル」に、事業者登録していますか？",
    help: "SII の省エネ補助金は、申請書類をこのポータルの上で作ります。登録（ID発行）には日数がかかることがあります。",
    options: [
      { value: "yes", label: "登録している" },
      { value: "no", label: "まだ" },
      { value: "unknown", label: "分からない" },
    ],
  },
};

const SII_IDS = new Set(["sii_iv", "sii_gx"]);

/** 空調設備の補助制度か（情報提供のみの制度・雇用系の助成金には、この確認を出さない） */
export function isEquipmentProgram(s: Subsidy): boolean {
  return (s.programCategory ?? "equipment") === "equipment" && !s.infoOnly;
}

/** この制度で伺う問い。空なら、この制度には確認を出さない */
export function selfCheckKeysFor(s: Subsidy): SelfCheckKey[] {
  if (!isEquipmentProgram(s)) return [];
  const keys: SelfCheckKey[] = ["contract", "sizeDocs"];
  if (SII_IDS.has(s.id)) keys.push("siiPortal");
  return keys;
}

/** お客様ではなく EHC が確認すること（lib/eligibility.ts の必須要件のうち、お客様が答えられないもの） */
export function ehcCheckItemsFor(s: Subsidy): string[] {
  if (!isEquipmentProgram(s)) return [];
  const items = ["導入する機種が、この制度の対象製品の一覧に載っているか（型番の照合）"];
  if (SII_IDS.has(s.id)) items.push("省エネ量の要件（原油換算）を満たすかの計算");
  if (s.id === "sii_gx") items.push("申請する枠（メーカー強化枠／トップ性能枠）の決定");
  if (!SII_IDS.has(s.id)) items.push("この制度の公募要領にある個別の条件");
  return items;
}

export type SelfCheckItemState = "ok" | "warn" | "todo";

export interface SelfCheckItem {
  key: SelfCheckKey;
  question: string;
  answer: string;
  state: SelfCheckItemState;
  note: string | null;
}

export type SelfCheckOutcome = "ng" | "warn" | "wait" | "todo" | "next_round" | "ok";

export interface SelfCheckResult {
  outcome: SelfCheckOutcome;
  headline: string;
  detail: string;
  items: SelfCheckItem[];
  /** まだ確認が必要な問いの数（未回答・分からない・ポータル未登録） */
  remaining: number;
  /** 1問でも答えたか */
  started: boolean;
  ehcItems: string[];
}

const optionLabel = (key: SelfCheckKey, value: string | null): string =>
  value == null ? "未回答" : SELF_CHECK_QUESTIONS[key].options.find((o) => o.value === value)?.label ?? value;

function itemFor(key: SelfCheckKey, answers: SelfCheckAnswers): SelfCheckItem {
  const q = SELF_CHECK_QUESTIONS[key];
  if (key === "contract") {
    const v = answers.contract;
    if (v === "not_yet" || v === "quoting")
      return { key, question: q.title, answer: optionLabel(key, v), state: "ok", note: "交付決定の通知を受けるまで、契約・発注・着工はしないでください。" };
    if (v === "contracted")
      return { key, question: q.title, answer: optionLabel(key, v), state: "warn", note: "交付決定より前の契約・発注は、多くの制度で対象外になります。契約日と交付決定日の前後を担当者と確認しましょう。" };
    return { key, question: q.title, answer: optionLabel(key, v), state: "todo", note: null };
  }
  if (key === "sizeDocs") {
    const v = answers.sizeDocs;
    if (v === "yes") return { key, question: q.title, answer: optionLabel(key, v), state: "ok", note: "申請のときに提出します。" };
    if (v === "no") return { key, question: q.title, answer: optionLabel(key, v), state: "warn", note: "中小企業などの区分を書類で示せないと、申請できない場合があります。" };
    return { key, question: q.title, answer: optionLabel(key, v), state: "todo", note: null };
  }
  const v = answers.siiPortal;
  if (v === "yes") return { key, question: q.title, answer: optionLabel(key, v), state: "ok", note: null };
  if (v === "no") return { key, question: q.title, answer: optionLabel(key, v), state: "todo", note: "申請の前に登録が必要です。締切から逆算して早めに進めましょう。" };
  return { key, question: q.title, answer: optionLabel(key, v), state: "todo", note: null };
}

/**
 * その場で出す結果。優先順は「今回はだめ」→「だめになりそう」→「制度側の発表待ち」
 * →「あと少し確認」→「今回の締切には間に合わない」→「自分で確かめられる条件は満たす」。
 */
export function evaluateSelfCheck(args: {
  subsidy: Subsidy;
  fitLevel: FitLevel5;
  fitWhy: string[];
  answers: SelfCheckAnswers;
  prepVerdict: PrepVerdict | null;
}): SelfCheckResult {
  const { subsidy, fitLevel, fitWhy, answers, prepVerdict } = args;
  const keys = selfCheckKeysFor(subsidy);
  const items = keys.map((k) => itemFor(k, answers));
  const ehcItems = ehcCheckItemsFor(subsidy);
  const remaining = items.filter((i) => i.state === "todo").length;
  const started = keys.some((k) => answers[k] != null);
  const warn = items.find((i) => i.state === "warn");

  if (fitLevel === "not_possible") {
    return { outcome: "ng", headline: "今回は対象外です", detail: fitWhy[0] ?? "要件と合わない点があります。", items, remaining, started, ehcItems };
  }
  if (warn) {
    return { outcome: "warn", headline: "対象外になる可能性が高いです", detail: warn.note ?? "", items, remaining, started, ehcItems };
  }
  if (fitLevel === "on_hold") {
    return {
      outcome: "wait",
      headline: "制度の発表を待っている状態です",
      detail: "公募要領や公式の情報が出たところで確定します。いまのご回答は、そのときの判定に使います。",
      items, remaining, started, ehcItems,
    };
  }
  if (remaining > 0) {
    const onlyPortal = remaining === 1 && items.some((i) => i.key === "siiPortal" && i.state === "todo" && answers.siiPortal === "no");
    return {
      outcome: "todo",
      headline: onlyPortal ? "申請の前に、補助事業ポータルへの登録が必要です" : `あと${remaining}点、ご確認ください`,
      detail: onlyPortal
        ? "ほかの、ご自身で確かめられる条件は満たしています。"
        : "「分からない」「未回答」の項目が分かると、この制度に合うかをもう一歩はっきりさせられます。",
      items, remaining, started, ehcItems,
    };
  }
  if (prepVerdict === "short") {
    return {
      outcome: "next_round",
      headline: "条件は合う見込みです。ただし今回の締切には間に合わない見込みです",
      detail: "次回の公募に向けて、今から書類の準備を始められます。",
      items, remaining, started, ehcItems,
    };
  }
  return {
    outcome: "ok",
    headline: "ご自身で確かめられる条件は、満たしています",
    detail:
      fitLevel === "low"
        ? "ご入力の設備のうち、一部だけがこの制度の対象です。残りは EHC が確認します。"
        : "残りは EHC が確認します（下の項目）。",
    items, remaining, started, ehcItems,
  };
}
