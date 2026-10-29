"use client";

/* ───────────────────────────────────────────────────────────
   v2 / 2026-10-29 / EHC-0102 締切ボード（トップ・/tokyo）
   直し2回目（10名のレビュー）：見出しを「受付中・もうすぐ受付の補助」に。残り日数は「受付開始まで／受付終了まで／締切まで」。
   日付の決まっていない国の制度も「次の募集待ち」として下に並べる（東京都以外の人が、自分に関係ないと帰らないように）。

   ・いちばん近い受付を大きな残り日数（開始まで／終了まで）で出し、その下にこれからの受付を近い順に1行ずつ並べる。
   　どの行にも「何に使える・いつ（いつからいつまで）・いくら」を出す（ご指示 2026-10-29）。
   ・今日から3か月の帯の図（受付の期間＝帯、締切だけのもの＝点）。
   ・今日は開いた端末の日本時間（lib/useToday.ts）。日付が決まるまでは数字を出さない。
   ─────────────────────────────────────────────────────────── */

import { COLORS, PREP_DAYS, PROGRAMS, PROGRAM_ORDER, VERIFIED_AT, countdownKind, countdownLabel, jaDate, upcomingWindowItems, windowRangeText, type ProgramId, type WindowItem } from "@/lib/programs";
import { daysBetween } from "@/lib/programClock";
import { cn } from "@/lib/utils";

const SPAN_DAYS = 92;

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function Timeline({ today, ids = PROGRAM_ORDER }: { today: string; ids?: ProgramId[] }) {
  const end = addDays(today, SPAN_DAYS);
  const rows = ids
    .map((id) => PROGRAMS[id])
    .filter((p) => p.windows.some((w) => w.end >= today && (w.start ?? w.end) <= end));
  if (!rows.length) return null;
  /** 今日を0%、3か月後を100%とした位置 */
  const pos = (ymd: string) => (Math.max(0, Math.min(SPAN_DAYS, daysBetween(today, ymd))) / SPAN_DAYS) * 100;
  const months: string[] = [];
  for (let i = 1; i <= SPAN_DAYS; i++) {
    const d = addDays(today, i);
    if (d.endsWith("-01")) months.push(d);
  }
  const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8))}`;
  return (
    <figure className="mt-5" aria-label="今日から3か月の受付と締切の帯の図">
      <div className="flex items-end gap-2">
        <span className="w-[6.5rem] shrink-0 sm:w-[8rem]" />
        <div className="relative h-5 flex-1 text-[12px] font-bold text-ink-soft">
          <span className="absolute left-0 top-0 text-ink">今日</span>
          {months.filter((m) => pos(m) > 12 && pos(m) < 90).map((m) => (
            <span key={m} className="absolute top-0 whitespace-nowrap" style={{ left: `${pos(m)}%` }}>{Number(m.slice(5, 7))}月</span>
          ))}
        </div>
      </div>
      <div className="mt-1 space-y-1.5">
        {rows.map((p) => {
          const c = COLORS[p.color];
          return (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-[6.5rem] shrink-0 text-[12px] font-bold leading-[1.3] sm:w-[8rem] sm:text-[13px]">{p.short}</span>
              <div className="relative h-11 flex-1 rounded-lg bg-paper-sub">
                {months.map((m) => (
                  <span key={m} aria-hidden className="absolute bottom-0 top-0 border-l border-dashed border-ink-line" style={{ left: `${pos(m)}%` }} />
                ))}
                {p.windows.filter((w) => w.end >= today && (w.start ?? w.end) <= end).map((w) => {
                  const x2 = pos(w.end);
                  const x1 = w.start ? pos(w.start) : x2;
                  const isRange = !!w.start && x2 - x1 > 1;
                  /* 日付は帯の下に。左寄りの帯は始まりから右へ、右寄りの帯は終わりから左へ書く（右端ではみ出さない） */
                  const fromLeft = x1 < 60;
                  return (
                    <span key={w.end}>
                      {isRange ? (
                        <span className="absolute top-1.5 h-4 rounded-full" style={{ left: `${x1}%`, width: `max(10px, ${x2 - x1}%)`, background: c.head }} />
                      ) : (
                        <span className="absolute top-1.5 h-4 w-2.5 -translate-x-1/2 rounded-full" style={{ left: `${x2}%`, background: "#9B2C2C" }} />
                      )}
                      <span
                        className="absolute top-[22px] whitespace-nowrap text-[12px] font-bold leading-4 text-ink"
                        style={fromLeft ? { left: `max(0px, calc(${x1}% - 4px))` } : { right: `max(0px, calc(${100 - x2}% - 4px))` }}
                      >
                        {isRange && w.start ? `${md(w.start)}〜${md(w.end)}` : md(w.end)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 text-[12px] text-ink-soft">帯＝受付の期間、赤い点＝締切（区市町村から都への期限を含む。施設の締切はもっと前のことがあります）</figcaption>
    </figure>
  );
}

/** 1行の中の「何に使える・いつ・いくら」 */
export function WhatWhenHowMuch({ programId, item, today, compact = false }: { programId: ProgramId; item: WindowItem | null; today: string; compact?: boolean }) {
  const p = PROGRAMS[programId];
  const c = COLORS[p.color];
  const rows: [string, React.ReactNode][] = [
    ["何に使える", p.useShort],
    ["いつ", item ? <><b>{item.window.short}</b>　{windowRangeText(item.window, today)}{item.window.note && !compact ? <span className="block text-[13px] text-ink-soft">{item.window.note}</span> : null}{item.daysToEnd < PREP_DAYS ? <span className="block text-[13px] font-bold text-amber-900">締切まで1か月を切っています（準備に1か月ほどかかるため、間に合わないことがあります）</span> : null}</> : p.noneText],
    ["いくら", <b key="a">{p.amountShort}</b>],
  ];
  return (
    <dl className="mt-2 grid gap-1.5 text-[14px] leading-[1.65]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[5.5em_minmax(0,1fr)] gap-2">
          <dt className="font-bold" style={{ color: c.num }}>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Pill({ item }: { item: WindowItem }) {
  const urgent = item.state === "open" && item.daysToEnd <= 14;
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold", urgent ? "bg-red-700 text-white" : "bg-paper-pill text-ink")}>
      {countdownLabel(item)}
    </span>
  );
}

export function DeadlineBoard({ today, ids = PROGRAM_ORDER, title = "受付中・もうすぐ受付の補助" }: { today: string | null; ids?: ProgramId[]; title?: string }) {
  if (!today) {
    return <div className="h-[420px] animate-pulse rounded-3xl bg-white/70" aria-hidden />;
  }
  const items = upcomingWindowItems(today, ids);
  const first = items[0];
  const rest = items.slice(1, 6);
  const waiting = ids.filter((id) => !items.some((i) => i.programId === id));
  return (
    <section aria-labelledby="deadline-board" className="rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="deadline-board" className="text-[20px] font-bold">{title}</h2>
        <p className="text-[12px] text-ink-soft">公式確認日 {VERIFIED_AT.replace(/-/g, "/")}・今日 {jaDate(today, false)}</p>
      </div>
      <p className="mt-1 text-[13px] leading-[1.7] text-ink-soft">申し込みの準備（現地調査・見積・図面・省エネの計算）には1か月ほどかかります。締切の1か月前までにご相談ください。</p>

      {first ? (() => {
        const p = PROGRAMS[first.programId];
        const c = COLORS[p.color];
        const big = first.state === "upcoming" ? first.daysToStart ?? 0 : first.daysToEnd;
        return (
          <div className="mt-3 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_auto] sm:items-center" style={{ background: c.soft }}>
            <div>
              <p className="text-[13px] font-bold" style={{ color: c.num }}>{p.tag}</p>
              <p className="mt-0.5 text-[18px] font-bold leading-[1.45]">{p.title}</p>
              <WhatWhenHowMuch programId={first.programId} item={first} today={today} />
            </div>
            <p className="whitespace-nowrap text-right leading-none">
              {first.state === "open" && first.daysToEnd <= 1 ? (
                <span className="text-[30px] font-bold text-red-800">{countdownLabel(first)}</span>
              ) : (
                <>
                  <span className="text-[15px] font-bold">{countdownKind(first)} あと</span>
                  <span className="mx-1 text-[56px] font-bold tracking-tight" style={{ color: c.num }}>{big}</span>
                  <span className="text-[15px] font-bold">日</span>
                </>
              )}
            </p>
          </div>
        );
      })() : (
        <p className="mt-3 rounded-2xl bg-paper-sub p-4 text-[15px]">いま日付が決まっている受付はありません。次の募集が出たらここに出します。</p>
      )}

      {rest.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-line">
          {rest.map((it) => {
            const p = PROGRAMS[it.programId];
            const c = COLORS[p.color];
            return (
              <li key={`${it.programId}-${it.window.end}`} className="flex gap-3 py-3">
                <span className="w-1.5 shrink-0 rounded-full" style={{ background: c.head }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="leading-[1.45]">
                      <span className="block text-[12px] font-bold" style={{ color: c.num }}>{p.tag}</span>
                      <span className="block text-[16px] font-bold">{p.title}</span>
                    </p>
                    <Pill item={it} />
                  </div>
                  <WhatWhenHowMuch programId={it.programId} item={it} today={today} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {waiting.length > 0 && (
        <div className="mt-4 rounded-2xl bg-paper-sub p-4">
          <p className="text-[15px] font-bold">次の募集待ち（日付が出たらここに載せます）</p>
          <ul className="mt-2 space-y-2">
            {waiting.map((id) => {
              const p = PROGRAMS[id];
              const c = COLORS[p.color];
              return (
                <li key={id} className="flex gap-3">
                  <span className="w-1.5 shrink-0 rounded-full" style={{ background: c.head }} aria-hidden />
                  <p className="text-[14px] leading-[1.6]">
                    <span className="block text-[12px] font-bold" style={{ color: c.num }}>{p.tag}</span>
                    <b className="block text-[15px]">{p.title}</b>
                    <span className="block">{p.noneText}</span>
                    <span className="block font-bold">{p.amountShort}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Timeline today={today} ids={ids} />
    </section>
  );
}
