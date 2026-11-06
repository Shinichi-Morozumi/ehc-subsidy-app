"use client";
import { useEffect, useRef, useState } from "react";
import { ZOOM_BOOKING_URL, bookingDate, readZoomBooking, type ZoomBooking } from "@/lib/zoomBooking";
export default function ZoomBookingPicker({ email, booking, onChange, fallbackHint }: { email: string; booking: ZoomBooking | null; onChange: (booking: ZoomBooking | null) => void; /** EHC-0150：予約しない人への案内（未指定なら従来の「候補日時を3つ」） */ fallbackHint?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageUrl, setManageUrl] = useState("");
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
  const recover = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/zoom-booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manageUrl: manageUrl.trim(), email: email.trim() }) });
      const d = await r.json();
      if (!r.ok || !d.ok || !d.booking?.start) throw new Error(d.error || "予約を確認できません。");
      pending.current = d.booking; onChange(d.booking); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "予約を作り直さず、少し待ってから確認してください。"); }
    finally { setBusy(false); }
  };
  /* EHC-0150：予約画面からの戻り通知が届かない端末でも、同じメールアドレスの予約を探して結び付ける（参加URLは画面に出さない） */
  const findByEmail = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/zoom-booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ findByEmail: true, email: email.trim() }) });
      const d = await r.json();
      if (!r.ok || !d.ok || !d.booking?.start) throw new Error(d.error || "予約を確認できません。");
      pending.current = d.booking; onChange(d.booking); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "予約を作り直さず、少し待ってからもう一度押してください。"); }
    finally { setBusy(false); }
  };
  return <div className="mb-4 rounded-xl border border-brand/30 bg-white p-4">
    <p className="font-bold text-brand-deep">空き枠からZoom相談を予約する</p>
    {booking?.start ? <p role="status" className="mt-2 text-[15px] leading-relaxed">予約済み：{bookingDate(booking.start)}（日本時間）<br />Zoomの確認メールもご確認ください。下の相談内容を送ると、担当者の顧客記録と結びつきます。</p> : <>
      <p className="mt-2 text-[14px] leading-relaxed">EHCカレンダーの空き枠から30分を選べます。上の連絡先にはメールアドレスを入力し、予約画面でも同じものをお使いください。</p>
      <button type="button" disabled={!emailOk || busy} onClick={() => setOpen(true)} className="mt-3 min-h-[48px] rounded-xl bg-brand-deep px-4 py-2 text-[15px] font-bold text-white disabled:opacity-50">{busy ? "予約を確認しています…" : "空き枠を開く"}</button>
      {!emailOk && <p className="mt-2 text-[13px] text-ink-soft">{fallbackHint ?? "メールアドレス入力後に開けます。電話での連絡をご希望なら、候補日時を3つお送りください。"}</p>}
      <details className="mt-3 text-[14px]"><summary className="cursor-pointer py-2 underline">予約済みなのに、この画面に反映されないとき</summary><p className="mt-2 leading-relaxed">新しい予約は作らず、Zoomの確認メールやカレンダーにある「このイベントを変更する」URLを貼り付けてください。同じ予約を確認します。</p><label className="mt-3 block">Zoomの予約管理URL<input type="url" value={manageUrl} onChange={e => setManageUrl(e.target.value)} placeholder="https://scheduler.zoom.us/manage/…" className="mt-1 min-h-[48px] w-full rounded-lg border border-brand/30 px-3 text-[15px]" /></label><button type="button" disabled={!emailOk || !manageUrl.trim() || busy} onClick={() => void recover()} className="mt-2 min-h-[48px] rounded-xl bg-brand-deep px-4 py-2 font-bold text-white disabled:opacity-50">予約を作らず照合する</button></details>
    </>}
    {open && <div className="mt-4"><p className="mb-2 text-[13px] leading-relaxed">この中で「予約」を完了すると、予定がEHCカレンダーに登録され、Zoomの参加URLが届きます。</p><iframe ref={frame} title="EHCのZoom相談・空き枠と予約" src={src} className="h-[720px] w-full rounded-xl border-0" /><div className="mt-3 rounded-xl bg-paper-sub p-3"><p className="text-[13px] leading-relaxed">予約が終わっても、この画面が「予約済み」に変わらないときは、下のボタンを押してください。同じメールアドレスの予約を探して結び付けます（新しい予約は作りません）。</p><button type="button" disabled={busy} onClick={() => void findByEmail()} className="mt-2 min-h-[48px] w-full rounded-xl bg-brand-deep px-4 py-2 text-[15px] font-bold text-white disabled:opacity-50 sm:w-auto">{busy ? "予約を確認しています…" : "予約が終わったので確認する"}</button></div><button type="button" onClick={() => setOpen(false)} className="min-h-[44px] text-[14px] underline">予約画面を閉じる</button></div>}
    {error && <p role="alert" className="mt-3 text-[14px] text-red-800">{error} {pending.current && <button type="button" disabled={busy} onClick={() => void verify(pending.current!)} className="min-h-[44px] font-bold underline">同じ予約の結果を再確認する</button>}</p>}
  </div>;
}
