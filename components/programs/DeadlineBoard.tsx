"use client";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 締切ボード（トップ・/tokyo）

   ・いちばん近い締切を大きな残り日数で出し、その下にこれからの節目（受付開始・締切）を近い順に並べる。
   ・今日から3か月の帯の図（受付の期間＝帯、締切だけのもの＝点）。
   ・今日は開いた端末の日本時間（lib/useToday.ts）。日付が決まるまでは数字を出さない。
   ─────────────────────────────────────────────────────────── */

import { COLORS, PROGRAMS, PROGRAM_ORDER, VERIFIED_AT, daysLabel, jaDate, upcomingMilestones, type ProgramId } from "@/lib/programs";
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
      <figcaption className="mt-2 text-[12px] text-ink-soft">帯＝受付の期間、赤い点＝締切（区市町村・都への提出期限を含む）</figcaption>
    </figure>
  );
}

export function DeadlineBoard({ today, ids = PROGRAM_ORDER, title = "いま近い締切" }: { today: string | null; ids?: ProgramId[]; title?: string }) {
  if (!today) {
    return <div className="h-[420px] animate-pulse rounded-3xl bg-white/70" aria-hidden />;
  }
  const ms = upcomingMilestones(today, ids);
  const firstEnd = ms.find((m) => m.kind === "end");
  const list = ms.slice(0, 5);
  return (
    <section aria-labelledby="deadline-board" className="rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="deadline-board" className="text-[20px] font-bold">{title}</h2>
        <p className="text-[12px] text-ink-soft">公式確認日 {VERIFIED_AT.replace(/-/g, "/")}・今日 {jaDate(today, false)}</p>
      </div>

      {firstEnd ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl p-4" style={{ background: COLORS[PROGRAMS[firstEnd.programId].color].soft }}>
          <p className="leading-none">
            <span className="block text-[13px] font-bold" style={{ color: COLORS[PROGRAMS[firstEnd.programId].color].num }}>{PROGRAMS[firstEnd.programId].tag}</span>
            <span className="mt-1 block text-[17px] font-bold leading-[1.4]">{PROGRAMS[firstEnd.programId].title}</span>
            <span className="mt-1 block text-[14px] text-ink-soft">{firstEnd.label}・{jaDate(firstEnd.date)}</span>
          </p>
          <p className="ml-auto whitespace-nowrap text-right leading-none">
            {firstEnd.days <= 1 ? (
              <span className="text-[34px] font-bold text-red-800">{daysLabel(firstEnd.days)}</span>
            ) : (
              <>
                <span className="text-[15px] font-bold">あと</span>
                <span className="mx-1 text-[56px] font-bold tracking-tight" style={{ color: COLORS[PROGRAMS[firstEnd.programId].color].num }}>{firstEnd.days}</span>
                <span className="text-[15px] font-bold">日</span>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-paper-sub p-4 text-[15px]">この3本柱で、いま日付が決まっている締切はありません。次の募集が出たらここに出します。</p>
      )}

      <ul className="mt-4 divide-y divide-ink-line">
        {list.map((m) => {
          const p = PROGRAMS[m.programId];
          const c = COLORS[p.color];
          return (
            <li key={`${m.programId}-${m.kind}-${m.date}`} className="flex items-center gap-3 py-2.5">
              <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: c.head }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold" style={{ color: c.num }}>{p.tag}</span>
                <span className="block text-[15px] font-bold leading-[1.45]">{m.label}</span>
                <span className="block text-[13px] text-ink-soft">{jaDate(m.date)}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-3 py-1 text-[13px] font-bold", m.kind === "end" && m.days <= 14 ? "bg-red-700 text-white" : "bg-paper-pill text-ink")}>
                {m.kind === "start" ? `開始まで${m.days}日` : m.days <= 1 ? daysLabel(m.days) : `あと${m.days}日`}
              </span>
            </li>
          );
        })}
      </ul>

      <Timeline today={today} ids={ids} />
    </section>
  );
}
