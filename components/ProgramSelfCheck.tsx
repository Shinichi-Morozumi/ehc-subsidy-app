"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, Clock, XCircle, ClipboardCheck, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Subsidy } from "@/lib/types";
import type { FitLevel5 } from "@/lib/eligibility";
import type { PrepVerdict } from "@/lib/prep";
import {
  SELF_CHECK_QUESTIONS,
  evaluateSelfCheck,
  selfCheckKeysFor,
  type SelfCheckAnswers,
  type SelfCheckKey,
  type SelfCheckOutcome,
} from "@/lib/selfCheck";

/* ───────────────────────────────────────────────────────────
   「この制度に合うか、今確認する」（2026-09-25）
   制度カードの中に置く小さな確認。問いは2〜3問で、答えるたびに結果が変わる。
   回答は全制度で共通（契約の有無や書類の有無は、制度ごとに変わらない）なので、
   1枚のカードで答えれば、ほかのカードにも同じ回答が入る。
   判定は lib/eligibility.ts、言葉のまとめは lib/selfCheck.ts が持つ。
   ─────────────────────────────────────────────────────────── */

const OUTCOME_VIEW: Record<SelfCheckOutcome, { icon: typeof CheckCircle2; tone: string }> = {
  ok: { icon: CheckCircle2, tone: "border-brand/40 bg-[#edf6e8] text-brand-deep" },
  next_round: { icon: Clock, tone: "border-ink-line bg-paper-tint text-ink" },
  todo: { icon: HelpCircle, tone: "border-amber-500/45 bg-amber-50 text-amber-900" },
  wait: { icon: Clock, tone: "border-ink-line bg-paper-tint text-ink" },
  warn: { icon: AlertTriangle, tone: "border-red-700/40 bg-red-50 text-red-800" },
  ng: { icon: XCircle, tone: "border-ink-line bg-paper-sub text-ink" },
};

const ITEM_MARK: Record<"ok" | "warn" | "todo", { mark: string; cls: string; sr: string }> = {
  ok: { mark: "✓", cls: "text-brand-deep", sr: "満たしている" },
  warn: { mark: "！", cls: "text-red-700", sr: "注意" },
  todo: { mark: "？", cls: "text-amber-800", sr: "まだ確認が必要" },
};

export function ProgramSelfCheck({
  subsidy,
  fitLevel,
  fitWhy,
  prepVerdict,
  answers,
  onAnswer,
  defaultOpen = false,
}: {
  subsidy: Subsidy;
  fitLevel: FitLevel5;
  fitWhy: string[];
  prepVerdict: PrepVerdict | null;
  answers: SelfCheckAnswers;
  onAnswer: (key: SelfCheckKey, value: string) => void;
  defaultOpen?: boolean;
}) {
  const keys = selfCheckKeysFor(subsidy);
  const [open, setOpen] = useState(defaultOpen);
  if (keys.length === 0) return null;
  const result = evaluateSelfCheck({ subsidy, fitLevel, fitWhy, answers, prepVerdict });
  const view = OUTCOME_VIEW[result.outcome];
  const Icon = view.icon;
  const panelId = `self-check-${subsidy.id}`;

  return (
    <div className="ehc-self-check mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left text-[16px] font-bold leading-[1.5]",
          open ? "border-brand bg-[#edf6e8] text-brand-deep" : "border-brand bg-paper-card text-brand-deep hover:bg-[#f0f6df]",
          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
        )}
      >
        <span className="flex items-center gap-2">
          <ClipboardCheck aria-hidden className="h-5 w-5 shrink-0" />
          {result.started ? "この制度に合うか、確認した結果" : "この制度に合うか、今確認する"}
        </span>
        <span className="shrink-0 text-[14px] font-semibold text-ink-soft">
          {open ? "閉じる" : result.started ? "開く" : `${keys.length}問・約30秒`}
        </span>
      </button>

      {!open && result.started && (
        <p className={cn("mt-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-[14px] font-bold leading-[1.6]", view.tone)}>
          <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {result.headline}
        </p>
      )}

      {open && (
        <div id={panelId} className="mt-3 space-y-4 rounded-2xl border border-ink-line bg-paper-card p-4">
          {keys.map((key, i) => {
            const q = SELF_CHECK_QUESTIONS[key];
            const current = answers[key];
            return (
              <fieldset key={key}>
                <legend className="text-[16px] font-bold leading-[1.6] text-ink">
                  <span className="mr-1 text-brand-deep">Q{i + 1}.</span>
                  {q.title}
                </legend>
                <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">{q.help}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {q.options.map((o) => {
                    const on = current === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onAnswer(key, o.value)}
                        className={cn(
                          "min-h-[48px] rounded-xl border-[1.5px] px-3 py-2 text-left text-[15px] font-semibold leading-[1.5]",
                          on ? "border-brand bg-[#edf6e8] text-ink ring-1 ring-brand" : "border-[#57685e] bg-paper-card text-ink hover:border-brand",
                          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                        )}
                      >
                        {on ? "✓ " : ""}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div role="status" aria-live="polite" className={cn("rounded-2xl border p-4", view.tone)}>
            <p className="flex items-start gap-2 text-[16px] font-bold leading-[1.6]">
              <Icon aria-hidden className="mt-1 h-5 w-5 shrink-0" />
              {result.headline}
            </p>
            {result.detail && <p className="mt-1 text-[14px] leading-[1.7]">{result.detail}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[14px] font-bold leading-[1.7] text-ink">ご自身で確かめた条件</p>
              <ul className="mt-1 space-y-1.5">
                {result.items.map((it) => {
                  const m = ITEM_MARK[it.state];
                  return (
                    <li key={it.key} className="text-[14px] leading-[1.6] text-ink">
                      <span aria-hidden className={cn("mr-1 font-bold", m.cls)}>{m.mark}</span>
                      <span className="sr-only">{m.sr}：</span>
                      {it.question.replace(/？$/, "")}：<b>{it.answer}</b>
                      {it.note && <span className="block pl-5 text-ink-soft">{it.note}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[14px] font-bold leading-[1.7] text-ink">
                <Search aria-hidden className="h-4 w-4" /> EHC が確認すること
              </p>
              <ul className="mt-1 space-y-1.5">
                {result.ehcItems.map((t) => (
                  <li key={t} className="text-[14px] leading-[1.6] text-ink-soft">・{t}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-[13px] leading-[1.7] text-ink-soft">
            ご回答にもとづく目安で、申請できることや採択を保証するものではありません。
            ご相談を送信すると、この回答と結果も担当者に届きます。
          </p>
        </div>
      )}
    </div>
  );
}
