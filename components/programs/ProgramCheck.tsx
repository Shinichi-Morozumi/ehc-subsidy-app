"use client";

/* ───────────────────────────────────────────────────────────
   v2 / 2026-10-29 / EHC-0102 使える補助金を調べる（/shindan）

   1問ずつ答える（スマホ前提・選ぶと次へ進む）。質問は5つで固定（10名のレビュー：途中で数が増えると分かりにくい）。
   施設の種類は入口に合わせて並べ替え（東京都・SII から来たら介護施設以外を先に）、介護施設なら定員も同じ画面で聞く。
   結果の頭に「可能性あり／要確認／対象外の見込み」の説明と、入口以外で受付が近い制度の知らせ、印刷・PDFで残すボタン。
   最後の「工事費の目安」は飛ばせる。入れると、制度カードに「結局いくら（目安）」を出す。
   結果は制度カード（lib/programMatch.ts の matchPrograms）を締切の近い順に。相談は3項目のフォーム。
   答えは端末に保存しない（相談を送るときだけ、担当者宛メールと Notion に運ぶ）。
   ─────────────────────────────────────────────────────────── */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, Printer, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { useTodayJst } from "@/lib/useToday";
import { COMMON_CAUTIONS, countdownLabel, type ProgramId } from "@/lib/programs";
import {
  CAPACITY_Q, CHECK_CAPACITIES, CHECK_CORPS, CHECK_FACILITIES, CHECK_PREFS, CHECK_STAFF, CHECK_STEPS, CHECK_WORKS, FACILITY_GROUPS, STAFF_HINT,
  asksCapacity, labelOfOpt, matchPrograms,
  type CheckAnswers, type CheckCapacityId, type CheckCorpId, type CheckFacilityId, type CheckPrefId, type CheckStaffId, type CheckWorkId,
} from "@/lib/programMatch";
import { ProgramCard } from "./ProgramCard";
import { ConsultForm } from "./ConsultForm";
import { DropinCard } from "./DropinCard";
import { NotifySignup } from "../NotifySignup";

type Focus = "tokyo" | "sii" | "kaigo";
const FOCUS: Record<Focus, { label: string; intro: string; ids: ProgramId[] }> = {
  tokyo: { label: "東京都の補助", intro: "東京都の補助（事務所・店舗・飲食店・工場・病院・介護施設など、業種を問わず）を、かんたんな質問（約1分）で調べます。事業所の省エネ設備の入れ替え（通称ゼロエミ）から介護施設の改修まで、答えに合う制度をカードで出します。", ids: ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu"] },
  sii: { label: "国の省エネ補助金（SII）", intro: "国の省エネ補助金（全国・業種を問わず。SII は国の事務局の名前です）を、かんたんな質問（約1分）で調べます。都や介護施設の補助で、より合うものがあれば一緒に出します。", ids: ["sii"] },
  kaigo: { label: "介護施設の補助", intro: "介護施設の補助（国の交付金・東京都の改修費など）を、かんたんな質問（約1分）で調べます。施設の種類と定員で、使える制度が変わります。", ids: ["kokuKaigo", "kokuKaigo30", "tokyoKaishu", "tokyoChiiki"] },
};

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
  const capRef = useRef<HTMLFieldSetElement | null>(null);
  const moved = useRef(false);

  /* 入口（ご指示 2026-10-29）：東京都・SII・介護施設のどこから入っても6問で振り分ける。入口の制度を結果の先頭にまとめる */
  const [focus, setFocus] = useState<Focus | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const f = q.get("for");
    if (f === "tokyo" || f === "sii" || f === "kaigo") setFocus(f);
    const from = q.get("from");
    track("check_open", { from: f ?? (from && /^[a-z]{1,12}$/.test(from) ? from : "direct") });
  }, []);

  const steps = CHECK_STEPS;
  const cur = steps[Math.min(step, steps.length - 1)];
  /* 施設の種類：入口が介護施設なら介護施設を先に、それ以外は介護施設以外を先に */
  const groups = focus === "kaigo" ? [FACILITY_GROUPS[1], FACILITY_GROUPS[0]] : [FACILITY_GROUPS[0], FACILITY_GROUPS[1]];
  const pickFacility = (fid: CheckFacilityId) => {
    if (asksCapacity(fid)) {
      set({ facility: fid, capacity: undefined });
      requestAnimationFrame(() => capRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    set({ facility: fid, capacity: undefined });
    next();
  };

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
  const printResult = () => {
    track("check_print", {});
    const opened: HTMLDetailsElement[] = [];
    document.querySelectorAll("details").forEach((el) => { if (!el.open) { el.open = true; opened.push(el); } });
    window.print();
    opened.forEach((el) => { el.open = false; });
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
            <span className="block text-[15px] font-normal text-ink-soft">{focus ? `${FOCUS[focus].label}を先に、それぞれ締切の近い順に並べています` : "締切の近い順に並べています"}</span>
          </h1>
          <p className="mt-3 text-[13px] font-bold text-ink-soft">あなたの答え</p>
          <ul className="mt-1 flex flex-wrap gap-2 text-[13px]">
            {[labelOfOpt(CHECK_PREFS, answers.pref), labelOfOpt(CHECK_FACILITIES, answers.facility), answers.capacity ? `定員 ${labelOfOpt(CHECK_CAPACITIES, answers.capacity)}` : "", labelOfOpt(CHECK_CORPS, answers.corp), `従業員 ${labelOfOpt(CHECK_STAFF, answers.staff)}`, labelOfOpt(CHECK_WORKS, answers.work), answers.costMan !== null ? `工事費 ${answers.costMan.toLocaleString("ja-JP")}万円` : "工事費 未入力"]
              .filter(Boolean)
              .map((t) => <li key={t} className="rounded-full bg-paper-sub px-3 py-1 font-bold">{t}</li>)}
          </ul>
          <div className="no-print mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <button type="button" onClick={() => { setDone(false); go(0); }} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-brand-deep underline underline-offset-4">
              <RotateCcw aria-hidden className="h-4 w-4" />答えを直す
            </button>
            <button type="button" onClick={printResult} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-brand-deep underline underline-offset-4">
              <Printer aria-hidden className="h-4 w-4" />この結果を印刷・PDFで残す
            </button>
          </div>
          <dl className="mt-3 grid gap-1.5 rounded-2xl border border-ink-line p-3 text-[14px] leading-[1.6]">
            {[
              ["可能性あり", "答えから見ると、対象になりそうです。", "bg-brand-deep text-white"],
              ["要確認", "あと少し確かめることがあります（カードの「確かめる点」）。", "bg-amber-100 text-amber-900 ring-1 ring-amber-300"],
              ...(result.excluded.length ? [["対象外の見込み", "いちばん下にまとめています。", "bg-stone-200 text-stone-700"]] : []),
            ].map(([k, v, cls]) => (
              <div key={k} className="flex flex-wrap items-center gap-2">
                <dt className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold", cls)}>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[14px] leading-[1.75] text-amber-950">
            {COMMON_CAUTIONS.map((c) => (
              <p key={c} className="flex gap-2"><AlertTriangle aria-hidden className="mt-1 h-4 w-4 shrink-0" />{c}</p>
            ))}
          </div>
        </section>

        {(() => {
          const fIds = focus ? FOCUS[focus].ids : [];
          const first = result.items.filter((i) => fIds.includes(i.program.id));
          const rest = result.items.filter((i) => !fIds.includes(i.program.id));
          /* 入口以外の制度で、30日以内に受付が始まる・終わるものは、先に知らせる（並びの下に埋もれないように） */
          const soon = focus ? rest.filter((i) => (i.next.state === "upcoming" ? i.next.daysToStart ?? 99 : i.next.daysToEnd ?? 99) <= 30) : [];
          const card = (i: (typeof result.items)[number]) => (
            <ProgramCard key={i.program.id} program={i.program} today={today} match={i} estimate={i.estimate} onConsult={consult} onAskCost={askCost} place="shindan" />
          );
          return (
            <>
              {soon.length > 0 && (
                <div className="rounded-2xl border-2 border-red-700/30 bg-red-50 p-4 text-[15px] leading-[1.7]">
                  <p className="font-bold text-red-800">ほかの制度にも、受付が近いものがあります</p>
                  <ul className="mt-1 space-y-1">
                    {soon.map((i) => (
                      <li key={i.program.id}>
                        <a href={`#program-${i.program.id}`} className="font-bold text-ink underline underline-offset-4">{i.program.tag} {i.program.title}</a>
                        <span className="ml-1 whitespace-nowrap text-[14px] font-bold text-red-800">{countdownLabel(i.next)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {focus && (
                <h2 className="text-[20px] font-bold">
                  {FOCUS[focus].label}で使えそうな制度 {first.length}件<span className="ml-1 text-[14px] font-normal text-ink-soft">（締切の近い順）</span>
                  {first.length === 0 && <span className="block text-[15px] font-normal text-ink-soft">この条件では見つかりませんでした。下のほかの制度をご覧ください。</span>}
                </h2>
              )}
              <div className="grid gap-6 lg:grid-cols-2">
                {(focus ? first : result.items).map(card)}
                {!focus && result.showDropin && <DropinCard onConsult={() => consult(null)} />}
              </div>
              {focus && (rest.length > 0 || result.showDropin) && (
                <>
                  <h2 className="pt-2 text-[20px] font-bold">ほかに使えそうな制度 {rest.length}件<span className="ml-1 text-[14px] font-normal text-ink-soft">（締切の近い順）</span></h2>
                  <div className="grid gap-6 lg:grid-cols-2">
                    {rest.map(card)}
                    {result.showDropin && <DropinCard onConsult={() => consult(null)} />}
                  </div>
                </>
              )}
            </>
          );
        })()}

        {result.items.length === 0 && !result.showDropin && (
          <p className="rounded-2xl bg-white p-5 text-[16px] leading-[1.8]">
            この条件では、このサイトに載せている制度（国・東京都・介護施設）に当てはまるものが見つかりませんでした。県・市区町村の独自の補助があることもあります。下の相談からお問い合わせください。
          </p>
        )}

        {result.items.some((i) => i.next.state === "none") && (
          <div className="no-print">
            <NotifySignup
              programNames={result.items.filter((i) => i.next.state === "none").map((i) => `${i.program.tag} ${i.program.title}`)}
              pref={labelOfOpt(CHECK_PREFS, answers.pref)}
              building={labelOfOpt(CHECK_FACILITIES, answers.facility)}
              timing={null}
            />
          </div>
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

        <div className="no-print">
          <ConsultForm
            source="shindan"
            programId={consultProgram ?? null}
            options={[...result.items.filter((i) => (focus ? FOCUS[focus].ids : []).includes(i.program.id)), ...result.items.filter((i) => !(focus ? FOCUS[focus].ids : []).includes(i.program.id))].map((i) => i.program.id)}
            preselect={consultProgram === undefined ? result.items.filter((i) => (focus ? FOCUS[focus].ids : []).includes(i.program.id)).slice(0, 1).map((i) => i.program.id) : []}
            answers={answers}
          />
        </div>
      </div>
    );
  }

  const n = steps.length;
  return (
    <section aria-labelledby={`${id}-q`} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-7">
      {focus && step === 0 && (
        <p className="mb-4 rounded-2xl bg-paper-tint px-4 py-3 text-[15px] leading-[1.8] text-ink">{FOCUS[focus].intro}</p>
      )}
      <div className="flex items-center justify-between text-[14px] font-bold text-ink-soft">
        <span>{focus ? `${FOCUS[focus].label}・` : ""}質問 {step + 1} / {n}</span>
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
          <div className="space-y-4">
            {groups.map((g) => (
              <fieldset key={g.id}>
                <legend className="text-[14px] font-bold text-ink-soft">{g.label}</legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {g.ids.map((fid) => {
                    const o = CHECK_FACILITIES.find((f) => f.id === fid)!;
                    return <Chip key={o.id} selected={d.facility === o.id} onClick={() => pickFacility(o.id)}>{o.label}</Chip>;
                  })}
                </div>
              </fieldset>
            ))}
            {asksCapacity(d.facility) && (
              <fieldset ref={capRef} className="scroll-mt-40 rounded-2xl border-2 border-brand-deep bg-paper-tint p-4">
                <legend className="px-1 text-[17px] font-bold">{CAPACITY_Q.q}</legend>
                <p className="text-[14px] leading-[1.7] text-ink-soft">{labelOfOpt(CHECK_FACILITIES, d.facility)}を選びました。{CAPACITY_Q.hint}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {CHECK_CAPACITIES.map((o) => <Chip key={o.id} selected={d.capacity === o.id} onClick={() => { set({ capacity: o.id }); next(); }}>{o.label}</Chip>)}
                </div>
              </fieldset>
            )}
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
              <legend className="text-[14px] font-bold">従業員の数（法人全体）</legend>
              <p className="text-[13px] leading-[1.7] text-ink-soft">{STAFF_HINT}</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-3">
                {CHECK_STAFF.map((o) => <Chip key={o.id} selected={d.staff === o.id} onClick={() => set({ staff: o.id })}>{o.label}</Chip>)}
              </div>
            </fieldset>
            <button type="button" disabled={!d.corp || !d.staff} onClick={next} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-brand-deep px-4 text-[16px] font-bold text-white disabled:opacity-40">次へ</button>
          </div>
        )}
        {cur.key === "work" && (
          <div className="grid gap-2">
            {CHECK_WORKS.map((o) => (
              <Chip key={o.id} selected={d.work === o.id} onClick={() => { set({ work: o.id }); next(); }}>
                {o.label}
                <span className={cn("mt-0.5 block text-[13px] font-normal", d.work === o.id ? "text-white/90" : "text-ink-soft")}>{o.hint}</span>
              </Chip>
            ))}
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
                {[100, 300, 500, 1000, 3000, 5000].map((v) => (
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
              <p className="mt-1 text-[13px] text-ink-soft">国の省エネ補助金（SII）は機器代（設備費）だけが対象のため、分かると目安を出せます。</p>
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
      <p className="mt-4 text-[13px] leading-[1.7] text-ink-soft">答えはこの端末にも保存しません。相談を送ったときだけ、担当者に届きます。結果の画面は、印刷・PDFで残せます。</p>
    </section>
  );
}
