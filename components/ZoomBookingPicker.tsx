"use client";
import { useEffect, useRef, useState } from "react";
import { ZOOM_BOOKING_URL, bookingDate, readZoomBooking, type ZoomBooking } from "@/lib/zoomBooking";
export default function ZoomBookingPicker({ email, booking, onChange }: { email: string; booking: ZoomBooking | null; onChange: (booking: ZoomBooking | null) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<ZoomBooking | null>(null);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const verify = async (b: ZoomBooking) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/zoom-booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking: b, email: email.trim() }) });
      const d = await r.json();
      if (!r.ok || !d.ok || !d.booking?.start) throw new Error(d.error || "予約を確認できません。");
      onChange(d.booking); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "通信を確認できません。予約を作り直さず、確認ボタンをお使いください。"); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== "https://scheduler.zoom.us" || event.source !== frame.current?.contentWindow || event.data?.type !== "bookingForm") return;
      const b = readZoomBooking({ eventId: event.data.payload?.scheduledEventId, attendeeId: event.data.payload?.attendeeId });
      if (!b || pending.current?.eventId === b.eventId) return;
      pending.current = b; void verify(b);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [email, onChange]); // 連絡先を変えた場合は最終送信時にもサーバで一致確認する
  const src = `${ZOOM_BOOKING_URL}?embed=true&origin=${encodeURIComponent(typeof window === "undefined" ? "https://ehcjpn.com" : window.location.origin)}`;
  return <div className="mb-4 rounded-xl border border-brand/30 bg-white p-4">
    <p className="font-bold text-brand-deep">空き枠からZoom相談を予約する</p>
    {booking?.start ? <p role="status" className="mt-2 text-[15px] leading-relaxed">予約済み：{bookingDate(booking.start)}（日本時間）<br />Zoomの確認メールもご確認ください。下の相談内容を送ると、担当者の顧客記録と結びつきます。</p> : <>
      <p className="mt-2 text-[14px] leading-relaxed">EHCカレンダーの空き枠から30分を選べます。上の連絡先にはメールアドレスを入力し、予約画面でも同じものをお使いください。</p>
      <button type="button" disabled={!emailOk || busy} onClick={() => setOpen(true)} className="mt-3 min-h-[48px] rounded-xl bg-brand-deep px-4 py-2 text-[15px] font-bold text-white disabled:opacity-50">{busy ? "予約を確認しています…" : "空き枠を開く"}</button>
      {!emailOk && <p className="mt-2 text-[13px] text-ink-soft">メールアドレス入力後に開けます。電話での連絡をご希望なら、候補日時を3つお送りください。</p>}
    </>}
    {open && <div className="mt-4"><p className="mb-2 text-[13px] leading-relaxed">この中で「予約」を完了すると、予定がEHCカレンダーに登録され、Zoomの参加URLが届きます。</p><iframe ref={frame} title="EHCのZoom相談・空き枠と予約" src={src} className="h-[720px] w-full rounded-xl border-0" /><button type="button" onClick={() => setOpen(false)} className="min-h-[44px] text-[14px] underline">予約画面を閉じる</button></div>}
    {error && <p role="alert" className="mt-3 text-[14px] text-red-800">{error} {pending.current && <button type="button" disabled={busy} onClick={() => void verify(pending.current!)} className="min-h-[44px] font-bold underline">同じ予約の結果を再確認する</button>}</p>}
  </div>;
}
