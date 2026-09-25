/* ───────────────────────────────────────────────────────────
   問い合わせに載せる「補助金の候補と適合チェック」を組み立てる（2026-09-25）

   C段（結果と根拠）と同じ判定結果（assessments）から、同じ仕分け
   （今回の公募で進められる／次回の公募に備える）で、上位の制度だけを並べる。
   仕分けの条件は ResultStage.tsx と同じ lib/prep.ts の judgePrep() を使う。
   適合チェックの1行は lib/selfCheck.ts の evaluateSelfCheck() の見出しそのもの。
   ─────────────────────────────────────────────────────────── */

import type { ProgramAssessment } from "./ProgramMatchBoard";
import type { SnapshotSubsidyCheck } from "@/lib/diagnosisSnapshot";
import { judgePrep } from "@/lib/prep";
import { FIT_LABEL } from "@/lib/fitLabels";
import {
  SELF_CHECK_QUESTIONS,
  evaluateSelfCheck,
  ehcCheckItemsFor,
  selfCheckKeysFor,
  type SelfCheckAnswers,
  type SelfCheckKey,
} from "@/lib/selfCheck";

const MAX_PROGRAMS = 5;

const manYen = (v: number) => v.toLocaleString("ja-JP", { maximumFractionDigits: 1 });

export function buildSubsidyCheckSummary(
  assessments: ProgramAssessment[],
  answers: SelfCheckAnswers,
  now: Date = new Date()
): SnapshotSubsidyCheck | null {
  const promising = assessments.filter((a) => a.fit.level === "high" || a.fit.level === "possible");
  const prepOf = (a: ProgramAssessment) => (a.subsidy.status === "open" ? judgePrep(a.subsidy, now) : null);
  const rank = (a: ProgramAssessment) => (a.fit.level === "high" ? 0 : 1);
  const current = promising.filter((a) => prepOf(a)?.verdict !== "short").sort((x, y) => rank(x) - rank(y));
  const next = promising.filter((a) => prepOf(a)?.verdict === "short").sort((x, y) => rank(x) - rank(y));
  const ordered = [
    ...current.map((a) => ({ a, group: "今回の公募で進められる" })),
    ...next.map((a) => ({ a, group: "次回の公募に備える" })),
  ].slice(0, MAX_PROGRAMS);

  const programs = ordered.map(({ a, group }) => {
    const hasCheck = selfCheckKeysFor(a.subsidy).length > 0;
    const res = hasCheck
      ? evaluateSelfCheck({
          subsidy: a.subsidy,
          fitLevel: a.fit.level,
          fitWhy: a.fit.why,
          answers,
          prepVerdict: prepOf(a)?.verdict ?? null,
        })
      : null;
    return {
      name: a.subsidy.name,
      group,
      fit: FIT_LABEL[a.fit.level],
      timing: a.timing,
      amount: a.amountShown ? `最大 約${manYen(a.potentialManYen)}万円${group === "次回の公募に備える" ? "（参考）" : ""}` : null,
      selfCheck: res ? (res.started ? res.headline : "未実施") : null,
      ehcItems: ehcCheckItemsFor(a.subsidy),
    };
  });

  /* 回答は、並べた制度のどれかで伺う問いだけを載せる（SII が無いのにポータルの問いを載せない） */
  const keys = new Set<SelfCheckKey>();
  ordered.forEach(({ a }) => selfCheckKeysFor(a.subsidy).forEach((k) => keys.add(k)));
  const order: SelfCheckKey[] = ["contract", "sizeDocs", "siiPortal"];
  const answerRows = order
    .filter((k) => keys.has(k))
    .map((k) => {
      const q = SELF_CHECK_QUESTIONS[k];
      const v = answers[k];
      const label = v == null ? "未回答" : q.options.find((o) => o.value === v)?.label ?? String(v);
      return { question: q.title, answer: label };
    });

  if (!programs.length && !answerRows.length) return null;
  return { answers: answerRows, programs };
}
