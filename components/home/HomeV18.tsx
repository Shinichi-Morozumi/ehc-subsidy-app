"use client";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 トップ（締切ボード＋3つの入口）

   ■ なぜ
   　　2026-07-29〜10-29 の90日で、トップを開いた人の多くがそのまま帰り、7問の診断を開いたのは3人だった。
   　　トップの主役を「7問の診断」から「いま近い締切」と「3つの入口（東京都・介護施設・国の省エネ）」に替える。
   ■ 決め事
   　　・数字と日付は lib/programs.ts だけが持つ。今日は開いた端末の日本時間（ビルド時の日付で固めない）。
   　　・国の省エネ（SII）の入口は、今の7問の診断を開く（OPEN_HEARING_EVENT。/sii は第2段階）。
   　　・旧トップ（HomeV17）のファイルは残す（戻せるように）。
   　　・景品表示法：「実質0円」「自己負担ゼロ」「必ず採択」「確実」は使わない。「無料」は書かない。
   ─────────────────────────────────────────────────────────── */

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, ClipboardCheck, FileText, HandCoins, Phone } from "lucide-react";
import { OPEN_HEARING_EVENT } from "../HowItWorks";
import { COMPANY } from "@/lib/company";
import { track } from "@/lib/track";
import { useTodayJst } from "@/lib/useToday";
import { COLORS, GYOSEI_ROLE, PROGRAMS, VERIFIED_AT, countdownLabel, upcomingWindowItems, windowRangeText, type ProgramColor, type ProgramId } from "@/lib/programs";
import { cn } from "@/lib/utils";
import { DeadlineBoard } from "../programs/DeadlineBoard";
import { ConsultForm } from "../programs/ConsultForm";
import { SiteFooterSimple, SiteHeader } from "../programs/SiteShell";
import { WHY } from "@/lib/team";

type PillarDef = { pillar: "tokyo" | "kaigo" | "sii"; color: ProgramColor; icon: string; title: string; lead: string; ids: ProgramId[]; cta: string; more: { label: string; href?: string } };

/* ご指示（2026-10-29）：どの入口から入っても、6問で振り分け → 制度カード → 相談 */
const PILLARS: PillarDef[] = [
  { pillar: "tokyo", color: "tokyo", icon: "survey", title: "東京都の補助（全業種）", lead: "都内の事業所・介護施設。事業所の省エネから介護施設の改修まで。", ids: ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu"], cta: "東京都の補助を6問で調べる", more: { label: "制度の説明を先に読む", href: "/tokyo" } },
  { pillar: "kaigo", color: "care", icon: "ac", title: "介護施設の補助", lead: "全国の介護施設。空調だけでなく、建物と設備の大規模修繕に。", ids: ["kokuKaigo", "kokuKaigo30"], cta: "介護施設の補助を6問で調べる", more: { label: "制度の説明を先に読む", href: "/kaigo" } },
  { pillar: "sii", color: "sii", icon: "build", title: "国の省エネ補助金 SII（全業種）", lead: "全国の事業所。指定された高効率な機種への入れ替えに。", ids: ["sii"], cta: "SII を6問で調べる", more: { label: "設備から詳しく計算する（7問）" } },
];

/** 3つの入口：制度ごとに「何に使える・いつからいつまで・いくら」（ご指示 2026-10-29） */
function PillarCard({ def, today, onSii }: { def: PillarDef; today: string | null; onSii: () => void }) {
  const c = COLORS[def.color];
  const items = today ? upcomingWindowItems(today, def.ids) : [];
  const btnCls = "inline-flex min-h-[52px] w-full items-center justify-center gap-1 rounded-2xl px-5 text-[16px] font-bold text-white";
  const button = (
    <div className="space-y-2">
      <Link href={`/shindan?for=${def.pillar}`} onClick={() => track("pillar_open", { pillar: def.pillar })} className={btnCls} style={{ background: c.head }}>{def.cta}<ArrowRight aria-hidden className="h-4 w-4" /></Link>
      {def.more.href ? (
        <Link href={def.more.href} className="flex min-h-[44px] items-center justify-center text-[14px] font-bold underline underline-offset-4" style={{ color: c.num }}>{def.more.label}</Link>
      ) : (
        <button type="button" onClick={onSii} className="flex min-h-[44px] w-full items-center justify-center text-[14px] font-bold underline underline-offset-4" style={{ color: c.num }}>{def.more.label}</button>
      )}
    </div>
  );
  return (
    <article className="overflow-hidden rounded-3xl border-2 bg-white shadow-card" style={{ borderColor: c.head }} aria-labelledby={`pillar-${def.pillar}`}>
      <header className="relative px-5 pb-4 pt-4 text-white" style={{ background: c.head }}>
        <p className="text-[13px] font-bold opacity-95">{c.label}</p>
        <h3 id={`pillar-${def.pillar}`} className="mt-1 pr-[76px] text-[22px] font-bold leading-[1.4]">{def.title}</h3>
        <p className="mt-1 pr-[76px] text-[14px] leading-[1.6] opacity-95">{def.lead}</p>
        <span className="absolute right-3 top-3 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white/95">
          <Image src={`/programs/${def.icon}.webp`} alt="" width={56} height={56} className="h-14 w-14" />
        </span>
      </header>
      <ul className="divide-y divide-ink-line">
        {def.ids.map((id) => {
          const p = PROGRAMS[id];
          const its = items.filter((i) => i.programId === id);
          return (
            <li key={id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="leading-[1.45]">
                  <span className="block text-[12px] font-bold" style={{ color: c.num }}>{p.short}</span>
                  <span className="block text-[17px] font-bold">{p.title}</span>
                </p>
                {its[0] && (
                  <span className={cn("whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold", its[0].state === "open" && its[0].daysToEnd <= 14 ? "bg-red-700 text-white" : "bg-paper-pill text-ink")}>
                    {countdownLabel(its[0])}
                  </span>
                )}
              </div>
              <dl className="mt-2 grid gap-1.5 text-[14px] leading-[1.65]">
                <div className="grid grid-cols-[5.5em_1fr] gap-2"><dt className="font-bold" style={{ color: c.num }}>何に使える</dt><dd>{p.useShort}</dd></div>
                <div className="grid grid-cols-[5.5em_1fr] gap-2">
                  <dt className="font-bold" style={{ color: c.num }}>いつ</dt>
                  <dd>
                    {!today ? "…" : its.length ? its.slice(0, 2).map((it) => (
                      <span key={it.window.end} className="block"><b>{it.window.short}</b>　{windowRangeText(it.window, today)}</span>
                    )) : p.noneText}
                  </dd>
                </div>
                <div className="grid grid-cols-[5.5em_1fr] gap-2"><dt className="font-bold" style={{ color: c.num }}>いくら</dt><dd><b>{p.amountShort}</b></dd></div>
              </dl>
            </li>
          );
        })}
      </ul>
      <footer className="border-t border-ink-line px-5 py-4">{button}</footer>
    </article>
  );
}

export function HomeV18() {
  const today = useTodayJst(null);
  const openSii = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT));
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader page="top" />
      <main id="home-main" className="mx-auto max-w-6xl px-4 pb-6 pt-5">
        <section className="grid items-center gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="inline-block rounded-xl bg-paper-tint px-3 py-1 text-[14px] font-bold text-brand-deep">介護施設・東京都・国の省エネ</p>
            <h1 className="mt-3 text-[29px] font-bold leading-[1.4] sm:text-[38px]">
              空調の入れ替えに使える補助金を、<span className="whitespace-nowrap">締切の近い順に。</span>
            </h1>
            <p className="mt-3 text-[16px] leading-[1.9] text-ink-soft">
              制度ごとに「何に使えるか・対象・要件・いつ・流れ・結局いくら」を1枚のカードに。6つの質問で、施設に合う制度だけを出します。
            </p>
            <div className="mt-5 grid gap-2 sm:flex">
              <Link href="/shindan?from=top" className="inline-flex min-h-[56px] items-center justify-center gap-1 rounded-2xl bg-brand-deep px-6 text-[17px] font-bold text-white hover:bg-brand">
                6問で調べる（約1分）<ArrowRight aria-hidden className="h-5 w-5" />
              </Link>
              <a href={COMPANY.telHref} onClick={() => track("consult_call", { kind: "tel", place: "top-hero" })} className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-brand-deep bg-white px-5 text-[16px] font-bold text-brand-deep">
                <Phone aria-hidden className="h-5 w-5" />{COMPANY.tel}
              </a>
            </div>
            <p className="mt-2 text-[13px] text-ink-soft">電話の受付 {COMPANY.hours}・制度の公式確認日 {VERIFIED_AT.replace(/-/g, "/")}</p>
          </div>
          <Image src="/v17/hero-scene.webp" alt="事務所と店舗の天井の空調と、室外機の前で確かめる作業員のイラスト" width={1536} height={1024} priority sizes="(max-width: 1024px) 100vw, 560px" className="h-auto w-full rounded-3xl" />
        </section>

        <div className="mt-8">
          <DeadlineBoard today={today} />
        </div>

        <section aria-labelledby="pillars" className="mt-10">
          <h2 id="pillars" className="text-[24px] font-bold">3つの入口</h2>
          <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">施設の場所と種類で、使える制度が変わります。制度ごとに、何に使えるか・いつからいつまでか・いくらまでかを並べました。</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-3 lg:items-start">
            {PILLARS.map((def) => <PillarCard key={def.pillar} def={def} today={today} onSii={openSii} />)}
          </div>
        </section>

        <section aria-labelledby="team-why" className="mt-10 rounded-3xl bg-brand-deep p-5 text-white sm:p-7">
          <p className="text-[14px] font-bold opacity-90">相談から工事まで、窓口はひとつ</p>
          <h2 id="team-why" className="mt-1 text-[24px] font-bold leading-[1.45] sm:text-[28px]">工事も設備も、EHC のチームで全部お受けします</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {WHY.map((w) => (
              <li key={w.head} className="rounded-2xl bg-white/10 p-4">
                <p className="text-[16px] font-bold leading-[1.5]">{w.head}</p>
                <p className="mt-1 text-[14px] leading-[1.75] opacity-90">{w.text}</p>
              </li>
            ))}
          </ul>
          <Link href="/team" className="mt-5 inline-flex min-h-[52px] items-center justify-center gap-1 rounded-2xl bg-brand-lime px-5 text-[16px] font-bold text-ink">
            なぜ全部受けられるの？ メンバーと実績を見る<ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </section>

        <section aria-labelledby="before" className="mt-10 rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
          <h2 id="before" className="text-[22px] font-bold">進める前に知っておくこと</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { icon: ClipboardCheck, head: "交付決定の前に契約しない", text: "どの制度も、交付決定（内示）の前に契約・発注すると対象外になります。見積りと計画は先に進められます。" },
              { icon: HandCoins, head: "多くは後払い", text: "工事代金をいったん施設が支払い、完了の報告のあとに補助金が入るものが多いです（国の介護の交付金は、前払いの場合もあります）。" },
              { icon: FileText, head: "重ねて使えるかは要綱しだい", text: "同じ工事に補助を重ねられるかは、制度ごとの決まりによります。この画面では金額を合算しません。" },
            ].map((x) => (
              <div key={x.head} className="rounded-2xl bg-paper-sub p-4">
                <x.icon aria-hidden className="h-7 w-7 text-brand-deep" />
                <p className="mt-2 text-[17px] font-bold">{x.head}</p>
                <p className="mt-1 text-[15px] leading-[1.75]">{x.text}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-6 text-[17px] font-bold">だれが何をするか</h3>
          <dl className="mt-2 divide-y divide-ink-line rounded-2xl border border-ink-line text-[15px]">
            {[
              { who: "施設（申請者）", what: "窓口への相談・申請、工事の契約と支払い、完了の報告" },
              { who: "EHC", what: "現地調査、見積書・図面・省エネの資料づくり、工事" },
              GYOSEI_ROLE,
              { who: "窓口・事務局", what: "募集・審査・交付決定・補助金の支払い（区市町村・都道府県・東京都・SII など）" },
            ].map((r) => (
              <div key={r.who} className="grid grid-cols-[8em_1fr] gap-3 px-4 py-3"><dt className="font-bold">{r.who}</dt><dd>{r.what}</dd></div>
            ))}
          </dl>
        </section>

        <div className="mt-10">
          <ConsultForm source="top" />
        </div>
      </main>
      <SiteFooterSimple />
    </div>
  );
}
