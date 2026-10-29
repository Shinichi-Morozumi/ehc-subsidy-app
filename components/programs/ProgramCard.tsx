"use client";

/* ───────────────────────────────────────────────────────────
   v2 / 2026-10-29 / EHC-0102 制度カード
   直し2回目（10名のレビュー）：「結局いくら」を1行に（区分で違えば幅）・「〜」をやめて何が別にかかるかを書く／
   「いつ」は受付の期間をそのまま大きく／お金はいつ入るかと、確かめる点をカードの外に出す／
   入札・3社以上の見積りがある制度では、EHC がその中の1社として加わることを書く。

   東京都の介護施設向けパンフ（EHC-0099）の「制度02」のカードと同じ形。
   上から：何に使えるか → 対象 → 補助率と上限（大きな数字） → 結局いくら（目安） → いつ（残り日数） →
   流れ（交付決定の前に契約しない所だけ色を変える） → 開く（要件・重ねて使えるか・お金の流れ・落ちやすい所・だれが何をするか）。
   数字と文言は lib/programs.ts だけが持つ。ここでは並べるだけ。
   ─────────────────────────────────────────────────────────── */

import Image from "next/image";
import { AlertTriangle, CalendarDays, Check, ChevronDown, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import {
  COLORS, countdownLabel, estimateFor, estimateSummary, fmtMan, jaDate, manRange, needsRecheck, nextWindow, upcomingWindows, windowRangeText,
  type Estimate, type Program, type ProgramId,
} from "@/lib/programs";
import type { MatchStatus } from "@/lib/programMatch";

export interface CardMatch {
  status: MatchStatus;
  reasons: string[];
  checks: string[];
}

const STATUS_STYLE: Record<MatchStatus, string> = {
  可能性あり: "bg-brand-deep text-white",
  要確認: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  対象外の見込み: "bg-stone-200 text-stone-700",
};

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="text-[13px] font-bold tracking-wide" style={color ? { color } : undefined}>
      {children}
    </p>
  );
}

/** 診断の答えが無いカード（/tokyo・/kaigo）に出す例の工事費 */
export const EXAMPLE_COST = { costMan: 1000, equipmentMan: 600 } as const;

function EstimateBox({ p, est, onAskCost, example }: { p: Program; est: Estimate; onAskCost?: () => void; example: boolean }) {
  const c = COLORS[p.color];
  const exampleLabel = p.costBasis === "equipment" ? "工事費1,000万円・うち機器代600万円" : "工事費1,000万円";
  const sum = estimateSummary(est);
  return (
    <div className="rounded-2xl p-4" style={{ background: c.soft }}>
      <Label color={c.num}>{example && est.kind === "ok" ? `結局いくら（例：${exampleLabel}の場合）` : "結局いくら（目安）"}</Label>
      {est.kind === "ok" && sum && p.capsBy === "facility" && est.lines.length > 1 ? (
        <div className="mt-2 space-y-2">
          {est.lines.map((l) => (
            <div key={l.label} className="rounded-xl bg-white p-3">
              <p className="text-[13px] font-bold text-ink-soft">{l.label}</p>
              <p className="text-[15px] leading-[1.6]">
                補助の目安 <b className="whitespace-nowrap text-[22px] leading-none" style={{ color: c.num }}>{fmtMan(l.subsidyMan)}</b>
                {l.capped && <span className="ml-1 text-[12px] text-ink-soft">（上限で頭打ち）</span>}
              </p>
              <p className="mt-1 text-[14px] leading-[1.6]">
                {l.selfMan !== null ? <>施設の負担の目安 <b className="text-[17px]">{fmtMan(l.selfMan)}</b>（上限を超える分）</> : <span className="text-ink-soft">上限の内側に収まる計算です。</span>}
              </p>
            </div>
          ))}
          <p className="text-[13px] leading-[1.7] text-ink-soft">施設の種類で上限が変わります。このほかに消費税と、補助の対象にならない費用がかかります。{est.basis}。目安です。採択と金額は審査で決まります。</p>
          {example && onAskCost && (
            <button type="button" onClick={onAskCost} className="inline-flex min-h-[44px] items-center rounded-xl border bg-white px-3 text-[14px] font-bold" style={{ borderColor: c.head, color: c.num }}>
              自分の工事費で計算する
            </button>
          )}
        </div>
      ) : est.kind === "ok" && sum ? (
        <div className="mt-2 space-y-3">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[15px] leading-[1.6]">
              補助の目安 <b className="whitespace-nowrap text-[26px] leading-none" style={{ color: c.num }}>{manRange(sum.subsidyMin, sum.subsidyMax)}</b>
              {sum.capped && <span className="ml-1 text-[12px] text-ink-soft">（上限で頭打ち）</span>}
            </p>
            <p className="mt-1.5 text-[15px] leading-[1.6]">
              {sum.selfMin !== null && sum.selfMax !== null ? (
                <>
                  施設の負担の目安 <b className="whitespace-nowrap text-[20px]">{manRange(sum.selfMin, sum.selfMax)}</b>
                  <span className="block text-[13px] text-ink-soft">このほかに消費税と、補助の対象にならない費用がかかります。</span>
                </>
              ) : (
                <span className="text-[14px] text-ink-soft">補助の上限の内側に収まる計算です。消費税と、補助の対象にならない費用は施設の負担です。</span>
              )}
            </p>
            {p.rate.value === "10/10" && sum.capped && (
              <p className="mt-1.5 text-[13px] leading-[1.6] text-ink">10/10 は上限の額までです。上限を超える分は施設の負担になります。</p>
            )}
          </div>
          {sum.varies && (
            <ul className="space-y-0.5 text-[13px] leading-[1.6] text-ink-soft">
              <li className="font-bold">区分ごとの目安（どの区分になるかは{p.id === "tokyoZeroemi" ? "省エネ診断などで決まります" : "要件で決まります"}）</li>
              {est.lines.map((l) => <li key={l.label}>・{l.label}：補助 {fmtMan(l.subsidyMan)}</li>)}
            </ul>
          )}
          <p className="text-[13px] leading-[1.7] text-ink-soft">{est.basis}。目安です。採択と金額は審査で決まります。</p>
          {example && onAskCost && (
            <button type="button" onClick={onAskCost} className="inline-flex min-h-[44px] items-center rounded-xl border bg-white px-3 text-[14px] font-bold" style={{ borderColor: c.head, color: c.num }}>
              自分の工事費で計算する
            </button>
          )}
        </div>
      ) : (
        <div className="mt-1">
          <p className="text-[14px] leading-[1.8] text-ink">{est.note}</p>
          {p.costBasis === "equipment" && (est.kind === "needEquipment" || est.kind === "needCost") && (() => {
            const ex = estimateSummary(estimateFor(p, EXAMPLE_COST));
            return ex ? <p className="mt-1 text-[14px] leading-[1.7]">例：機器代 600万円なら、補助の目安 <b style={{ color: c.num }}>{manRange(ex.subsidyMin, ex.subsidyMax)}</b>（工事費は自己負担）</p> : null;
          })()}
          {onAskCost && est.kind !== "unknownRate" && est.kind !== "belowMin" && (
            <button type="button" onClick={onAskCost} className="mt-2 inline-flex min-h-[44px] items-center rounded-xl border px-3 text-[14px] font-bold" style={{ borderColor: c.head, color: c.num }}>
              {p.costBasis === "equipment" ? "機器代を入れて計算する" : "工事費を入れて計算する"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ProgramCard({
  program: p,
  today,
  match,
  estimate,
  onConsult,
  onAskCost,
  place,
}: {
  program: Program;
  today: string;
  match?: CardMatch;
  estimate?: Estimate;
  onConsult?: (id: ProgramId) => void;
  onAskCost?: () => void;
  place: string;
}) {
  const c = COLORS[p.color];
  const next = nextWindow(p, today);
  const recheck = needsRecheck(p, today);
  const example = !estimate;
  const est = estimate ?? estimateFor(p, p.costBasis === "equipment" ? EXAMPLE_COST : { costMan: EXAMPLE_COST.costMan });
  const w = next.window;

  return (
    <article id={`program-${p.id}`} className="scroll-mt-32 overflow-hidden rounded-3xl border-2 bg-white shadow-card" style={{ borderColor: c.head }} aria-labelledby={`card-${p.id}`}>
      <header className="relative px-5 pb-5 pt-4 text-white" style={{ background: c.head }}>
        <p className="text-[13px] font-bold opacity-95">{p.tag}</p>
        <h3 id={`card-${p.id}`} className="mt-1 pr-[84px] text-[22px] font-bold leading-[1.4]">{p.title}</h3>
        <span className="absolute right-3 top-3 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/95">
          <Image src={`/programs/${p.icon}.webp`} alt="" width={64} height={64} className="h-16 w-16" />
        </span>
      </header>

      <div className="space-y-5 px-5 py-5 text-ink">
        {match && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-3 py-1 text-[14px] font-bold", STATUS_STYLE[match.status])}>{match.status}</span>
              {match.reasons.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-paper-sub px-2 py-1 text-[13px] font-bold text-ink">
                  <Check aria-hidden className="h-3.5 w-3.5" style={{ color: c.num }} />{r}
                </span>
              ))}
            </div>
            {match.checks.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[14px] leading-[1.7] text-amber-950">
                <p className="font-bold">確かめる点{match.status === "要確認" ? "（ここが分かれば判定できます）" : ""}</p>
                <ul className="mt-0.5 list-disc pl-5">{match.checks.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <p className="text-[13px] leading-[1.7] text-ink-soft">{p.officialName}<br />（{p.organizer}）</p>

        <section>
          <Label color={c.num}>何に使えるか</Label>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {p.use.map((u) => (
              <li key={u} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-bold leading-[1.5]" style={{ background: c.box }}>
                <Check aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: c.num }} />{u}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[14px] leading-[1.7] text-ink">{p.useNote}</p>
        </section>

        <section>
          <Label color={c.num}>対象</Label>
          <p className="mt-1 text-[17px] font-bold leading-[1.6]">{p.target}</p>
          <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">{p.targetNote}</p>
        </section>

        <hr className="border-ink-line" />

        <section aria-label="補助率と上限">
          <p className="text-[16px] font-bold leading-none">
            {p.rate.pre}
            <span className="mx-1 align-[-0.12em] text-[48px] font-bold tracking-tight" style={{ color: c.num }}>{p.rate.value}</span>
            {p.rate.post}
          </p>
          <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">{p.rate.note}</p>
          <div className="mt-3 grid gap-2">
            {p.caps.map((cap) => (
              <div key={cap.label} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl px-4 py-3" style={{ background: c.box }}>
                <span className="text-[14px] font-bold leading-[1.5]">{cap.label}</span>
                <span className="whitespace-nowrap text-[15px] font-bold" style={{ color: c.num }}>
                  {cap.man !== null ? <>最大 <span className="text-[24px]">{fmtMan(cap.man)}</span></> : "確認中"}
                </span>
                {cap.note && <span className="w-full text-[12px] text-ink-soft">{cap.note}</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">{p.capNote}</p>
        </section>

        <EstimateBox p={p} est={est} onAskCost={onAskCost} example={example} />

        <hr className="border-ink-line" />

        <section aria-label="いつ">
          <Label color={c.num}>いつ</Label>
          {w ? (
            <div className="mt-1">
              <p className="text-[14px] font-bold">{w.label}</p>
              <p className="mt-1 text-[24px] font-bold leading-[1.35]" style={{ color: c.num }}>
                {w.start ? <>{jaDate(w.start, w.start.slice(0, 4) !== today.slice(0, 4))}<span className="text-[18px]">〜</span>{jaDate(w.end, w.end.slice(0, 4) !== w.start.slice(0, 4))}</> : <>{jaDate(w.end, w.end.slice(0, 4) !== today.slice(0, 4))}<span className="text-[16px] text-ink">まで</span></>}
              </p>
              <span className={cn("mt-1 inline-block rounded-full px-3 py-1 text-[14px] font-bold", next.state === "open" && (next.daysToEnd ?? 99) <= 14 ? "bg-red-700 text-white" : "bg-paper-pill text-ink")}>
                {countdownLabel(next)}
              </span>
              {w.time && <p className="mt-1 text-[14px] text-ink-soft">{w.time}</p>}
              {w.note && <p className="mt-1 text-[14px] leading-[1.7] text-ink">{w.note}</p>}
              {upcomingWindows(p, today).slice(1).map((o) => (
                <p key={o.end} className="mt-2 rounded-xl bg-paper-sub px-3 py-2 text-[14px] leading-[1.6]">次の回：<b>{o.short}</b>　{windowRangeText(o, today)}<span className="block text-[13px] text-ink-soft">見積や書類の準備が間に合わないときは、次の回を目指せます。</span></p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[18px] font-bold">次の募集は未発表です</p>
          )}
          <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">{p.scheduleNote}</p>
          <div className="mt-3 rounded-xl bg-paper-sub px-3 py-2">
            <p className="text-[13px] font-bold" style={{ color: c.num }}>お金はいつ入るか</p>
            <p className="mt-0.5 text-[14px] leading-[1.7]">{p.money}</p>
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-700/30 bg-red-50 px-3 py-2 text-[15px] font-bold leading-[1.6] text-red-800">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />{p.flow[p.stopAt]}の前に、契約・発注しないでください。
          </p>
        </section>

        <section aria-label="流れ">
          <Label color={c.num}>流れ</Label>
          <ol className="mt-2 grid gap-1.5">
            {p.flow.map((s, i) => (
              <li key={s} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] leading-[1.5]", i === p.stopAt ? "font-bold text-white" : "bg-paper-sub")} style={i === p.stopAt ? { background: "#9B2C2C" } : undefined}>
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", i === p.stopAt ? "bg-white text-red-800" : "text-white")} style={i === p.stopAt ? undefined : { background: c.head }}>{i + 1}</span>
                <span>{s}{i === p.stopAt && <span className="ml-1 text-[13px]">（ここまで契約しない）</span>}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="EHCにできること" className="rounded-2xl border-2 p-4" style={{ borderColor: c.box, background: "#FFFFFF" }}>
          <p className="text-[15px] font-bold leading-[1.6]">工事も設備も、EHC のチームでまとめてお受けできます</p>
          <p className="mt-1 text-[14px] leading-[1.75] text-ink">
            現地調査・見積・図面・省エネの計算の資料づくりから工事まで、ご相談先は EHC ひとつです。空調だけでなく、建物と設備の工事をまとめて計画できます。
          </p>
          {p.selection === "bid" && (
            <p className="mt-1 text-[14px] leading-[1.75] text-ink">この制度では、施設が入札などで公平に業者を選びます。EHC はその中の1社として、見積り・図面をご用意して加わります。</p>
          )}
          {p.selection === "quotes" && (
            <p className="mt-1 text-[14px] leading-[1.75] text-ink">この制度では3社以上の見積りが要ります。EHC の見積りは、そのうちの1社分です。</p>
          )}
          <a href="/team" className="mt-2 inline-flex min-h-[44px] items-center text-[14px] font-bold underline underline-offset-4" style={{ color: c.num }}>
            なぜ全部受けられるの？ メンバーと実績を見る →
          </a>
        </section>

        <details className="group rounded-2xl border border-ink-line">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 text-[15px] font-bold">
            要件・重ねて使えるか・落ちやすい所・だれが何をするか
            <ChevronDown aria-hidden className="h-5 w-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-ink-line px-4 py-4 text-[15px] leading-[1.75]">
            <div>
              <Label color={c.num}>要件</Label>
              <ul className="mt-1 list-disc space-y-1 pl-5">{p.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            <div>
              <Label color={c.num}>重ねて使えるか</Label>
              <p className="mt-1">{p.stack}</p>
            </div>
            <div>
              <Label color={c.num}>落ちやすい所</Label>
              <ul className="mt-1 list-disc space-y-1 pl-5">{p.pitfalls.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            <div>
              <Label color={c.num}>だれが何をするか</Label>
              <dl className="mt-1 divide-y divide-ink-line rounded-xl border border-ink-line">
                {p.roles.map((r) => (
                  <div key={r.who} className="grid grid-cols-[8.5em_1fr] gap-2 px-3 py-2 text-[14px]">
                    <dt className="font-bold">{r.who}</dt><dd>{r.what}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {p.pending.length ? (
              <div>
                <Label color={c.num}>EHC が事務局に確かめている点</Label>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {p.pending.map((r) => <li key={r}>{r}（確認中）</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </details>

        <footer className="space-y-3">
          <p className="flex items-center gap-1 text-[13px] text-ink-soft">
            <CalendarDays aria-hidden className="h-4 w-4" />公式確認日 {p.verifiedAt.replace(/-/g, "/")}
            {recheck && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900"><Info aria-hidden className="h-3.5 w-3.5" />公式で再確認中</span>}
          </p>
          <div className="no-print grid gap-2 sm:grid-cols-2">
            {onConsult && (
              <button
                type="button"
                onClick={() => { track("card_consult", { program: p.id, place }); onConsult(p.id); }}
                className="inline-flex min-h-[52px] items-center justify-center rounded-2xl px-4 text-[16px] font-bold text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: c.head, outlineColor: c.head }}
              >
                この制度で相談する
              </button>
            )}
            {p.official.slice(0, 1).map((o) => (
              <a
                key={o.url}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("official_open", { program: p.id })}
                className="inline-flex min-h-[52px] items-center justify-center gap-1 rounded-2xl border-2 bg-white px-4 text-[16px] font-bold"
                style={{ borderColor: c.head, color: c.num }}
              >
                公式の情報<ExternalLink aria-hidden className="h-4 w-4" /><span className="sr-only">（新しいタブで開きます）</span>
              </a>
            ))}
          </div>
        </footer>
      </div>
    </article>
  );
}
