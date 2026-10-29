"use client";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 6問の診断（/shindan）

   1問ずつ答える（スマホ前提・選ぶと次へ進む）。定員は、制度上29人以下と決まっている施設では聞かない。
   最後の「工事費の目安」は飛ばせる。入れると、制度カードに「結局いくら（目安）」を出す。
   結果は制度カード（lib/programMatch.ts の matchPrograms）を締切の近い順に。相談は3項目のフォーム。
   答えは端末に保存しない（相談を送るときだけ、担当者宛メールと Notion に運ぶ）。
   ─────────────────────────────────────────────────────────── */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { useTodayJst } from "@/lib/useToday";
import { COMMON_CAUTIONS, type ProgramId } from "@/lib/programs";
import {
  CHECK_CAPACITIES, CHECK_CORPS, CHECK_FACILITIES, CHECK_PREFS, CHECK_STAFF, CHECK_STEPS, CHECK_WORKS,
  asksCapacity, labelOfOpt, matchPrograms,
  type CheckAnswers, type CheckCapacityId, type CheckCorpId, type CheckFacilityId, type CheckPrefId, type CheckStaffId, type CheckWorkId,
} from "@/lib/programMatch";
import { ProgramCard } from "./ProgramCard";
import { ConsultForm } from "./ConsultForm";
import { DropinCard } from "./DropinCard";

type Draft = {
  pref?: CheckPrefId;
  facility?: CheckFacilityId;
  capacity?: CheckCapacityId;
  corp?: CheckCorpId;
  staff?: CheckStaffId;
  work?: CheckWorkId;
  costText: string;
  equipText: string;
};

const toMan = (t: string): number | null => {
  const n = Number(t.replace(/[,，\s]/g, "").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)));
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n * 10) / 10 : null;
};

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-[52px] rounded-2xl border px-4 py-2 text-left text-[16px] font-bold leading-[1.5] transition-colors",
        "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
        selected ? "border-brand-deep bg-brand-deep text-white" : "border-ink-line bg-white text-ink hover:border-brand"
      )}
    >
      {children}
    </button>
  );
}

export function ProgramCheck({ initialToday }: { initialToday: string }) {
  const id = useId();
  const today = useTodayJst(initialToday) ?? initialToday;
  const [d, setD] = useState<Draft>({ costText: "", equipText: "" });
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  /* undefined＝まだ選んでいない（いちばん上のカードを入れておく）／null＝制度を指定しない（ドロップインなど） */
  const [consultProgram, setConsultProgram] = useState<ProgramId | null | undefined>(undefined);
  const headRef = useRef<HTMLHeadingElement | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from");
    track("check_open", { from: from && /^[a-z]{1,12}$/.test(from) ? from : "direct" });
  }, []);

  const steps = useMemo(() => CHECK_STEPS.filter((s) => s.key !== "capacity" || asksCapacity(d.facility)), [d.facility]);
  const cur = steps[Math.min(step, steps.length - 1)];

  useEffect(() => {
    if (!moved.current) return;
    headRef.current?.focus();
    headRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    if (!done) track("check_step", { step: step + 1 });
  }, [step, done]);

  const answers: CheckAnswers | null = useMemo(() => {
    if (!d.pref || !d.facility || !d.corp || !d.staff || !d.work) return null;
    const needCap = asksCapacity(d.facility);
    if (needCap && !d.capacity) return null;
    const costMan = toMan(d.costText);
    const e = toMan(d.equipText);
    return {
      pref: d.pref, facility: d.facility, capacity: needCap ? d.capacity ?? null : null,
      corp: d.corp, staff: d.staff, work: d.work,
      costMan, equipmentMan: e !== null && costMan !== null && e > costMan ? null : e,
    };
  }, [d]);
  const result = useMemo(() => (answers && done ? matchPrograms(answers, today) : null), [answers, done, today]);

  const go = (n: number) => { moved.current = true; setStep(n); };
  const next = () => go(step + 1);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const finish = () => {
    moved.current = true;
    setDone(true);
    if (answers) {
      const r = matchPrograms(answers, today);
      track("check_done", { items: r.items.length, cost: answers.costMan !== null });
    }
  };
  const consult = (pid: ProgramId | null) => {
    setConsultProgram(pid);
    document.getElementById("consult")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const askCost = () => {
    setDone(false);
    go(steps.findIndex((s) => s.key === "cost"));
  };

  if (done && result && answers) {
    return (
      <div className="space-y-6">
        <section aria-labelledby={`${id}-res`} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
          <h1 id={`${id}-res`} ref={headRef} tabIndex={-1} className="scroll-mt-32 text-[24px] font-bold leading-[1.45] outline-none sm:text-[28px]">
            使えそうな制度 <span className="text-brand-deep">{result.items.length}件</span>
            <span className="block text-[15px] font-normal text-ink-soft">締切の近い順に並べています</span>
          </h1>
          <ul className="mt-3 flex flex-wrap gap-2 text-[13px]">
            {[labelOfOpt(CHECK_PREFS, answers.pref), labelOfOpt(CHECK_FACILITIES, answers.facility), answers.capacity ? labelOfOpt(CHECK_CAPACITIES, answers.capacity) : "", labelOfOpt(CHECK_CORPS, answers.corp), labelOfOpt(CHECK_WORKS, answers.work), answers.costMan !== null ? `工事費 ${answers.costMan.toLocaleString("ja-JP")}万円` : "工事費 未入力"]
              .filter(Boolean)
              .map((t) => <li key={t} className="rounded-full bg-paper-sub px-3 py-1 font-bold">{t}</li>)}
          </ul>
          <button type="button" onClick={() => { setDone(false); go(0); }} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-brand-deep underline underline-offset-4">
            <RotateCcw aria-hidden className="h-4 w-4" />答えを直す
          </button>
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[14px] leading-[1.75] text-amber-950">
            {COMMON_CAUTIONS.map((c) => (
              <p key={c} className="flex gap-2"><AlertTriangle aria-hidden className="mt-1 h-4 w-4 shrink-0" />{c}</p>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {result.items.map((i) => (
            <ProgramCard key={i.program.id} program={i.program} today={today} match={i} estimate={i.estimate} onConsult={consult} onAskCost={askCost} place="shindan" />
          ))}
          {result.showDropin && <DropinCard onConsult={() => consult(null)} />}
        </div>

        {result.items.length === 0 && !result.showDropin && (
          <p className="rounded-2xl bg-white p-5 text-[16px] leading-[1.8]">
            この条件では、3本柱の制度に当てはまるものが見つかりませんでした。区市町村の独自の補助があることもあります。下の相談からお問い合わせください。
          </p>
        )}

        {result.excluded.length > 0 && (
          <details className="rounded-2xl border border-ink-line bg-white">
            <summary className="flex min-h-[52px] cursor-pointer items-center px-4 text-[15px] font-bold">対象外の見込みの制度（{result.excluded.length}件）と理由</summary>
            <ul className="divide-y divide-ink-line border-t border-ink-line">
              {result.excluded.map((i) => (
                <li key={i.program.id} className="px-4 py-3 text-[15px] leading-[1.7]">
                  <b>{i.program.tag} {i.program.title}</b>
                  <span className="block text-ink-soft">{i.checks.join(" ")}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <ConsultForm source="shindan" programId={consultProgram === undefined ? result.items[0]?.program.id ?? null : consultProgram} answers={answers} />
      </div>
    );
  }

  const n = steps.length;
  return (
    <section aria-labelledby={`${id}-q`} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-center justify-between text-[14px] font-bold text-ink-soft">
        <span>質問 {step + 1} / {n}</span>
        <span>約1分</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-sub" aria-hidden>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / n) * 100}%` }} />
      </div>
      <h1 id={`${id}-q`} ref={headRef} tabIndex={-1} className="mt-5 scroll-mt-40 text-[23px] font-bold leading-[1.45] outline-none sm:text-[26px]">{cur.q}</h1>
      <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">{cur.hint}</p>

      <div className="mt-4" aria-live="polite">
        {cur.key === "pref" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECK_PREFS.map((o) => <Chip key={o.id} selected={d.pref === o.id} onClick={() => { set({ pref: o.id }); next(); }}>{o.label}</Chip>)}
          </div>
        )}
        {cur.key === "facility" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECK_FACILITIES.map((o) => <Chip key={o.id} selected={d.facility === o.id} onClick={() => { set({ facility: o.id, ...(asksCapacity(o.id) ? {} : { capacity: undefined }) }); next(); }}>{o.label}</Chip>)}
          </div>
        )}
        {cur.key === "capacity" && (
          <div className="grid gap-2 sm:grid-cols-3">
            {CHECK_CAPACITIES.map((o) => <Chip key={o.id} selected={d.capacity === o.id} onClick={() => { set({ capacity: o.id }); next(); }}>{o.label}</Chip>)}
          </div>
        )}
        {cur.key === "corp" && (
          <div className="space-y-4">
            <fieldset>
              <legend className="text-[14px] font-bold">法人の種類</legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {CHECK_CORPS.map((o) => <Chip key={o.id} selected={d.corp === o.id} onClick={() => set({ corp: o.id })}>{o.label}</Chip>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[14px] font-bold">従業員の数（法人全体・常時使用する従業員）</legend>
              <div className="mt-1 grid gap-2 sm:grid-cols-3">
                {CHECK_STAFF.map((o) => <Chip key={o.id} selected={d.staff === o.id} onClick={() => set({ staff: o.id })}>{o.label}</Chip>)}
              </div>
            </fieldset>
            <button type="button" disabled={!d.corp || !d.staff} onClick={next} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-brand-deep px-4 text-[16px] font-bold text-white disabled:opacity-40">次へ</button>
          </div>
        )}
        {cur.key === "work" && (
          <div className="grid gap-2">
            {CHECK_WORKS.map((o) => <Chip key={o.id} selected={d.work === o.id} onClick={() => { set({ work: o.id }); next(); }}>{o.label}</Chip>)}
          </div>
        )}
        {cur.key === "cost" && (
          <div className="space-y-4">
            <div>
              <label htmlFor={`${id}-cost`} className="block text-[14px] font-bold">工事費の目安（税抜・万円）</label>
              <div className="mt-1 flex items-center gap-2">
                <input id={`${id}-cost`} type="text" inputMode="numeric" placeholder="例：1000" value={d.costText} onChange={(e) => set({ costText: e.target.value })} className="min-h-[52px] w-full rounded-xl border border-ink-line bg-white px-3 text-[18px] font-bold" />
                <span className="shrink-0 text-[16px] font-bold">万円</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[300, 500, 1000, 3000, 5000].map((v) => (
                  <button key={v} type="button" onClick={() => set({ costText: String(v) })} className={cn("min-h-[40px] rounded-full border px-3 text-[14px] font-bold", toMan(d.costText) === v ? "border-brand-deep bg-brand-deep text-white" : "border-ink-line bg-white")}>
                    {v.toLocaleString("ja-JP")}万円
                  </button>
                ))}
              </div>
              {d.costText && toMan(d.costText) === null && <p className="mt-1 text-[14px] font-bold text-red-800">数字でご入力ください（例：1000）。</p>}
            </div>
            <div>
              <label htmlFor={`${id}-equip`} className="block text-[14px] font-bold">うち機器代（分かれば・税抜・万円）</label>
              <div className="mt-1 flex items-center gap-2">
                <input id={`${id}-equip`} type="text" inputMode="numeric" placeholder="例：600" value={d.equipText} onChange={(e) => set({ equipText: e.target.value })} className="min-h-[52px] w-full rounded-xl border border-ink-line bg-white px-3 text-[18px] font-bold" />
                <span className="shrink-0 text-[16px] font-bold">万円</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-soft">国の省エネ補助金（SII）は機器代だけが対象のため、分かると目安を出せます。</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={finish} disabled={!answers} className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-brand-deep px-4 text-[17px] font-bold text-white disabled:opacity-40">使えそうな制度を見る</button>
              <button type="button" onClick={() => { set({ costText: "", equipText: "" }); finish(); }} disabled={!answers} className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-brand-deep bg-white px-4 text-[16px] font-bold text-brand-deep disabled:opacity-40">分からないので飛ばす</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => go(step - 1)} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-brand-deep underline underline-offset-4">
            <ChevronLeft aria-hidden className="h-4 w-4" />ひとつ前へ
          </button>
        ) : <span />}
        <Link href="/" className="text-[14px] text-ink-soft underline underline-offset-4">トップへ</Link>
      </div>
      <p className="mt-4 text-[13px] leading-[1.7] text-ink-soft">答えはこの端末にも保存しません。相談を送ったときだけ、担当者に届きます。</p>
    </section>
  );
}
