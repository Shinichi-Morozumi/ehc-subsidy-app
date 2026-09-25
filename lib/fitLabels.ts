import type { FitLevel5 } from "./eligibility";

/* 2026-09-25: 適合度の呼び名（UXレビュー No.7）を1か所に置く。
   画面（components/ResultStage.tsx）と、問い合わせに載せる要約（診断書PDF・担当者宛メール）が
   同じ語を使うため。判定そのものは lib/eligibility.ts の assessFit が持つ。 */
export const FIT_LABEL: Record<FitLevel5, string> = {
  high: "使える見込みが高い",
  possible: "条件次第",
  on_hold: "制度の発表待ち",
  low: "一部の設備だけ対象",
  not_possible: "今回は対象外",
};
