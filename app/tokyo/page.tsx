import type { Metadata } from "next";
import Image from "next/image";
import { todayJst } from "@/lib/programClock";
import { COLORS, PROGRAMS } from "@/lib/programs";
import { ProgramsBoard } from "@/components/programs/ProgramsBoard";
import { TokyoDeadlines } from "@/components/programs/TokyoDeadlines";
import { SiteFooterSimple, SiteHeader } from "@/components/programs/SiteShell";
import { ReferralCapture } from "@/components/programs/ReferralCapture";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 東京都限定の補助金（第1段階で最初に出すページ）
   ・ゼロエミ（第5回 11/9〜11/20・第6回 1/18〜1/29）／地域密着型の大規模な修繕（協議 11/27）／特養等の改修費（協議書 1/8）。
   ・締切ボード → 制度カード（締切の近い順）→ 6問の診断へ → 3項目の相談。
   ・今日の日付で残り日数を出すので、1時間ごとに作り直す（開いた端末でも取り直す）。
   ─────────────────────────────────────────────────────────── */

export const revalidate = 3600;

const TITLE = "東京都の補助金（空調の省エネ・介護施設の改修）締切と金額の目安";
const DESCRIPTION =
  "東京都のゼロエミ（省エネ設備・最大3/4）、特養・養護の改修費補助（3/4）、地域密着型の施設の大規模な修繕。締切・対象・要件・流れ・結局いくらを1枚のカードで。株式会社EHCソリューションズ。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tokyo" },
  /* 2026-10-29 ブラッシュアップ6：SNS で共有したときに、トップの説明文ではなくこのページの説明文を出す */
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.jpg"] },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ja_JP", url: "/tokyo", images: [{ url: "/kaigo/hero.jpg", width: 1600, height: 900, alt: "猛暑の日の介護施設と、涼しい室内のイラスト" }] },
};

const IDS = ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu"] as const;

export default function TokyoPage() {
  const today = todayJst();
  return (
    <div className="min-h-screen bg-paper text-ink">
      <ReferralCapture pathname="/tokyo" />
      <SiteHeader page="tokyo" />
      <main className="mx-auto max-w-6xl px-4 pb-6 pt-5">
        <section className="grid items-center gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="inline-block rounded-xl bg-paper-tint px-3 py-1 text-[14px] font-bold text-brand-deep">東京都の補助（事務所・店舗・工場・病院・介護施設など）</p>
            <h1 className="mt-3 text-[28px] font-bold leading-[1.4] sm:text-[36px]">
              東京都の補助で、<span className="whitespace-nowrap">空調を入れ替える</span>
            </h1>
            <p className="mt-3 text-[16px] leading-[1.9] text-ink-soft">
              都内の事業所なら業種を問わず使える省エネ設備の入れ替え（通称ゼロエミ）と、介護施設向けの改修の補助が2つ。都の補助は、国より補助率が高いものがあります。締切・対象・要件・流れ・「結局いくら」の目安まで1枚のカードにまとめました。
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {IDS.map((id) => {
                const p = PROGRAMS[id];
                const c = COLORS[p.color];
                return (
                  <li key={id} className="rounded-2xl border-2 bg-white px-3 py-3" style={{ borderColor: c.head }}>
                    <span className="block text-[12px] font-bold" style={{ color: c.num }}>{p.short}</span>
                    <span className="block text-[14px] font-bold leading-[1.45]">{p.title}</span>
                    <span className="mt-1 block text-[13px]">{p.rate.pre}<b className="text-[20px]" style={{ color: c.num }}>{p.rate.value}</b>{p.rate.post}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <Image src="/v17/hero-scene.webp" alt="事務所と店舗の天井の空調と、室外機の前で確かめる作業員のイラスト" width={1536} height={1024} priority sizes="(max-width: 1024px) 100vw, 560px" className="h-auto w-full rounded-3xl" />
        </section>

        <div className="mt-8">
          <TokyoDeadlines initialToday={today} />
        </div>

        <h2 className="mt-10 text-[24px] font-bold">制度カード（締切の近い順）</h2>
        <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">数字は公式の資料で確かめた値です（カードに確認日を表示）。採択と金額は審査で決まります。</p>
        <div className="mt-4">
          <ProgramsBoard ids={[...IDS]} initialToday={today} source="tokyo" />
        </div>
      </main>
      <SiteFooterSimple />
    </div>
  );
}
