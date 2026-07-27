/* ───────── 規制・法令の年号（唯一の情報源） ─────────
   ヒーローのカウントダウン（app/page.tsx）と業界トピックス（lib/weapons.ts）が
   それぞれ年号を直書きしていたため、片方だけ古くなる状態だった。ここを直せば両方に反映される。
   数字を更新したら REGULATION_ASOF も必ず更新すること。 */
export const REGULATION_ASOF = "2026年7月26日";

export const REGULATION = {
  /** フロン排出抑制法 改正案の国会提出予定年（罰則強化を検討中・確定情報ではない） */
  freonLawAmendmentYear: 2027,
  /** R410A 製造規制の完了年（2025年4月以降、業務用エアコンは低GWP冷媒のみ） */
  r410aPhaseOutYear: 2025,
  /** HFC段階削減 ▲70% の年（キガリ改正の国内スケジュール） */
  hfcCut70Year: 2029,
  /** キガリ改正 HFC 85%削減の目標年 */
  kigaliCut85Year: 2036,
  /** 業務用エアコンの法定耐用年数（年） */
  legalUsefulLifeYears: 15,
};

/* 改正案の提出予定年を過ぎたら「提出予定」という表現自体が誤りになる。
   その場合は断定を避けた文言に自動で切り替えるための判定。 */
export function freonLawOutlook(now: Date = new Date()) {
  const stale = now.getFullYear() > REGULATION.freonLawAmendmentYear;
  return {
    stale,
    /** 例: 「国会提出予定 2027年」／提出予定年を過ぎたら「改正動向（最新情報を要確認）」 */
    label: stale
      ? "改正動向（最新の審議状況をご確認ください）"
      : `国会提出予定 ${REGULATION.freonLawAmendmentYear}年`,
  };
}
