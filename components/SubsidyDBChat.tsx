"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Subsidy } from "@/lib/types";
import { Bot, X, Check, HelpCircle, MessageCircle, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Answer = "yes" | "no" | "unknown";

const BIZ_LABEL: Record<string, string> = { business: "事業者（法人）", personal: "個人" };
const SIZE_LABEL: Record<string, string> = { sme: "中小企業", middle: "中堅企業", large: "大企業" };
const EQUIP_LABEL: Record<string, string> = { ac: "パッケージ空調", multi: "ビル用マルチ" };

// 要件テキストを1問ずつに分解
function splitRequirements(req: string): string[] {
  return req
    .split("。")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// お客様情報を持たないDBページ用に、補助金の条件を全て「質問」として組み立てる
function buildQuestions(s: Subsidy): { key: string; text: string }[] {
  const qs: { key: string; text: string }[] = [];
  if (s.pref !== "all") {
    qs.push({ key: "pref", text: `貴社の事業所（設置場所）は「${s.pref.join("・")}」にありますか？` });
  }
  qs.push({ key: "biz", text: `申請主体は「${s.biz.map((b) => BIZ_LABEL[b] || b).join("・")}」に当てはまりますか？` });
  qs.push({ key: "size", text: `企業規模は「${s.size.map((x) => SIZE_LABEL[x] || x).join("・")}」に当てはまりますか？` });
  qs.push({ key: "equip", text: `導入予定の設備は「${s.target.map((t) => EQUIP_LABEL[t] || t).join("・")}」ですか？` });
  splitRequirements(s.requirement).forEach((r, i) => qs.push({ key: `req${i}`, text: r }));
  return qs;
}

// ボタン＋モーダルをまとめた、DBカードに差し込む単体コンポーネント
export function SubsidyDBChatButton({ subsidy }: { subsidy: Subsidy }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ChatTriggerButton onClick={() => setOpen(true)} />
      {open && (
        <EligibilityChatModal
          title={subsidy.name}
          questions={buildQuestions(subsidy)}
          topNote={
            subsidy.closed
              ? "※ この補助金は今年度は受付終了しています。次期公募を前提とした事前確認としてご利用ください。"
              : undefined
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// 各カードで共通利用するトリガーボタン（同じUI/UX）
export function ChatTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="no-print inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-ehc-500/40 text-ehc-200 hover:bg-ehc-500/10 font-semibold"
    >
      <MessageCircle className="w-3.5 h-3.5" /> チャットで該当を確認
    </button>
  );
}

// 汎用の該当チェックチャット（質問リストを渡すだけでDB／Jグランツ両対応）
export function EligibilityChatModal({
  title,
  questions,
  topNote,
  footerNote,
  onClose,
}: {
  title: string;
  questions: { key: string; text: string }[];
  topNote?: string;
  footerNote?: string;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => questions.map(() => null));
  const [step, setStep] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [step, answers]);

  const done = step >= questions.length;
  const answer = (a: Answer) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[step] = a;
      return next;
    });
    setStep((s) => s + 1);
  };

  const verdict = useMemo(() => {
    if (answers.some((a) => a === "no")) return "no" as const;
    if (answers.some((a) => a === "unknown")) return "maybe" as const;
    if (answers.length > 0 && answers.every((a) => a === "yes")) return "yes" as const;
    return "maybe" as const;
  }, [answers]);

  const verdictView =
    verdict === "yes"
      ? { icon: <CheckCircle2 className="w-5 h-5" />, title: "◎ 該当見込みです", cls: "bg-ehc-500/15 border-ehc-500/40 text-ehc-200", note: "条件・要件ともに満たしています。EHCが申請書類の作成を代行し、採択率を高めます。" }
      : verdict === "maybe"
      ? { icon: <AlertTriangle className="w-5 h-5" />, title: "△ 要確認です", cls: "bg-amber-500/10 border-amber-500/30 text-amber-300", note: "「わからない」項目があります。現地調査でEHC担当が実態を確認し、該当可否を確定します。" }
      : { icon: <XCircle className="w-5 h-5" />, title: "✕ このままでは非該当の可能性", cls: "bg-red-500/10 border-red-500/30 text-red-300", note: "満たせない条件があります。要件を満たす方法や、他の補助金への切替をEHCが提案します。" };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4 no-print">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-[min(560px,100%)] max-h-[85vh] flex flex-col rounded-2xl border-2 border-ehc-400/40 bg-gradient-to-br from-ehc-900/30 via-night-900 to-night-800 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 bg-night-900/80">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ehc-500 to-ehc-700 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate">該当チェック AI</div>
            <div className="text-[11px] text-slate-400 truncate">{title}</div>
          </div>
          <button onClick={onClose} aria-label="閉じる" className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 会話エリア */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <Bubble>
            「{title}」に該当するか、条件と要件を1問ずつ確認します（全{questions.length}問）。
            {topNote && <span className="block mt-1 text-amber-300">{topNote}</span>}
          </Bubble>

          {/* 回答済み */}
          {questions.map((q, i) => {
            if (answers[i] === null || i > step) return null;
            return (
              <div key={q.key} className="space-y-1.5">
                <Bubble>
                  <span className="text-[11px] text-ehc-300 font-semibold">確認 {i + 1}/{questions.length}</span>
                  <br />
                  {q.text}
                </Bubble>
                {answers[i] && i < step && (
                  <div className="flex justify-end">
                    <span className="text-xs px-3 py-1.5 rounded-xl bg-cobalt-600/30 border border-cobalt-500/40 text-cobalt-100">
                      {answers[i] === "yes" ? "はい" : answers[i] === "no" ? "いいえ" : "わからない"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* 現在の質問 */}
          {!done && questions[step] && answers[step] === null && (
            <Bubble>
              <span className="text-[11px] text-ehc-300 font-semibold">確認 {step + 1}/{questions.length}</span>
              <br />
              {questions[step].text}
            </Bubble>
          )}

          {/* 判定結果 */}
          {done && (
            <div className={`rounded-xl border p-3.5 ${verdictView.cls}`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {verdictView.icon}
                {verdictView.title}
              </div>
              <p className="text-xs mt-1.5 leading-relaxed text-slate-200/90">{verdictView.note}</p>
              {footerNote && <p className="text-[10px] text-slate-300/80 mt-2">{footerNote}</p>}
              <p className="text-[10px] text-slate-400 mt-2">
                ※ 最終的な採択可否は各補助金事務局の審査によります。本判定は目安です。
              </p>
            </div>
          )}
        </div>

        {/* 操作エリア */}
        <div className="border-t border-white/10 px-4 py-3 bg-night-900/80">
          {!done ? (
            <div className="grid grid-cols-3 gap-2">
              <ActionBtn onClick={() => answer("yes")} tone="ok" icon={<Check className="w-4 h-4" />}>
                はい
              </ActionBtn>
              <ActionBtn onClick={() => answer("no")} tone="ng" icon={<XCircle className="w-4 h-4" />}>
                いいえ
              </ActionBtn>
              <ActionBtn onClick={() => answer("unknown")} tone="neutral" icon={<HelpCircle className="w-4 h-4" />}>
                わからない
              </ActionBtn>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 text-white text-sm font-bold hover:from-ehc-500 hover:to-ehc-400 transition-colors"
            >
              閉じる
            </button>
          )}
          {!done && (
            <button onClick={onClose} className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 mt-2">
              あとで確認する（閉じる）
            </button>
          )}
        </div>
      </div>
    </div>
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

function ActionBtn({
  children,
  onClick,
  tone,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "ok" | "ng" | "neutral";
  icon: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-ehc-500/40 text-ehc-200 hover:bg-ehc-500/15"
      : tone === "ng"
      ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
      : "border-white/15 text-slate-300 hover:bg-white/5";
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${cls}`}
    >
      {icon}
      {children}
    </button>
  );
}
