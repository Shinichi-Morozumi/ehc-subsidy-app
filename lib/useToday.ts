"use client";

/* v1 / 2026-10-29 / EHC-0102
   画面で使う「日本時間の今日」。サーバで作ったページ（数時間前の今日のこともある）や、ビルド時に作ったトップでも、
   開いた端末で今日を取り直す。最初の描画はサーバと同じ値（initial）にして、画面の食い違い（hydration）を起こさない。
   initial が無い（トップのようにビルド時に作るページ）ときは null を返し、呼び出し側は数字を出さずに待つ。 */

import { useEffect, useState } from "react";
import { todayJst } from "./programClock";

export function useTodayJst(initial?: string | null): string | null {
  const [today, setToday] = useState<string | null>(initial ?? null);
  useEffect(() => {
    const sync = () => setToday(todayJst());
    sync();
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return today;
}
