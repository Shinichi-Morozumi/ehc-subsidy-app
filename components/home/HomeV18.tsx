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
import { ArrowDown, ArrowRight, ClipboardCheck, FileText, HandCoins, Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { track } from "@/lib/track";
import { useTodayJst } from "@/lib/useToday";
import { COLORS, EHC_ROLE, GYOSEI_ROLE, PROGRAMS, countdownLabel, upcomingWindowItems, windowRangeText, type ProgramColor, type ProgramId } from "@/lib/programs";
import { cn } from "@/lib/utils";
import { DeadlineBoard } from "../programs/DeadlineBoard";
import { ConsultForm } from "../programs/ConsultForm";
import { SiteFooterSimple, SiteHeader } from "../programs/SiteShell";
import { WHY } from "@/lib/team";
import { CONSULT_MULTI_EVENT } from "@/lib/consultOptions";

type PillarDef = { pillar: "tokyo" | "kaigo" | "sii"; color: ProgramColor; icon: string; title: string; lead: string; ids: ProgramId[]; cta: string; more?: { label: string; href: string } };

/* ご指示（2026-10-29）：どの入口から入っても、6問で振り分け → 制度カード → 相談 */
const PILLARS: PillarDef[] = [
  { pillar: "tokyo", color: "tokyo", icon: "survey", title: "東京都の補助（全業種）", lead: "都内の事務所・店舗・飲食店・工場・病院・介護施設など。省エネ設備の入れ替えから介護施設の改修まで。", ids: ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu"], cta: "東京都の補助で使えるものを調べる", more: { label: "制度の説明を先に読む", href: "/tokyo" } },
  { pillar: "kaigo", color: "care", icon: "ac", title: "介護施設の補助（全国）", lead: "全国の介護施設。空調だけでなく、建物と設備の大規模修繕に。", ids: ["kokuKaigo", "kokuKaigo30"], cta: "介護施設の補助で使えるものを調べる", more: { label: "制度の説明を先に読む", href: "/kaigo" } },
  { pillar: "sii", color: "sii", icon: "build", title: "国の省エネ補助金 SII（全業種・全国）", lead: "全国の事業所。指定された高効率な機種への入れ替えに（SII は国の事務局の名前です）。", ids: ["sii"], cta: "SII が使えるか調べる" },
  /* EHC-0151 決めたこと1：旧「設備から詳しく計算する」（7問→5段階）はトップから外す。国の省エネは /shindan?for=sii に一本化（担当者用の ?staff=1・共有リンク ?d= は従来どおり開ける） */
];

/** 3つの入口：制度ごとに「何に使える・いつからいつまで・いくら」（ご指示 2026-10-29） */
function PillarCard({ def, today }: { def: PillarDef; today: string | null }) {
  const c = COLORS[def.color];
  const items = today ? upcomingWindowItems(today, def.ids) : [];
  const btnCls = "inline-flex min-h-[52px] w-full items-center justify-center gap-1 rounded-2xl px-5 text-[16px] font-bold text-white";
  const button = (
    <div className="space-y-2">
      <Link href={`/shindan?for=${def.pillar}`} onClick={() => track("pillar_open", { pillar: def.pillar })} className={btnCls} style={{ background: c.head }}>{def.cta}<ArrowRight aria-hidden className="h-4 w-4" /></Link>
      {def.more && (
        <Link href={def.more.href} className="flex min-h-[44px] items-center justify-center text-[14px] font-bold underline underline-offset-4" style={{ color: c.num }}>{def.more.label}</Link>
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
                {/* EHC-0153：「何に使える」は上の締切ボードと重なるので、入口カードではスマホで省く（PCは残す） */}
                <div className="hidden grid-cols-[5.5em_minmax(0,1fr)] gap-2 sm:grid"><dt className="font-bold" style={{ color: c.num }}>何に使える</dt><dd>{p.useShort}</dd></div>
                <div className="grid grid-cols-[5.5em_minmax(0,1fr)] gap-2">
                  <dt className="font-bold" style={{ color: c.num }}>いつ</dt>
                  <dd>
                    {!today ? "…" : its.length ? its.slice(0, 2).map((it) => (
                      <span key={it.window.end} className="block"><b>{it.window.short}</b>　{windowRangeText(it.window, today)}</span>
                    )) : p.noneText}
                  </dd>
                </div>
                <div className="grid grid-cols-[5.5em_minmax(0,1fr)] gap-2"><dt className="font-bold" style={{ color: c.num }}>いくら</dt><dd><b>{p.amountShort}</b></dd></div>
              </dl>
            </li>
          );
        })}
      </ul>
      <footer className="border-t border-ink-line px-5 py-4">{button}</footer>
    </article>
  );
}

/* EHC-0150（2026-11-06）本人の指摘「メインに戻ると（ゼロエミの専用ページを）見失う」→ 最初の画面のすぐ下に、専用ページへの案内を置く。
   締切・補助率は lib/programs.ts から読む（ここに数字を書かない） */
function ZeroemiBanner({ today }: { today: string | null }) {
  const p = PROGRAMS.tokyoZeroemi;
  const it = today ? upcomingWindowItems(today, ["tokyoZeroemi"])[0] : undefined;
  return (
    <section id="ze-banner" aria-labelledby="ze-entry" className="mt-8 scroll-mt-32 overflow-hidden rounded-3xl bg-[#082C1E] text-white shadow-card md:grid md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="p-5 sm:p-7">
        <p className="text-[13px] font-bold text-[#86EFAC]">東京都・都内の事業所さま（業種は問いません）</p>
        <h2 id="ze-entry" className="mt-1 text-[23px] font-bold leading-[1.4] sm:text-[28px]">東京都のゼロエミ：入れ替え費用の<span className="whitespace-nowrap"><span className="text-[#86EFAC]">最大{p.rate.value}</span>を助成</span></h2>
        {it && today && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] leading-[1.7]">
            <span className="rounded-full bg-amber-400 px-3 py-0.5 font-bold text-amber-950">{countdownLabel(it)}</span>
            <span><b>{it.window.short}</b>　{windowRangeText(it.window, today)}</span>
          </p>
        )}
        <p className="mt-2 text-[15px] leading-[1.8] opacity-95">空調・照明などと、冷凍冷蔵庫・ショーケースで専用ページを分けています。5問で、使えるか・ほかの補助と併用できるかを確かめられます。</p>
        <div className="mt-4 grid gap-2 sm:flex">
          <Link href="/zeroemi" onClick={() => track("ze_entry", { place: "top-banner", kind: "kucho" })} className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-brand-lime px-6 text-[16px] font-bold text-ink hover:brightness-95">空調・照明など<ArrowRight aria-hidden className="h-5 w-5" /></Link>
          <Link href="/zeroemi/reizo" onClick={() => track("ze_entry", { place: "top-banner", kind: "reizo" })} className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border-2 border-white/80 px-6 text-[16px] font-bold text-white hover:bg-white/10">冷凍冷蔵庫・ショーケース<ArrowRight aria-hidden className="h-5 w-5" /></Link>
        </div>
      </div>
      <div className="relative hidden md:block">
        <Image src="/zeroemi/kucho-hero-v3.webp" alt="" fill sizes="(min-width: 1024px) 440px, 340px" className="object-cover" style={{ objectPosition: "50% 35%" }} />
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg, #082C1E 0%, rgba(8,44,30,.35) 30%, rgba(8,44,30,0) 60%)" }} />
      </div>
    </section>
  );
}

export function HomeV18() {
  const today = useTodayJst(null);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader page="top" />
      <main id="home-main" className="mx-auto max-w-6xl px-4 pb-6 pt-5">
        {/* EHC-0150：スマホ・タブレットでは案内（#ze-banner）が最初の画面の下になるので、いちばん上に細い入口を置く */}
        <a href="#ze-banner" onClick={() => track("ze_entry", { place: "top-bar", kind: "anchor" })} className="mb-4 flex min-h-[48px] items-center justify-between gap-2 rounded-2xl bg-[#082C1E] px-4 text-[14px] font-bold text-white lg:hidden">
          <span>東京都のゼロエミ（最大{PROGRAMS.tokyoZeroemi.rate.value}）専用ページ</span><ArrowDown aria-hidden className="h-4 w-4 shrink-0" />
        </a>
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
            {/* EHC-0151 P1：最初の画面の説明を短く。何が分かるかを先に、対象の範囲は小さく */}
            <p className="mt-3 text-[17px] font-bold leading-[1.7] text-ink">所在地と施設の種類に答えるだけ（約1分）。使える補助と、<span className="whitespace-nowrap">補助・ご負担の目安</span>、締切が分かります。</p>
            <p className="mt-2 text-[14px] leading-[1.8] text-ink-soft">国の制度は全国、東京都の制度は都内が対象（県・市区町村の独自の補助は載せていません）。工事は全国でお受けします。</p>
            <div className="mt-5 grid gap-2 sm:flex">
              <Link href="/shindan?from=top" className="inline-flex min-h-[56px] items-center justify-center gap-1 rounded-2xl bg-brand-deep px-6 text-[17px] font-bold text-white hover:bg-brand">
                使える補助金を調べる（約1分）<ArrowRight aria-hidden className="h-5 w-5" />
              </Link>
              <a href={COMPANY.telHref} onClick={() => track("consult_call", { kind: "tel", place: "top-hero" })} className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-brand-deep bg-white px-5 text-[16px] font-bold text-brand-deep">
                <Phone aria-hidden className="h-5 w-5" />{COMPANY.tel}
              </a>
            </div>
            <p className="mt-2 text-[13px] text-ink-soft">電話の受付 {COMPANY.hours}・制度の内容は公式の資料で確認（確認日は各カードに表示）</p>

          </div>
          <Image src="/v17/hero-scene.webp" alt="事務所と店舗の天井の空調と、室外機の前で確かめる作業員のイラスト" width={1536} height={1024} priority sizes="(max-width: 1024px) 100vw, 560px" className="h-auto w-full rounded-3xl" />
        </section>

        <ZeroemiBanner today={today} />

        <div className="mt-8">
          <DeadlineBoard today={today} zeLinks={false} />
        </div>

        <section aria-labelledby="pillars" className="mt-10">
          <h2 id="pillars" className="text-[24px] font-bold">3つの入口</h2>
          <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">施設の場所と種類で、使える制度が変わります。制度ごとに、何に使えるか・いつからいつまでか・いくらまでかを並べました。</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-3 lg:items-start">
            {PILLARS.map((def) => <PillarCard key={def.pillar} def={def} today={today} />)}
          </div>
          <Link href="/dropin" className="mt-5 flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border-2 border-ink-line bg-white px-4 py-3 text-[16px] font-bold text-brand-deep">
            <span>買い替えの前に：空調機はそのまま、冷媒だけ入れ替える方法（ドロップイン）<span className="block text-[13px] font-normal text-ink-soft">実測の例・費用の目安・すすめ方</span></span>
            <ArrowRight aria-hidden className="h-5 w-5 shrink-0" />
          </Link>
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
              { icon: HandCoins, head: "多くは後払い（いったん立て替え）", text: "工事代金をいったん施設が支払い、完了の報告と確認のあとに補助金が入るものが多いです。国の介護の交付金は、市区町村によっては前払い（概算払）の場合もあります。完了から入金までの期間の目安は、どの制度も公式には示されていません。制度ごとの流れはカードの「お金はいつ入るか」に書いています。" },
              { icon: FileText, head: "重ねて使えるかは制度のルールしだい", text: "同じ工事に補助を重ねられるかは、制度ごとのルール（要綱）によります。この画面では金額を合算しません。" },
            ].map((x) => (
              <div key={x.head} className="rounded-2xl bg-paper-sub p-4">
                <x.icon aria-hidden className="h-7 w-7 text-brand-deep" />
                <p className="mt-2 text-[17px] font-bold">{x.head}</p>
                <p className="mt-1 text-[15px] leading-[1.75]">{x.text}</p>
              </div>
            ))}
          </div>
          <details className="mt-5 rounded-2xl border border-ink-line">
          <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-[17px] font-bold">だれが何をするか（施設・EHC・行政書士・事務局）</summary>
          <dl className="divide-y divide-ink-line border-t border-ink-line text-[15px]">
            {[
              EHC_ROLE,
              { who: "施設（申し込む人）", what: "制度の事務局への相談・申し込み、工事の契約と支払い、完了の報告" },
              GYOSEI_ROLE,
              { who: "制度の事務局", what: "募集・審査・補助の決定・補助金の支払い（区市町村・都道府県・東京都・SII など）" },
            ].map((r) => (
              <div key={r.who} className="grid grid-cols-[8.5em_1fr] gap-3 px-4 py-3"><dt className="font-bold">{r.who}</dt><dd>{r.what}</dd></div>
            ))}
          </dl>
          </details>
        </section>

        <div className="mt-10">
          {/* EHC-0153：最初の画面の押す所を絞るため、複数施設のまとめ相談は相談フォームのすぐ上へ */}
          <button type="button" onClick={() => { track("consult_call", { kind: "multi", place: "top-consult" }); window.dispatchEvent(new CustomEvent(CONSULT_MULTI_EVENT)); }} className="mb-3 inline-flex min-h-[44px] items-center gap-1 text-left text-[15px] font-bold text-brand-deep underline underline-offset-4">
              施設や建物が複数ある法人の方は、まとめて相談できます<ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
            </button>
          <ConsultForm source="top" options={["tokyoZeroemi", "tokyoKaishu", "tokyoChiiki", "kokuKaigo", "kokuKaigo30", "sii"]} />
        </div>
      </main>
      <SiteFooterSimple />
    </div>
  );
}
