import { InterestType } from "./types";

/* ───────────────────────────────────────────────────────────
   公開時の機能フラグ（EHC-0031 / 2026-09-10 SHINICHI指示）

   「ドロップインは一旦非表示でいい／更新工事部分終わらせて」

   ドロップイン（冷媒だけ入替）の画面は、施工日・実測削減率の確認が
   社外依存（関根さん／EHC技術担当）で未了のため、公開時は出さない。
   理由:
   ・lib/pricing.ts の clampDropinRate は下限0.1のため、実測が
     「消費増（負値）」でも画面には「10%削減」と出てしまう。
     大塚倉庫の2025→2026 1〜8月は +2.6%（消費増）で、まさにこの状態。
   ・DROPIN_REFRI_RATE の unknown 既定 0.25 も、未確認を数値化してしまう。

   コードは削除しない。フラグを true に戻せば復帰できる状態で残す。
   復帰の条件は EHC-0033 §3 の符号規約（未確認=null／0%=0／増加=負値）への
   是正と、施工日の確定。
   ─────────────────────────────────────────────────────────── */
export const DROPIN_UI_ENABLED = false;

/** ご関心チップとして画面に出すか（保存済みの値は書き換えない） */
export const isInterestVisible = (i: InterestType): boolean =>
  i !== "dropin" || DROPIN_UI_ENABLED;

/**
 * 分岐・遷移先の判定に使うご関心。
 * 保存済みデータに interest==="dropin" が残っていても、非表示中は
 * 存在しないタブ（tab:"dropin"）へ案内したり、ドロップイン専用の
 * 工程表を出したりしないよう「更新工事」として扱う。
 * 表示ラベル（提案書の「ご関心」欄）は元の値のまま＝記録は書き換えない。
 */
export const effectiveInterest = (i?: InterestType | null): InterestType | undefined => {
  if (!i) return undefined;
  if (i === "dropin" && !DROPIN_UI_ENABLED) return "update";
  return i;
};
