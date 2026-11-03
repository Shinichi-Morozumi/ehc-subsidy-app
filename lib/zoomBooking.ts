// EHC-0124: 公開URLだけ。認証情報はサーバ側に限定する。
export const ZOOM_BOOKING_URL = "https://scheduler.zoom.us/shinichi-morozumi-gcqg8b/ehc-consultation";
export const ZOOM_BOOKING_TITLE = "EHC 空調・補助金のZoom相談（30分）";
export interface ZoomBooking {
  eventId: string; attendeeId: string;
  start?: string; end?: string; joinUrl?: string;
}
export function readZoomBooking(raw: unknown): ZoomBooking | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const valid = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-]{8,160}$/.test(v);
  if (!valid(r.eventId) || !valid(r.attendeeId)) return null;
  return { eventId: r.eventId, attendeeId: r.attendeeId,
    ...(typeof r.start === "string" && Number.isFinite(Date.parse(r.start)) ? { start: r.start } : {}),
    ...(typeof r.end === "string" && Number.isFinite(Date.parse(r.end)) ? { end: r.end } : {}),
    ...(typeof r.joinUrl === "string" && /^https:\/\/[a-z0-9.-]*zoom\.us\//i.test(r.joinUrl) ? { joinUrl: r.joinUrl } : {}) };
}
export const bookingDate = (s: string) => new Date(s).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
