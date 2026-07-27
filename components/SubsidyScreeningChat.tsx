"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Subsidy, MatchInput } from "@/lib/types";
import { Bot, X, Check, CheckCircle2, AlertTriangle, XCircle, CalendarClock } from "lucide-react";

/* ------------------------------------------------------------------
   全制度 一括スクリーニング
   「どの補助金を選ぶか」の前に、まず ①該当可否 ②公募時期に間に合うか を
   まとめて確認するための診断。制度ごとの細かい要件チェックは
   SubsidyEligibilityChat（③のボタン）が引き続き担当する。
------------------------------------------------------------------- */

export type ScreenVerdict = "yes" | "maybe" | "no";
export type TimingKey = "open" | "upcoming" | "closed" | "unknown";

export interface TimingInfo {
  key: TimingKey;
  label: string;
  detail: string;
}

export interface ScreeningResult {
  /** 診断した日時（ISO） */
  at: string;
  /** 共通条件から出した全体判定 */
  overall: ScreenVerdict;
  /** 制度ID → 判定 */
  verdictById: Record<string, ScreenVerdict>;
  /** 制度ID → 公募時期の状況 */
  timingById: Record<string, TimingInfo>;
  /** 導入予定時期の回答 */
  planHorizon: string;
}

type Choice = { label: string; verdict: ScreenVerdict };
type Question = { id: string; text: string; hint: string; choices: Choice[] };

const QUESTIONS: Question[] = [
  {
    id: "horizon",
    text: "今回の空調更新は、いつ頃の実施を予定していますか？",
    hint: "補助金は「交付決定 → 発注・工事 → 実績報告」の順で進みます。公募回に間に合うかの判断に使います。",
    choices: [
      { label: "3ヶ月以内に進めたい", verdict: "yes" },
      { label: "半年〜1年以内", verdict: "yes" },
      { label: "時期は未定（情報収集中）", verdict: "maybe" },
    ],
  },
  {
    id: "ordered",
    text: "対象設備は、すでに発注・着工していますか？",
    hint: "ほぼ全ての補助金は「交付決定より前の発注・着工」を対象外としています。ここが最も多い失格理由です。",
    choices: [
      { label: "まだ発注していない", verdict: "yes" },
      { label: "すでに発注・着工済み", verdict: "no" },
      { label: "わからない", verdict: "maybe" },
    ],
  },
  {
    id: "spec",
    text: "省エネ性能の高い指定機種への入替でよろしいですか？（機種選定はEHCが行います）",
    hint: "補助対象は省エネ基準を満たす指定機種に限られます。選定はEHC側で行うため、通常は「はい」で問題ありません。",
    choices: [
      { label: "はい（EHCに任せる）", verdict: "yes" },
      { label: "指定機種以外にしたい", verdict: "no" },
      { label: "わからない", verdict: "maybe" },
    ],
  },
  {
    id: "docs",
    text: "直近1年の電気料金明細と、既設機器のリスト（型番・台数）はご用意できますか？",
    hint: "省エネ計算書の作成に必須の資料です。作成自体はEHCが代行します。",
    choices: [
      { label: "用意できる", verdict: "yes" },
      { label: "用意が難しい", verdict: "maybe" },
      { label: "わからない", verdict: "maybe" },
    ],
  },
  {
    id: "gbiz",
    text: "GビズIDプライム（電子申請用のID）は取得済みですか？",
    hint: "多くの制度が電子申請のみです。未取得でも申請は可能ですが、発行に2〜3週間かかるため早めの着手が必要です。",
    choices: [
      { label: "取得済み", verdict: "yes" },
      { label: "未取得（これから取る）", verdict: "maybe" },
      { label: "わからない", verdict: "maybe" },
    ],
  },
];

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 公募日程と今日の日付から、受付状況を判定する */
export function timingOf(s: Subsidy, now: Date): TimingInfo {
  const open = s.applyOpen ? new Date(`${s.applyOpen}T00:00:00+09:00`) : null;
  const close = s.applyClose ? new Date(`${s.applyClose}T23:59:59+09:00`) : null;

  if (s.closed) {
    return { key: "closed", label: "今年度は受付終了", detail: s.scheduleNote || "次回公募の発表待ちです。" };
  }
  if (close && now.getTime() > close.getTime()) {
    return { key: "closed", label: "この回は受付終了", detail: s.scheduleNote || "次回公募の日程発表を待つ必要があります。" };
  }
  if (open && now.getTime() < open.getTime()) {
    return {
      key: "upcoming",
      label: `${fmtDate(s.applyOpen)} 受付開始`,
      detail: s.scheduleNote || `${fmtDate(s.applyOpen)}〜${fmtDate(s.applyClose)} の受付です。今のうちに書類を準備できます。`,
    };
  }
  if (close) {
    const days = Math.ceil((close.getTime() - now.getTime()) / 86400000);
    return {
      key: "open",
      label: `受付中（残り ${days} 日）`,
      detail: s.scheduleNote || `${fmtDate(s.applyClose)} 締切。今回の回に申請できます。`,
    };
  }
  return { key: "unknown", label: "日程未定", detail: s.scheduleNote || "公募日程が未公表です。発表され次第ご連絡します。" };
}

export function SubsidyScreeningChat({
  input,
  candidates,
  onDone,
  onClose,
}: {
  input: MatchInput;
  candidates: Subsidy[];
  onDone: (r: ScreeningResult) => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<(ScreenVerdict | null)[]>(() => QUESTIONS.map(() => null));
  const [labels, setLabels] = useState<(string | null)[]>(() => QUESTIONS.map(() => null));
  const [step, setStep] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [step, answers]);

  const done = step >= QUESTIONS.length;

  const pick = (c: Choice) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[step] = c.verdict;
      return next;
    });
    setLabels((prev) => {
      const next = [...prev];
      next[step] = c.label;
      return next;
    });
    setStep((s) => s + 1);
  };

  const overall: ScreenVerdict = useMemo(() => {
    if (answers.some((a) => a === "no")) return "no";
    if (answers.some((a) => a === "maybe" || a === null)) return "maybe";
    return "yes";
  }, [answers]);

  const now = useMemo(() => new Date(), []);
  const timings = useMemo(() => {
    const m: Record<string, TimingInfo> = {};
    candidates.forEach((s) => (m[s.id] = timingOf(s, now)));
    return m;
  }, [candidates, now]);

  const verdicts = useMemo(() => {
    const m: Record<string, ScreenVerdict> = {};
    candidates.forEach((s) => {
      // 共通条件がNGなら制度によらずNG。情報提供のみの制度は「要確認」止まり。
      m[s.id] = overall === "no" ? "no" : s.infoOnly ? "maybe" : overall;
    });
    return m;
  }, [candidates, overall]);

  const view =
    overall === "yes"
      ? {
          icon: <CheckCircle2 className="w-5 h-5" />,
          title: "◎ 補助金に該当する見込みです",
          cls: "bg-ehc-500/15 border-ehc-500/40 text-ehc-200",
          note: "共通条件はすべてクリアしています。あとは制度ごとの個別要件を確認して申請に進めます。",
        }
      : overall === "maybe"
      ? {
          icon: <AlertTriangle className="w-5 h-5" />,
          title: "△ 該当の可能性あり（要確認）",
          cls: "bg-amber-500/10 border-amber-500/30 text-amber-300",
          note: "判断が保留の項目があります。現地調査でEHC担当が実態を確認し、該当可否を確定します。",
        }
      : {
          icon: <XCircle className="w-5 h-5" />,
          title: "✕ このままでは対象外の可能性が高い",
          cls: "bg-red-500/10 border-red-500/30 text-red-300",
          note: "補助金の前提条件を満たさない回答があります。進め方を変えれば対象にできる場合があるため、EHC担当にご相談ください。",
        };

  const finish = () =>
    onDone({
      at: new Date().toISOString(),
      overall,
      verdictById: verdicts,
      timingById: timings,
      planHorizon: labels[0] || "未回答",
    });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4 no-print">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-[min(600px,100%)] max-h-[88vh] flex flex-col rounded-2xl border-2 border-ehc-400/40 bg-gradient-to-br from-ehc-900/30 via-night-900 to-night-800 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 bg-night-900/80">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ehc-500 to-ehc-700 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate">補助金 該当診断 AI</div>
            <div className="text-[11px] text-slate-400 truncate">
              {input.pref}・候補 {candidates.length} 制度をまとめて判定します
            </div>
          </div>
          <button onClick={onClose} aria-label="閉じる" className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 会話エリア */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <Bubble>
            補助金が使えるかどうかを先に確認しましょう。所在地・事業規模・対象設備は入力内容から自動で判定済みです。
            ここでは<strong className="text-ehc-200">どの制度にも共通する前提条件</strong>を {QUESTIONS.length} 問だけ伺います。
          </Bubble>

          {QUESTIONS.map((q, i) => {
            if (i > step) return null;
            return (
              <div key={q.id} className="space-y-1.5">
                <Bubble>
                  <span className="text-[11px] text-ehc-300 font-semibold">
                    質問 {i + 1}/{QUESTIONS.length}
                  </span>
                  <br />
                  {q.text}
                  {i === step && (
                    <span className="block mt-1.5 text-[11px] text-slate-400 leading-relaxed border-l-2 border-ehc-500/30 pl-2">
                      なぜ聞くか：{q.hint}
                    </span>
                  )}
                </Bubble>
                {labels[i] && (
                  <div className="flex justify-end">
                    <span className="text-xs px-3 py-1.5 rounded-xl bg-cobalt-600/30 border border-cobalt-500/40 text-cobalt-100">
                      {labels[i]}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {done && (
            <>
              <div className={`rounded-xl border p-3.5 ${view.cls}`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  {view.icon}
                  {view.title}
                </div>
                <p className="text-xs mt-1.5 leading-relaxed text-slate-200/90">{view.note}</p>
              </div>

              <Bubble>
                続いて<strong className="text-ehc-200">公募時期</strong>です。候補制度が今どの状態かをまとめました。
              </Bubble>

              <div className="space-y-2">
                {candidates.map((s) => {
                  const t = timings[s.id];
                  const v = verdicts[s.id];
                  return (
                    <div key={s.id} className="rounded-xl border border-white/10 bg-night-900 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-100 leading-snug">{s.name}</div>
                        <VerdictChip v={v} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <CalendarClock className={`w-3.5 h-3.5 flex-shrink-0 ${timingTone(t.key).icon}`} />
                        <span className={`text-[11px] font-semibold ${timingTone(t.key).text}`}>{t.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{t.detail}</p>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                ※ 本判定は目安です。最終的な採択可否は各補助金事務局の審査によります。公募日程は制度側の発表により変わります。
              </p>
            </>
          )}
        </div>

        {/* 操作エリア */}
        <div className="border-t border-white/10 px-4 py-3 bg-night-900/80">
          {!done ? (
            <div className="grid grid-cols-1 gap-1.5">
              {QUESTIONS[step].choices.map((c) => (
                <button
                  key={c.label}
                  onClick={() => pick(c)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    c.verdict === "yes"
                      ? "border-ehc-500/40 text-ehc-200 hover:bg-ehc-500/15"
                      : c.verdict === "no"
                      ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
                      : "border-white/15 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {c.label}
                </button>
              ))}
              <button onClick={onClose} className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 mt-1">
                あとで確認する（閉じる）
              </button>
            </div>
          ) : (
            <button
              onClick={finish}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 text-white text-sm font-bold hover:from-ehc-500 hover:to-ehc-400 transition-colors"
            >
              <Check className="w-4 h-4" />
              診断結果を反映して、適用可能な補助金を見る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function timingTone(k: TimingKey) {
  if (k === "open") return { text: "text-ehc-300", icon: "text-ehc-400" };
  if (k === "upcoming") return { text: "text-cobalt-200", icon: "text-cobalt-300" };
  if (k === "closed") return { text: "text-amber-300", icon: "text-amber-400" };
  return { text: "text-slate-400", icon: "text-slate-500" };
}

export function VerdictChip({ v }: { v: ScreenVerdict }) {
  const map = {
    yes: { label: "該当見込み", cls: "bg-ehc-500/15 text-ehc-300 border-ehc-500/30" },
    maybe: { label: "要確認", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    no: { label: "対象外の可能性", cls: "bg-red-500/10 text-red-300 border-red-500/30" },
  } as const;
  const m = map[v];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0 ${m.cls}`}>{m.label}</span>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <div className="w-6 h-6 rounded-full bg-ehc-600/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-ehc-200" />
      </div>
      <div className="text-xs text-slate-200 leading-relaxed bg-white/5 border border-white/10 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
        {children}
      </div>
    </div>
  );
}
