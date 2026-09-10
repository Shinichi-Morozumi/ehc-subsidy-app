/* 2026-09-08 EHC-0028:
   建物用途・冷媒の表示名は CustomerReport.tsx の中に直書きされていた。
   印刷専用シート（ReportPrintSheet.tsx）でも同じ名前を出す必要があるので、
   文言を二重に持たないようここへ移した。表示名を変えるときはこの1箇所だけを直す。 */

export const BUILDING_LABELS: Record<string, string> = {
  office: "オフィス・事務所",
  retail: "小売店舗",
  restaurant: "飲食店",
  hotel: "ホテル・宿泊",
  medical: "医療・福祉",
  school: "学校・教育",
  other: "その他事業所",
};

export const REFRI_LABELS: Record<string, string> = {
  r22: "R22（HCFC・製造禁止）",
  r410a: "R410A（HFC・廃止進行中）",
  r32: "R32（GWP675）",
  unknown: "不明",
};
