"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { captureLeadContext, leaveTestMode } from "@/lib/leadContextClient";
import { chooseAdMeasurement, measurementChoice, enableAdMeasurement } from "@/lib/adMeasurement";
export default function LeadMeasurement() {
  const path = usePathname();
  const [show, setShow] = useState(false);
  const [test, setTest] = useState(false);
  const [adPage, setAdPage] = useState(false);
  useEffect(() => {
    const c = captureLeadContext(); setTest(c.test);
    /* EHC-0150: ゼロエミ専用ページは自前の確認（同じ文言・同じ保存先）を出すので、ここでは出さない */
    const isAd = (path === "/tokyo" && ["lp", "diagnosis"].includes(new URLSearchParams(window.location.search).get("adflow") || "")) || path === "/zeroemi" || path === "/zeroemi/reizo";
    setAdPage(isAd);
    const choice = measurementChoice(); setShow(choice === null);
    if (choice === "granted" && !c.test) enableAdMeasurement();
  }, [path]);
  const choose = (c: "granted" | "denied") => { chooseAdMeasurement(c); setShow(false); };
  return <>
    {test && <div role="status" className="fixed left-3 top-3 z-50 rounded-xl bg-amber-100 px-4 py-2 text-[13px] font-bold text-amber-950">営業対象外のテスト中・広告成果には加算しません<button type="button" className="ml-3 min-h-[44px] underline" onClick={() => { leaveTestMode(); setTest(false); }}>テスト表示を終了</button></div>}
    {!adPage && <button type="button" onClick={() => setShow(true)} className="block min-h-[44px] w-full bg-paper px-4 text-center text-[12px] text-ink-soft underline">広告計測の設定</button>}
    {!adPage && show && <aside aria-label="広告計測の確認" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-2xl border border-ink-line bg-white p-4 shadow-lift"><p className="text-[13px] leading-relaxed">許可された場合だけCookieを使い、受付番号と広告のクリック情報をGoogleへ送ります。氏名・連絡先・日程は送りません。許可しなくても相談できます。<Link href="/privacy" className="ml-1 underline">詳細</Link></p><div className="mt-3 flex gap-3"><button type="button" onClick={() => choose("denied")} className="min-h-[44px] rounded-xl border border-ink-line px-4 text-[14px] font-bold">許可しない</button><button type="button" onClick={() => choose("granted")} className="min-h-[44px] rounded-xl bg-brand-deep px-4 text-[14px] font-bold text-white">計測を許可</button></div></aside>}
  </>;
}
