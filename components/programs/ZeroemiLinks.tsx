"use client";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-11-06 / EHC-0150 ゼロエミ専用ページへの入口（共通部品）
   本人の指摘：「メインに戻ると（ゼロエミの専用ページを）見失う」
   → トップ（大きな案内・東京都の入口・締切ボード）、/tokyo、制度カード（/tokyo・6問の診断の結果）から、
     /zeroemi（空調・照明など）と /zeroemi/reizo（冷凍冷蔵庫・ショーケース）へ行けるようにする。
   ・押したら track("ze_entry", { place, kind }) を記録（どこから専用ページへ入ったかを数える）。
   ─────────────────────────────────────────────────────────── */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

export const ZEROEMI_PAGES = [
  { href: "/zeroemi", label: "空調・照明など", kind: "kucho" },
  { href: "/zeroemi/reizo", label: "冷凍冷蔵庫・ショーケース", kind: "reizo" },
] as const;

/**
 * variant
 *  - "buttons"：見出し＋2つのボタン（cols=2 なら幅640px以上で横並び）
 *  - "inline" ：1行の文字リンク（締切ボードの行の中など、場所をとらない所）
 */
export function ZeroemiLinks({ place, color, variant = "buttons", cols = 1, className }: { place: string; color?: string; variant?: "buttons" | "inline"; cols?: 1 | 2; className?: string }) {
  const go = (kind: string) => track("ze_entry", { place, kind });
  if (variant === "inline") {
    return (
      <div className={cn("no-print flex flex-wrap items-center gap-x-4 text-[14px]", className)}>
        <span className="rounded-full bg-paper-pill px-2.5 py-0.5 text-[12px] font-bold text-ink">専用ページ</span>
        {ZEROEMI_PAGES.map((z) => (
          <Link key={z.href} href={z.href} onClick={() => go(z.kind)} className="inline-flex min-h-[44px] items-center gap-0.5 font-bold underline underline-offset-4" style={color ? { color } : undefined}>
            {z.label}<ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("no-print", className)}>
      <p className="text-[13px] font-bold" style={color ? { color } : undefined}>ゼロエミの専用ページ（5問で使えるかを確かめられます）</p>
      <div className={cn("mt-1.5 grid gap-2", cols === 2 && "sm:grid-cols-2")}>
        {ZEROEMI_PAGES.map((z) => (
          <Link key={z.href} href={z.href} onClick={() => go(z.kind)} className="inline-flex min-h-[48px] items-center justify-between gap-2 rounded-xl border-2 bg-white px-4 text-[15px] font-bold" style={{ borderColor: color ?? "#254d39", color: color ?? "#254d39" }}>
            {z.label}<ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
