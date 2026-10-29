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
import { COLORS, GYOSEI_ROLE, PROGRAMS, VERIFIED_AT, jaDate, upcomingMilestones, type ProgramColor, type ProgramId } from "@/lib/programs";
import { DeadlineBoard } from "../programs/DeadlineBoard";
import { ConsultForm } from "../programs/ConsultForm";
import { SiteFooterSimple, SiteHeader } from "../programs/SiteShell";

const TOKYO_IDS: ProgramId[] = ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu"];

function nextText(today: string | null, ids: ProgramId[], none: string): string {
  if (!today) return "";
  const m = upcomingMilestones(today, ids)[0];
  if (!m) return none;
  return `${PROGRAMS[m.programId].short} ${m.label}：${jaDate(m.date, false)}${m.days > 1 ? `（あと${m.days}日）` : m.days === 1 ? "（明日）" : "（今日）"}`;
}

function Pillar({
  color, title, rate, ratePre, sub, next, cta, href, onClick, icon, pillar,
}: {
  color: ProgramColor; title: string; rate: string; ratePre: string; sub: string; next: string; cta: string;
  href?: string; onClick?: () => void; icon: string; pillar: string;
}) {
  const c = COLORS[color];
  const body = (
    <>
      <div className="relative px-5 pb-4 pt-4 text-white" style={{ background: c.head }}>
        <p className="text-[13px] font-bold opacity-95">{c.label}</p>
        <p className="mt-1 pr-[76px] text-[21px] font-bold leading-[1.4]">{title}</p>
        <span className="absolute right-3 top-3 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white/95">
          <Image src={`/programs/${icon}.webp`} alt="" width={56} height={56} className="h-14 w-14" />
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 py-4">
        <p className="text-[15px] font-bold leading-none">{ratePre}<span className="mx-1 text-[44px] tracking-tight" style={{ color: c.num }}>{rate}</span></p>
        <p className="mt-2 text-[15px] leading-[1.7]">{sub}</p>
        <p className="mt-2 min-h-[2.8em] text-[14px] font-bold leading-[1.6]" style={{ color: c.num }}>{next}</p>
        <span className="mt-auto inline-flex min-h-[52px] items-center justify-center gap-1 rounded-2xl px-4 text-[16px] font-bold text-white" style={{ background: c.head }}>
          {cta}<ArrowRight aria-hidden className="h-4 w-4" />
        </span>
      </div>
    </>
  );
  const cls = "flex h-full flex-col overflow-hidden rounded-3xl border-2 bg-white text-left text-ink shadow-card transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  return href ? (
    <Link href={href} onClick={() => track("pillar_open", { pillar })} className={cls} style={{ borderColor: c.head, outlineColor: c.head }}>{body}</Link>
  ) : (
    <button type="button" onClick={() => { track("pillar_open", { pillar }); onClick?.(); }} className={cls} style={{ borderColor: c.head, outlineColor: c.head }}>{body}</button>
  );
}

export function HomeV18() {
  const today = useTodayJst(null);
  const openSii = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT));
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader page="top" onSii={openSii} />
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
          <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">施設の場所と種類で、使える制度が変わります。近いものから見てください。</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Pillar
              pillar="tokyo" color="tokyo" icon="survey" title="東京都の補助" ratePre="最大" rate="3/4"
              sub="省エネ設備（ゼロエミ）・特養と養護の改修・地域密着型の施設の修繕"
              next={nextText(today, TOKYO_IDS, "次の募集は未発表")} cta="東京都の制度を見る" href="/tokyo"
            />
            <Pillar
              pillar="kaigo" color="care" icon="ac" title="介護施設の補助（国）" ratePre="上限まで" rate="10/10"
              sub="定員29人以下の施設は、1施設 最大1,660万円（施設の種類により833万円）"
              next={today ? "次の募集は市区町村が案内します（未発表）" : ""} cta="介護施設の制度を見る" href="/kaigo"
            />
            <Pillar
              pillar="sii" color="sii" icon="build" title="国の省エネ補助金（SII）" ratePre="設備費の" rate="1/3"
              sub="高効率な空調への更新（全国）。工事費は対象外。"
              next={nextText(today, ["sii"], "次の公募は未発表です")} cta="設備から計算する（7問）" onClick={openSii}
            />
          </div>
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
