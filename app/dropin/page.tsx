import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { ACHIEVEMENTS, ACHIEVEMENT_STATS } from "@/lib/achievements";
import { DROPIN_CASES } from "@/lib/team";
import { COMPANY } from "@/lib/company";
import { ConsultForm } from "@/components/programs/ConsultForm";
import { ReferralCapture } from "@/components/programs/ReferralCapture";
import { SiteFooterSimple, SiteHeader } from "@/components/programs/SiteShell";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 ドロップイン（冷媒だけの入れ替え）の専用ページ
   ■ なぜ：トップを補助金の締切ボードに作り直したので、ドロップインのチラシの QR（/?ref=krh01-dropin）で来た人が
   　　　　ドロップインの話を見つけられなくなった。本人の決定（2026-10-29）「専用ページを作る」。
   　　　　チラシは刷り直さない：next.config.mjs で /?ref=krh01-dropin を /dropin?ref=krh01-dropin へ送る。
   ■ 中身の出どころ（推測で足さない）
   　・見出し・利点・費用の目安・1年間の対応・すすめ方：ドロップイン汎用パンフ EHC-0064 v1（2026-10-07）の紙面と同じ
   　・フロン排出抑制法：環境省 FAQ（Q5 フロン類以外の冷媒の業務用エアコンは法の対象外）。対象外かは設備ごとに確かめる
   　・実測2件と導入事例：lib/team.ts・lib/achievements.ts（/team と同じ）
   ■ 書かないもの：公式に無い「累計◯台」、年間 ROI・回収年数（前提の仮定が多い）、補助金が使えるという言い方
   ─────────────────────────────────────────────────────────── */

const TITLE = "ドロップイン（空調機はそのまま、冷媒だけ入れ替える）";
const DESCRIPTION =
  "いまの業務用空調機を活かしたまま、冷媒だけを炭化水素系の冷媒へ入れ替える方法です。施工の前後を計測して確かめます。実測の例・導入事例・費用の目安・すすめ方。株式会社EHCソリューションズ。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/dropin" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ja_JP", url: "/dropin", images: [{ url: "/og.jpg" }] },
};

const MERITS = [
  { head: "電気代を減らす", text: "施工の前と後を計測して、空調の電気の使い方がどう変わったかを確かめます。" },
  { head: "フロンの点検が要らなくなる場合も", text: "フロン類以外の冷媒に替えた業務用エアコンは、フロン排出抑制法の対象外です（環境省のFAQ）。対象外になるかは、設備ごとに確かめます。" },
  { head: "いまの設備を活かして施工", text: "室外機・室内機は交換しません。機器ごと入れ替えるより、工事を小さく済ませられます。" },
];

const COSTS = [
  { what: "パッケージエアコン", man: "約25.8万円", unit: "1台あたり" },
  { what: "ビル用マルチエアコン", man: "約58.3万円", unit: "1台（室外機）あたり" },
];

const STEPS = [
  "ご相談（室外機の型番の札・電気料金の明細の写真があると早いです）",
  "現地で機器の状態を見て、冷媒だけにするか、機器ごと入れ替えるかをご提案します",
  "お見積り",
  "まず数台で入れ替えて、前と後を計測します",
  "結果を見てから、ほかの台へ広げるかを決められます",
];

export default function DropinPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <ReferralCapture pathname="/dropin" />
      <SiteHeader page="dropin" />
      <main className="mx-auto max-w-6xl px-4 pb-6 pt-5">
        <section>
          <p className="inline-block rounded-xl bg-paper-tint px-3 py-1 text-[14px] font-bold text-brand-deep">空調機はそのまま、冷媒だけ入れ替える（ドロップイン）</p>
          <h1 className="mt-3 text-[29px] font-bold leading-[1.4] sm:text-[38px]">空調の電気代を、<span className="whitespace-nowrap">本業に回せる予算へ。</span></h1>
          <p className="mt-3 max-w-3xl text-[16px] leading-[1.9] text-ink-soft">
            いまの業務用空調機を活かしたまま、冷媒だけを炭化水素系の冷媒へ入れ替える方法です。機器本体は交換しません。オフィス・店舗・工場・倉庫・医療・福祉施設など、業務用のパッケージエアコンやビル用マルチをお使いの建物が対象です。向いているかどうかは、設備の状態を見て判断します。
          </p>
          <div className="mt-5 grid gap-2 sm:flex">
            <a href="#consult" className="inline-flex min-h-[56px] items-center justify-center gap-1 rounded-2xl bg-brand-deep px-6 text-[17px] font-bold text-white hover:bg-brand">
              ドロップインを相談する<ArrowRight aria-hidden className="h-5 w-5" />
            </a>
            <a href={COMPANY.telHref} className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-brand-deep bg-white px-5 text-[16px] font-bold text-brand-deep">
              <Phone aria-hidden className="h-5 w-5" />{COMPANY.tel}
            </a>
          </div>
          <p className="mt-2 text-[13px] text-ink-soft">電話の受付 {COMPANY.hours}</p>
        </section>

        <section aria-labelledby="merits" className="mt-10">
          <h2 id="merits" className="text-[24px] font-bold">3つのよいところ</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {MERITS.map((m, i) => (
              <div key={m.head} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-deep text-[16px] font-bold text-white">{i + 1}</span>
                <p className="mt-3 text-[18px] font-bold leading-[1.5]">{m.head}</p>
                <p className="mt-2 text-[15px] leading-[1.8]">{m.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="cases" className="mt-10">
          <h2 id="cases" className="text-[24px] font-bold">実測の例</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {DROPIN_CASES.map((d) => (
              <article key={d.name} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card">
                <p className="text-[13px] font-bold text-brand">{d.tag}</p>
                <p className="mt-1 text-[17px] font-bold leading-[1.5]">{d.name}</p>
                <p className="mt-1 text-[14px] text-ink-soft">{d.what}</p>
                <p className="mt-3 leading-none"><b className="text-[40px] text-brand-deep">{d.num}</b><span className="ml-2 text-[14px] font-bold">{d.numLabel}</span></p>
                <p className="mt-3 text-[13px] leading-[1.75] text-ink-soft">{d.note}</p>
              </article>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">効果は、設備の状態・使い方・気温によって変わります。上の数値は、それぞれの条件のもとでの実測です。</p>
        </section>

        <section aria-labelledby="costs" className="mt-10 rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
          <h2 id="costs" className="text-[22px] font-bold">費用の目安</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {COSTS.map((c) => (
              <div key={c.what} className="rounded-2xl bg-paper-sub p-4">
                <p className="text-[15px] font-bold">{c.what}</p>
                <p className="mt-1"><b className="text-[28px] text-brand-deep">{c.man}</b><span className="ml-1 text-[14px]">／{c.unit}</span></p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">EHC のお見積りの実例を、1台あたりにならした参考の金額です。建物・台数・配管や設置の状態で変わります。お見積りは現地を見てからお出しします。</p>
          <p className="mt-3 text-[15px] leading-[1.8]">転換した冷媒が原因の不具合は、1年間、無償で対応します。施工・保守は、EHC の取締役 碓井が代表を務めるプロジェクトネオ（第一種フロン類充塡回収業者）が行います。</p>
        </section>

        <section aria-labelledby="subsidy" className="mt-10 rounded-3xl bg-paper-tint p-5 sm:p-6">
          <h2 id="subsidy" className="text-[22px] font-bold">補助金との関係</h2>
          <ul className="mt-3 space-y-2 text-[15px] leading-[1.8]">
            <li className="flex gap-2"><span aria-hidden className="text-brand">●</span>国・都の多くの補助は、冷媒だけの入れ替えを対象外としている見込みです（事務局に確認中）。</li>
            <li className="flex gap-2"><span aria-hidden className="text-brand">●</span>補助を使わない分、補助が決まる知らせ（交付決定）を待たずに進められます。</li>
            <li className="flex gap-2"><span aria-hidden className="text-brand">●</span>機器ごと新しい機種に入れ替えるなら、補助を使える場合があります。どちらがよいかは、現地で機器の状態を見てご提案します。</li>
          </ul>
          <Link href="/shindan?from=dropin" className="mt-4 inline-flex min-h-[52px] items-center justify-center gap-1 rounded-2xl border-2 border-brand-deep bg-white px-5 text-[16px] font-bold text-brand-deep">
            機器を入れ替える場合の補助金を調べる<ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </section>

        <section aria-labelledby="steps" className="mt-10">
          <h2 id="steps" className="text-[24px] font-bold">すすめ方</h2>
          <ol className="mt-3 grid gap-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-[15px] leading-[1.7] shadow-soft">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-deep text-[13px] font-bold text-white">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="achievements" className="mt-10">
          <h2 id="achievements" className="text-[22px] font-bold">炭化水素冷媒の導入事例（{ACHIEVEMENT_STATS.totalCases}件）</h2>
          <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">出典：EHC「炭化水素冷媒 導入事例集」。数値は各施設の条件での結果で、ほかの施設での効果を約束するものではありません。</p>
          <div className="mt-3 overflow-x-auto rounded-3xl border border-ink-line bg-white shadow-card">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="bg-paper-sub text-[13px] text-ink-soft">
                <tr><th className="px-4 py-2">業種</th><th className="px-4 py-2">機器</th><th className="px-4 py-2 text-right">台数</th><th className="px-4 py-2 text-right">CO2削減（t/年）</th><th className="px-4 py-2 text-right">電力削減</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {ACHIEVEMENTS.map((a) => (
                  <tr key={a.id}><td className="px-4 py-2 font-bold">{a.industry}</td><td className="px-4 py-2">{a.equipment}</td><td className="px-4 py-2 text-right">{a.units}台</td><td className="px-4 py-2 text-right">{a.co2ReductionTon}</td><td className="px-4 py-2 text-right">{a.powerReductionRate}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/team" className="mt-3 inline-flex min-h-[44px] items-center text-[15px] font-bold text-brand-deep underline underline-offset-4">工事も設備も受けられる理由・メンバーを見る →</Link>
        </section>

        <section className="mt-10">
          <ConsultForm source="dropin" />
        </section>
      </main>
      <SiteFooterSimple />
    </div>
  );
}
