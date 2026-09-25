/* ───────────────────────────────────────────────────────────
   補助額の計算に使う「設備投資額」を1本にする（2026-09-25 UXレビュー No.2）

   ■ 何が起きていたか
   　　「結果と根拠」の段は、入口の7問目で答えた金額（予算・見積額）で補助額を計算し、
   　　「概算費用と工事」の段は、入力した設備から概算（lib/pricing.ts）を出していた。
   　　7問目で500万円、概算が約209万円（税込）だと、約200万円の工事に
   　　約167万円（8割）の補助が出るように見え、どちらの数字が正しいか利用者には判断できない。
   　　画面には「一致していません」という注意が出るだけだった。

   ■ ここで決めること
   　　どちらの金額で計算するかを1つに決め、5段すべてが同じ MatchInput.invest を読むようにする。
   　　既定は「この診断の概算（税抜小計）」。概算が出せないときだけ7問目の金額を使う。
   　　利用者が「自分の見積額で計算する」を選んだときは、7問目の金額を使う。

   ■ ここで決めないこと
   　　金額の式は書かない。概算は lib/pricing.ts の estimateUpdateBreakdownGroups()、
   　　金額を出せる設備の条件は lib/diagnosisSnapshot.ts の pricedGroupsOf() だけを使う。
   　　ここで同じ条件を書き写すと、概算の段と補助額の段で「金額を出せる設備」が割れる。
   ─────────────────────────────────────────────────────────── */

import type { MatchInput } from "./types";
import { estimateUpdateBreakdownGroups } from "./pricing";
import { pricedGroupsOf } from "./diagnosisSnapshot";

/** estimate＝この診断の概算（税抜）／answer＝入口の7問目で答えた金額 */
export type InvestSource = "estimate" | "answer";

export interface InvestChoice {
  /** 実際に計算に使っている金額の出どころ。null はどちらも無い（未算定） */
  source: InvestSource | null;
  /** この診断の概算（税抜小計・円）。出せないときは null。0 にしない */
  estimateSubtotalYen: number | null;
  /** 7問目で答えた金額（万円・税抜）。未回答は null */
  answerManYen: number | null;
  /** 両方あり、1万円以上違う。画面はこのときだけ選択肢を出す */
  differs: boolean;
}

/** 概算の税抜小計（円）。金額を出せる設備が無ければ null */
export function estimateSubtotalYenOf(input: MatchInput | null): number | null {
  if (!input) return null;
  const priced = pricedGroupsOf(input.equipGroups);
  if (priced.length === 0) return null;
  const est = estimateUpdateBreakdownGroups(priced.map((g) => ({ units: g.units, hp: g.hp as number })));
  return Number.isFinite(est.subtotal) && est.subtotal > 0 ? est.subtotal : null;
}

export function resolveInvestChoice(input: MatchInput | null, preferred: InvestSource): InvestChoice {
  const estimateSubtotalYen = estimateSubtotalYenOf(input);
  const answer = input?.invest;
  const answerManYen = typeof answer === "number" && Number.isFinite(answer) && answer > 0 ? answer : null;

  let source: InvestSource | null = null;
  if (preferred === "answer") source = answerManYen != null ? "answer" : estimateSubtotalYen != null ? "estimate" : null;
  else source = estimateSubtotalYen != null ? "estimate" : answerManYen != null ? "answer" : null;

  const differs =
    estimateSubtotalYen != null &&
    answerManYen != null &&
    Math.abs(answerManYen * 10000 - estimateSubtotalYen) >= 10000;

  return { source, estimateSubtotalYen, answerManYen, differs };
}

/** 選んだ金額を invest に入れた MatchInput を返す。元の input は変えない */
export function applyInvestChoice(input: MatchInput, choice: InvestChoice): MatchInput {
  if (choice.source === "estimate" && choice.estimateSubtotalYen != null) {
    /* 概算は正式見積ではないので investQuoted は立てない（控えめな側。lib/roiState.ts の 4-B） */
    return { ...input, invest: choice.estimateSubtotalYen / 10000, investQuoted: false };
  }
  if (choice.source === "answer" && choice.answerManYen != null) {
    return { ...input, invest: choice.answerManYen };
  }
  /* どちらも無い。0 は lib/roiState.ts の resolveInvestState() で「未算定」になる */
  return { ...input, invest: 0 };
}

/** 画面に出す短い説明。金額は呼び出し側で整形済みの文字列を渡す */
export const INVEST_SOURCE_LABEL: Record<InvestSource, string> = {
  estimate: "この診断の概算（税抜）",
  answer: "お答えいただいた金額（税抜）",
};
