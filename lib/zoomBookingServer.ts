import { readZoomBooking, ZOOM_BOOKING_TITLE, type ZoomBooking } from "./zoomBooking";
import type { ConsultationRequest } from "./consultation";
let cached: { token: string; until: number } | null = null;
async function zoomToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) throw new Error("予約確認の接続が準備中です。候補日時を3つ送る方法をお選びください。");
  const r = await fetch("https://zoom.us/oauth/token", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "account_credentials", account_id: ZOOM_ACCOUNT_ID }) });
  if (!r.ok) throw new Error("Zoomとの接続を確認できません。新しい予約を作らず、受付窓口へご連絡ください。");
  const d = await r.json();
  if (typeof d.access_token !== "string") throw new Error("予約確認に失敗しました。");
  cached = { token: d.access_token, until: Date.now() + Math.max(0, Math.min(Number(d.expires_in) || 0, 3600) - 60) * 1000 };
  return cached.token;
}
/** 画面から来た日時・URLは信用せず、Zoomの確定予約を再読取する。 */
export async function verifyZoomBooking(raw: unknown, email: string | null | undefined): Promise<ZoomBooking> {
  const b = readZoomBooking(raw);
  if (!b || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Zoomの予約と同じメールアドレスをご入力ください。");
  const token = await zoomToken();
  const r = await fetch(`https://api.zoom.us/v2/scheduler/events/${encodeURIComponent(b.eventId)}`, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("予約結果を確認できません。予約を重ねて作らず、少し待ってから確認してください。");
  const d = await r.json();
  const scheduleId = process.env.ZOOM_EHC_SCHEDULE_ID;
  const attendee = Array.isArray(d.attendees) && d.attendees.find((a: { attendee_id?: string; email?: string; booker?: boolean }) => a.attendee_id === b.attendeeId && a.email?.toLowerCase() === email.trim().toLowerCase() && a.booker === true);
  const joinUrl = d.external_location?.meeting_join_url;
  let safeJoin = false;
  try { const u = new URL(joinUrl); safeJoin = u.protocol === "https:" && (u.hostname === "zoom.us" || u.hostname.endsWith(".zoom.us")); } catch { /* reject */ }
  if (!scheduleId || d.schedule_id !== scheduleId || d.summary !== ZOOM_BOOKING_TITLE || d.status !== "confirmed" || d.external_location?.kind !== "zoom" || !attendee || !safeJoin ||
      !Number.isFinite(Date.parse(d.start_date_time)) || Date.parse(d.start_date_time) <= Date.now() || Date.parse(d.end_date_time) - Date.parse(d.start_date_time) !== 30 * 60000) {
    throw new Error("EHCの有効な30分予約とメールアドレスが一致しません。予約済みの場合は作り直さず、担当へご確認ください。");
  }
  return { ...b, start: d.start_date_time, end: d.end_date_time, joinUrl };
}
export async function resolveConsultation(c: ConsultationRequest | null | undefined, email: string | null | undefined): Promise<ConsultationRequest | null> {
  return c?.booking ? { mode: "zoom", timezone: "Asia/Tokyo", booking: await verifyZoomBooking(c.booking, email) } : c ?? null;
}
