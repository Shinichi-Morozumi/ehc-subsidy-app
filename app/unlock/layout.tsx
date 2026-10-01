import type { Metadata } from "next";

/* 2026-09-26 改善1: 合言葉の入力画面は検索に出さない（page.tsx は "use client" なのでここで指定する）。 */
export const metadata: Metadata = {
  title: "合言葉の入力",
  robots: { index: false, follow: false },
};

export default function UnlockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
