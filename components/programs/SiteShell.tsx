"use client";

/* v1 / 2026-10-29 / EHC-0102 3本柱のページ（トップ・/tokyo・/shindan・/kaigo の下）で共通の頭とお尻。
   国の省エネ（SII）の詳しい計算は、今の7問の診断（/?start=1）へ（/sii は第2段階で作る）。 */

import Link from "next/link";
import { Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

export type ShellPage = "top" | "tokyo" | "kaigo" | "shindan";

const NAV: { href: string; label: string; page: ShellPage | "sii" }[] = [
  { href: "/tokyo", label: "東京都の補助", page: "tokyo" },
  { href: "/kaigo", label: "介護施設の補助", page: "kaigo" },
  { href: "/?start=1", label: "国の省エネ（SII）", page: "sii" },
  { href: "/shindan", label: "6問で調べる", page: "shindan" },
];

export function SiteHeader({ page, onSii }: { page: ShellPage; onSii?: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="text-[16px] font-bold leading-tight text-brand-deep">
          EHCソリューションズ
          <span className="block text-[12px] font-normal text-ink-soft">空調の入れ替えと補助金</span>
        </Link>
        <nav aria-label="ページ" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) =>
            n.page === "sii" && onSii ? (
              <button key={n.href} type="button" onClick={onSii} className="min-h-[44px] rounded-xl px-3 text-[14px] font-bold text-ink hover:bg-paper-sub">{n.label}</button>
            ) : (
              <Link key={n.href} href={n.href} aria-current={n.page === page ? "page" : undefined} className={cn("inline-flex min-h-[44px] items-center rounded-xl px-3 text-[14px] font-bold", n.page === page ? "bg-paper-tint text-brand-deep" : "text-ink hover:bg-paper-sub")}>
                {n.label}
              </Link>
            )
          )}
        </nav>
        <a href={COMPANY.telHref} onClick={() => track("consult_call", { kind: "tel", place: `header-${page}` })} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-brand-deep px-3 text-[14px] font-bold text-brand-deep">
          <Phone aria-hidden className="h-4 w-4" />電話で相談
        </a>
      </div>
      <nav aria-label="ページ（スマホ）" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {NAV.map((n) =>
          n.page === "sii" && onSii ? (
            <button key={n.href} type="button" onClick={onSii} className="shrink-0 rounded-full border border-ink-line bg-white px-3 py-1.5 text-[13px] font-bold text-ink">{n.label}</button>
          ) : (
            <Link key={n.href} href={n.href} aria-current={n.page === page ? "page" : undefined} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-bold", n.page === page ? "border-brand-deep bg-brand-deep text-white" : "border-ink-line bg-white text-ink")}>
              {n.label}
            </Link>
          )
        )}
      </nav>
    </header>
  );
}

export function SiteFooterSimple() {
  return (
    <footer className="mt-12 border-t border-ink-line bg-paper-sub">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-[13px] leading-[1.8] text-ink-soft">
        <p className="font-bold text-ink">{COMPANY.name}</p>
        <p>{COMPANY.address}</p>
        <p>
          電話 <a href={COMPANY.telHref} className="font-bold text-brand-deep underline underline-offset-4">{COMPANY.tel}</a>（受付 {COMPANY.hours}）／ <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-4">{COMPANY.email}</a>
        </p>
        <p>
          <Link href="/company" className="underline underline-offset-4">会社概要</Link>
          <span aria-hidden>　</span>
          <Link href="/privacy" className="underline underline-offset-4">プライバシーポリシー</Link>
        </p>
        <p>
          制度の内容は公式の資料（カードに確認日を表示）によります。補助率・上限・締切は変わることがあり、予算に達して早く終わることもあります。
          採択と金額は審査と要綱で決まり、お約束するものではありません。申請書類の作成は行政書士の業務で、EHC では作りません。
        </p>
        <p>© 2026 {COMPANY.name}</p>
      </div>
    </footer>
  );
}
