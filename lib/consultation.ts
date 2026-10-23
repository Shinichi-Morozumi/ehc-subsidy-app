// v1 / 2026-10-23 / EHC-0089: 予約の自動確定はしない。候補3件を受領して折り返す。
export interface ConsultationRequest {
  mode: "zoom";
  timezone: "Asia/Tokyo";
  preferredDates: [string, string, string];
}

export const CONSULTATION_GUIDE = "お打ち合わせはZoomが基本です。候補日時を3つ（日本時間）お知らせください。担当者が折り返し、日時とZoomのURLをご案内します。送信時点では予約は確定しません。";

/** datetime-local を端末のタイムゾーンではなく、明示した日本時間で検証する。 */
export function readConsultation(raw: unknown, now = new Date()): { value: ConsultationRequest | null; error: string | null } {
  if (raw == null) return { value: null, error: null }; // 古い画面からの再送を壊さない
  const r = raw as Partial<ConsultationRequest>;
  if (typeof raw !== "object" || Array.isArray(raw) || r.mode !== "zoom" || r.timezone !== "Asia/Tokyo" ||
      !Array.isArray(r.preferredDates) || r.preferredDates.length !== 3) {
    return { value: null, error: "Zoom相談の候補日時を3つ、日本時間でご入力ください。" };
  }
  const dates = r.preferredDates;
  for (const date of dates) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) {
      return { value: null, error: "第1〜第3希望の日時をすべてご入力ください。" };
    }
    const time = Date.parse(`${date}:00+09:00`);
    if (!Number.isFinite(time) || new Date(time + 9 * 3600000).toISOString().slice(0, 16) !== date || time <= now.getTime()) {
      return { value: null, error: "候補日時は、実在する未来の日時を日本時間でご入力ください。" };
    }
  }
  if (new Set(dates).size !== 3) return { value: null, error: "候補日時は重複しない3つをお知らせください。" };
  return { value: { mode: "zoom", timezone: "Asia/Tokyo", preferredDates: [...dates] as [string, string, string] }, error: null };
}

export function consultationLines(request?: ConsultationRequest | null): string[] {
  return request ? [
    "■ Zoom相談の候補日時（日本時間・予約未確定）",
    ...request.preferredDates.map((d, i) => `第${i + 1}希望: ${d.replace("T", " ")}`),
    "担当者が折り返し、日時とZoomのURLをご案内します。",
  ] : ["■ ご相談はZoomが基本です。候補日時3つを伺い、担当者が折り返して調整します（予約未確定）。"];
}
