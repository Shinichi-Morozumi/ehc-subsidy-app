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
/** Zoomからの戻り通知を失った場合も、確認メールの管理URLから同じ予約だけ復旧する。 */
export async function recoverZoomBooking(manageUrl: unknown, email: string | null | undefined): Promise<ZoomBooking> {
  let attendeeId = "";
  try {
    const u = new URL(String(manageUrl));
    if (u.protocol !== "https:" || u.hostname !== "scheduler.zoom.us" || u.username || u.password || u.search || u.hash) throw new Error();
    attendeeId = u.pathname.match(/^\/manage\/([a-zA-Z0-9_-]{8,160})\/?$/)?.[1] || "";
  } catch { /* 定型URL以外へ通信しない。 */ }
  if (!attendeeId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Zoomの確認メールにある予約管理URLと、予約時のメールアドレスを入力してください。");
  const token = await zoomToken();
  const query = new URLSearchParams({ from: new Date().toISOString(), to: new Date(Date.now() + 90 * 86400000).toISOString(), search: ZOOM_BOOKING_TITLE, page_size: "100", show_deleted: "false" });
  const matches: string[] = [];
  for (let page = 0; page < 3; page++) {
    const r = await fetch(`https://api.zoom.us/v2/scheduler/events?${query}`, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("予約一覧との照合を確認できません。予約は作り直さず、担当へご連絡ください。");
    const d = await r.json();
    if (!Array.isArray(d.items)) throw new Error("予約の確認に失敗しました。");
    for (const item of d.items) {
      if (item.schedule_id === process.env.ZOOM_EHC_SCHEDULE_ID && item.summary === ZOOM_BOOKING_TITLE && item.status === "confirmed" && Array.isArray(item.attendees) && item.attendees.some((a: { attendee_id?: string; email?: string; booker?: boolean }) => a.attendee_id === attendeeId && a.booker === true && a.email?.toLowerCase() === email.trim().toLowerCase())) matches.push(item.event_id);
    }
    if (!d.next_page_token) break;
    if (page === 2) throw new Error("予約件数が多いため照合を完了できません。担当へご連絡ください。");
    query.set("next_page_token", d.next_page_token);
  }
  if (matches.length !== 1) throw new Error("EHCの有効な予約とメールアドレスの一致を確認できません。予約は作り直さず、担当へご確認ください。");
  return verifyZoomBooking({ eventId: matches[0], attendeeId }, email);
}
/** EHC-0150：予約画面からの戻り通知が届かない端末向け。予約と同じメールアドレスで、これからのEHCの予約を1件だけ探す。
    参加URLは画面へ返さない（送信時にサーバで同じ予約を照合し直し、担当者宛メールとNotionにだけ載せる）。
    同じメールで予約が2件以上あるときは、取り違えないよう確定しない。 */
export async function findZoomBookingByEmail(email: string | null | undefined): Promise<ZoomBooking> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Zoomの予約と同じメールアドレスをご入力ください。");
  const mail = email.trim().toLowerCase();
  const token = await zoomToken();
  const query = new URLSearchParams({ from: new Date().toISOString(), to: new Date(Date.now() + 90 * 86400000).toISOString(), search: ZOOM_BOOKING_TITLE, page_size: "100", show_deleted: "false" });
  const matches: { eventId: string; attendeeId: string }[] = [];
  for (let page = 0; page < 3; page++) {
    const r = await fetch(`https://api.zoom.us/v2/scheduler/events?${query}`, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("予約の確認ができません。予約は作り直さず、少し待ってからもう一度押してください。");
    const d = await r.json();
    if (!Array.isArray(d.items)) throw new Error("予約の確認に失敗しました。");
    for (const item of d.items) {
      if (item.schedule_id !== process.env.ZOOM_EHC_SCHEDULE_ID || item.summary !== ZOOM_BOOKING_TITLE || item.status !== "confirmed" || !Array.isArray(item.attendees)) continue;
      const a = item.attendees.find((x: { attendee_id?: string; email?: string; booker?: boolean }) => x.booker === true && x.email?.toLowerCase() === mail && typeof x.attendee_id === "string");
      if (a && typeof item.event_id === "string") matches.push({ eventId: item.event_id, attendeeId: a.attendee_id });
    }
    if (!d.next_page_token) break;
    if (page === 2) throw new Error("予約件数が多いため確認を完了できません。担当へご連絡ください。");
    query.set("next_page_token", d.next_page_token);
  }
  if (matches.length === 0) throw new Error("このメールアドレスの予約が見つかりません。予約画面で「予約」を最後まで押したか、同じメールアドレスかをご確認ください。");
  if (matches.length > 1) throw new Error("このメールアドレスで予約が2件以上あります。Zoomの確認メールにある予約管理URLで照合してください。");
  const verified = await verifyZoomBooking(matches[0], email);
  return { eventId: verified.eventId, attendeeId: verified.attendeeId, start: verified.start, end: verified.end };
}
export async function resolveConsultation(c: ConsultationRequest | null | undefined, email: string | null | undefined): Promise<ConsultationRequest | null> {
  return c?.booking ? { mode: "zoom", timezone: "Asia/Tokyo", booking: await verifyZoomBooking(c.booking, email) } : c ?? null;
}
