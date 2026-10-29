"use client";

/* ───────────────────────────────────────────────────────────
   v2 / 2026-10-29 / EHC-0102 トップ（締切ボード＋3つの入口）
   直し2回目（10名のレビュー：他業種5・介護5）：最初の画面に「どの業種・どの地域が対象か」を出す。
   　「だれが何をするか」は EHC → 施設 → 行政書士 → 事務局の順。「窓口」は役所側だけに使い、EHC は「ご相談先」と書く。

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
import { COLORS, EHC_ROLE, GYOSEI_ROLE, PROGRAMS, VERIFIED_AT, countdownLabel, upcomingWindowItems, windowRangeText, type ProgramColor, type ProgramId } from "@/lib/programs";
import { cn } from "@/lib/utils";
import { DeadlineBoard } from "../programs/DeadlineBoard";
import { ConsultForm } from "../programs/ConsultForm";
import { SiteFooterSimple, SiteHeader } from "../programs/SiteShell";
import { WHY } from "@/lib/team";

type PillarDef = { pillar: "tokyo" | "kaigo" | "sii"; color: ProgramColor; icon: string; title: string; lead: string; ids: ProgramId[]; cta: string; more: { label: string; href?: string } };

/* ご指示（2026-10-29）：どの入口から入っても、6問で振り分け → 制度カード → 相談 */
const PILLARS: PillarDef[] = [
  { pillar: "tokyo", color: "tokyo", icon: "survey", title: "東京都の補助（全業種）", lead: "都内の事務所・店舗・飲食店・工場・病院・介護施設など。省エネ設備の入れ替えから介護施設の改修まで。", ids: ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu"], cta: "東京都の補助で使えるものを調べる", more: { label: "制度の説明を先に読む", href: "/tokyo" } },
  { pillar: "kaigo", color: "care", icon: "ac", title: "介護施設の補助（全国）", lead: "全国の介護施設。空調だけでなく、建物と設備の大規模修繕に。", ids: ["kokuKaigo", "kokuKaigo30"], cta: "介護施設の補助で使えるものを調べる", more: { label: "制度の説明を先に読む", href: "/kaigo" } },
  { pillar: "sii", color: "sii", icon: "build", title: "国の省エネ補助金 SII（全業種・全国）", lead: "全国の事業所。指定された高効率な機種への入れ替えに（SII は国の事務局の名前です）。", ids: ["sii"], cta: "SII が使えるか調べる", more: { label: "設備から詳しく計算する" } },
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
            <p className="inline-block rounded-xl bg-paper-tint px-3 py-1 text-[14px] font-bold text-brand-deep">東京都・国・介護施設の補助</p>
            <h1 className="mt-3 text-[29px] font-bold leading-[1.4] sm:text-[38px]">
              空調の入れ替えに使える補助金を、<span className="whitespace-nowrap">締切の近い順に。</span>
            </h1>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="対象の業種">
              {["事務所", "店舗・飲食店", "工場・倉庫", "病院・クリニック", "介護施設"].map((t) => (
                <li key={t} className="rounded-full border border-brand-deep/30 bg-white px-3 py-1 text-[14px] font-bold text-brand-deep">{t}</li>
              ))}
            </ul>
            <p className="mt-3 text-[16px] leading-[1.9] text-ink-soft">
              国の制度は全国、東京都の制度は都内が対象です（県・市区町村の独自の補助は、このサイトには載せていません）。工事は全国でお受けします（一都三県のほか、山梨県・福岡県などでも施工しています）。所在地や施設の種類などに答えるだけで（約1分）、使えそうな制度を「何に使えるか・いつ・結局いくら」のカードで出します。
            </p>
            <div className="mt-5 grid gap-2 sm:flex">
              <Link href="/shindan?from=top" className="inline-flex min-h-[56px] items-center justify-center gap-1 rounded-2xl bg-brand-deep px-6 text-[17px] font-bold text-white hover:bg-brand">
                使える補助金を調べる（約1分）<ArrowRight aria-hidden className="h-5 w-5" />
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
          <p className="text-[14px] font-bold opacity-90">ご相談から工事まで、ご相談先は EHC ひとつ</p>
          <h2 id="team-why" className="mt-1 text-[24px] font-bold leading-[1.45] sm:text-[28px]">工事も設備も、EHC のチームで全部お受けします</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {WHY.map((w) => (
              <li key={w.head} className="rounded-2xl bg-white/10 p-4">
                <p className="text-[16px] font-bold leading-[1.5]">{w.head}</p>
                <p className="mt-1 text-[14px] leading-[1.75] opacity-90">{w.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-[1.7] opacity-90">入札や3社以上の見積りが要る制度では、EHC はその中の1社として、見積り・図面をご用意して加わります。</p>
          <Link href="/team" className="mt-3 inline-flex min-h-[52px] items-center justify-center gap-1 rounded-2xl bg-brand-lime px-5 text-[16px] font-bold text-ink">
            なぜ全部受けられるの？ メンバーと実績を見る<ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </section>

        <section aria-labelledby="before" className="mt-10 rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
          <h2 id="before" className="text-[22px] font-bold">進める前に知っておくこと</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { icon: ClipboardCheck, head: "補助が決まる前に契約しない", text: "どの制度も、交付決定・内示（補助が決まったという知らせ）の前に契約・発注すると対象外になります。見積りと計画は先に進められます。" },
              { icon: HandCoins, head: "多くは後払い（いったん立て替え）", text: "工事代金をいったん施設が支払い、完了の報告と確認のあとに補助金が入るものが多いです。国の介護の交付金は、市区町村が認めれば前払い（概算払）の場合もあります。制度ごとの入り方はカードの「お金はいつ入るか」に書いています。" },
              { icon: FileText, head: "重ねて使えるかは制度のルールしだい", text: "同じ工事に補助を重ねられるかは、制度ごとのルール（要綱）によります。この画面では金額を合算しません。" },
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
              EHC_ROLE,
              { who: "施設（申し込む人）", what: "制度の事務局への相談・申し込み、工事の契約と支払い、完了の報告" },
              GYOSEI_ROLE,
              { who: "制度の事務局", what: "募集・審査・補助の決定・補助金の支払い（区市町村・都道府県・東京都・SII など）" },
            ].map((r) => (
              <div key={r.who} className="grid grid-cols-[8.5em_1fr] gap-3 px-4 py-3"><dt className="font-bold">{r.who}</dt><dd>{r.what}</dd></div>
            ))}
          </dl>
        </section>

        <div className="mt-10">
          <ConsultForm source="top" options={["tokyoZeroemi", "tokyoKaishu", "tokyoChiiki", "kokuKaigo", "kokuKaigo30", "sii"]} />
        </div>
      </main>
      <SiteFooterSimple />
    </div>
  );
}
