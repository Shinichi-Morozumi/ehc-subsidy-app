"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Subsidy, MatchInput } from "@/lib/types";
import { Bot, X, Check, HelpCircle, MinusCircle, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Answer = "yes" | "no" | "unknown";

const BIZ_LABEL: Record<string, string> = { business: "事業者（法人）", personal: "個人" };
const SIZE_LABEL: Record<string, string> = { sme: "中小企業", middle: "中堅企業", large: "大企業" };
const EQUIP_LABEL: Record<string, string> = { ac: "パッケージ空調", multi: "ビル用マルチ" };

type Choice = { label: string; answer: Answer };

// 要件文（専門的で分かりにくい）を、素人にも伝わる平易なヒントに変換する
function reqHint(r: string): string {
  if (/診断|計画/.test(r))
    return "省エネ診断の受診や、簡単な省エネ計画書の作成が条件です。作成はEHCが代行できるので、今なくても「はい」で問題ありません。";
  if (/高効率|省エネ設備|指定|APF|基準/.test(r))
    return "省エネ性能の高い指定機種を入れることが条件です。対象機種はEHCが選ぶので、通常は満たせます。";
  if (/事業所|所在|都内|区内|市内|地域|県内/.test(r))
    return "対象エリア内に設備を設置する事業所であることが条件です。設置先の建物の住所で判断します。";
  if (/CO2|削減|t-|トン/.test(r))
    return "一定量以上のCO2削減が条件です。試算はEHCが行います。判断が難しければ「わからない」で大丈夫です。";
  if (/中小|規模|従業員|資本/.test(r))
    return "会社の規模に関する条件です。多くの中小企業が当てはまります。迷う場合は「わからない」を選んでください。";
  return "専門的で分かりにくい場合は、無理に判断せず「わからない」を選んでください。EHCが実態を確認して判定します。";
}

// 「わからない」を押したときに出す、平易な選択肢
function reqChoices(r: string): Choice[] {
  const yesLabel =
    /診断|計画|高効率|省エネ設備|指定/.test(r) ? "はい（EHCに任せれば満たせる）" : "はい（満たせる）";
  return [
    { label: yesLabel, answer: "yes" },
    { label: "いいえ（満たせない）", answer: "no" },
    { label: "判断できない（EHCに確認してほしい）", answer: "unknown" },
  ];
}

// 構造条件（地域・規模・業種区分・対象設備）は、この補助金が「マッチ結果」に
// 出ている時点で match.ts のフィルタを通過済み。ここでは確認済みとして提示する。
function structuralChecks(subsidy: Subsidy, input: MatchInput): { label: string; ok: boolean }[] {
  const equipTypes = Array.from(new Set(input.equipGroups.map((g) => g.equip)));
  const equipHit = equipTypes.filter((t) => subsidy.target.includes(t));
  return [
    {
      label: `対象地域: ${subsidy.pref === "all" ? "全国対象" : subsidy.pref.join("・") + " が対象"}（お客様所在地: ${input.pref}）`,
      ok: subsidy.pref === "all" || subsidy.pref.includes(input.pref),
    },
    {
      label: `事業規模: ${subsidy.size.map((s) => SIZE_LABEL[s]).join("・")} が対象（お客様: ${SIZE_LABEL[input.size] || input.size}）`,
      ok: subsidy.size.includes(input.size),
    },
    {
      label: `区分: ${subsidy.biz.map((b) => BIZ_LABEL[b]).join("・")} が対象（お客様: ${BIZ_LABEL[input.bizType] || input.bizType}）`,
      ok: subsidy.biz.includes(input.bizType),
    },
    {
      label: `対象設備: ${subsidy.target.map((t) => EQUIP_LABEL[t]).join("・")}（お客様設備: ${equipHit.map((t) => EQUIP_LABEL[t]).join("・") || "なし"}）`,
      ok: equipHit.length > 0,
    },
  ];
}

export function SubsidyEligibilityChat({
  subsidy,
  input,
  reqs,
  onApply,
  onClose,
}: {
  subsidy: Subsidy;
  input: MatchInput;
  reqs: string[];
  onApply: (checks: boolean[]) => void;
  onClose: () => void;
}) {
  const structural = useMemo(() => structuralChecks(subsidy, input), [subsidy, input]);
  const structuralOk = structural.every((c) => c.ok);

  // 各要件への回答。毎回まっさらな状態から1問ずつ確認する。
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => reqs.map(() => null));
  const [step, setStep] = useState<number>(0);
  const [helpOpen, setHelpOpen] = useState(false); // 「わからない」を押したときの補助選択肢

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [step, answers]);

  const done = step >= reqs.length;
  const answer = (a: Answer) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[step] = a;
      return next;
    });
    setHelpOpen(false);
    setStep((s) => s + 1);
  };

  // 判定
  const verdict = useMemo(() => {
    if (!structuralOk) return { key: "no" as const };
    if (answers.some((a) => a === "no")) return { key: "no" as const };
    if (answers.some((a) => a === "unknown")) return { key: "maybe" as const };
    if (answers.every((a) => a === "yes")) return { key: "yes" as const };
    return { key: "maybe" as const };
  }, [structuralOk, answers]);

  const verdictView =
    verdict.key === "yes"
      ? { icon: <CheckCircle2 className="w-5 h-5" />, title: "◎ 該当見込みです", cls: "bg-ehc-500/15 border-ehc-500/40 text-ehc-200", note: "構造条件・要件ともに満たしています。EHCが申請書類の作成を代行し、採択率を高めます。" }
      : verdict.key === "maybe"
      ? { icon: <AlertTriangle className="w-5 h-5" />, title: "△ 要確認です", cls: "bg-amber-500/10 border-amber-500/30 text-amber-300", note: "「わからない」項目があります。現地調査でEHC担当が実態を確認し、該当可否を確定します。" }
      : { icon: <XCircle className="w-5 h-5" />, title: "✕ このままでは非該当の可能性", cls: "bg-red-500/10 border-red-500/30 text-red-300", note: "満たせない要件があります。要件を満たす方法や、他の補助金への切替をEHCが提案します。" };

  const applyResult = () => onApply(answers.map((a) => a === "yes"));

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
            <div className="text-[11px] text-slate-400 truncate">{subsidy.name}</div>
          </div>
          <button onClick={onClose} aria-label="閉じる" className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 会話エリア */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <Bubble>
            「{subsidy.name}」に該当するか一緒に確認しましょう。まず自動で判定できる項目です。
          </Bubble>

          {/* 構造条件（自動判定） */}
          <div className="rounded-xl border border-white/10 bg-night-900 p-3 space-y-1.5">
            {structural.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {c.ok ? (
                  <Check className="w-4 h-4 text-ehc-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <MinusCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <span className={c.ok ? "text-slate-300" : "text-red-300"}>{c.label}</span>
              </div>
            ))}
          </div>

          {reqs.length > 0 && (
            <Bubble>次に、以下の要件を確認します（{reqs.length}件）。1問ずつお答えください。</Bubble>
          )}

          {/* 回答済みの要件 */}
          {reqs.map((r, i) => {
            if (answers[i] === null || i > step) return null;
            return (
              <div key={i} className="space-y-1.5">
                <Bubble>
                  <span className="text-[11px] text-ehc-300 font-semibold">要件 {i + 1}/{reqs.length}</span>
                  <br />
                  {r}
                </Bubble>
                {answers[i] && i < step && (
                  <div className="flex justify-end">
                    <span className="text-xs px-3 py-1.5 rounded-xl bg-cobalt-600/30 border border-cobalt-500/40 text-cobalt-100">
                      {answers[i] === "yes" ? "はい（満たせる）" : answers[i] === "no" ? "いいえ（満たせない）" : "わからない"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* 現在の質問（未回答） */}
          {!done && reqs[step] && answers[step] === null && (
            <Bubble>
              <span className="text-[11px] text-ehc-300 font-semibold">要件 {step + 1}/{reqs.length}</span>
              <br />
              {reqs[step]}
              <span className="block mt-1.5 text-[11px] text-slate-400 leading-relaxed border-l-2 border-ehc-500/30 pl-2">
                ヒント：{reqHint(reqs[step])}
              </span>
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
              <p className="text-[10px] text-slate-400 mt-2">
                ※ 最終的な採択可否は各補助金事務局の審査によります。本判定は目安です。
              </p>
            </div>
          )}
        </div>

        {/* 操作エリア */}
        <div className="border-t border-white/10 px-4 py-3 bg-night-900/80">
          {!done ? (
            helpOpen && reqs[step] ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400">
                  近いものを選んでください。迷ったら一番下でOKです（EHCが確認します）。
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {reqChoices(reqs[step]).map((c) => (
                    <button
                      key={c.label}
                      onClick={() => answer(c.answer)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                        c.answer === "yes"
                          ? "border-ehc-500/40 text-ehc-200 hover:bg-ehc-500/15"
                          : c.answer === "no"
                          ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
                          : "border-white/15 text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 mt-1"
                >
                  ← はい／いいえに戻る
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <ActionBtn onClick={() => answer("yes")} tone="ok" icon={<Check className="w-4 h-4" />}>
                  はい
                </ActionBtn>
                <ActionBtn onClick={() => answer("no")} tone="ng" icon={<XCircle className="w-4 h-4" />}>
                  いいえ
                </ActionBtn>
                <ActionBtn onClick={() => setHelpOpen(true)} tone="neutral" icon={<HelpCircle className="w-4 h-4" />}>
                  わからない
                </ActionBtn>
              </div>
            )
          ) : (
            <div className="flex gap-2">
              <button
                onClick={applyResult}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 text-white text-sm font-bold hover:from-ehc-500 hover:to-ehc-400 transition-colors"
              >
                この結果を要件チェックに反映
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/15 text-slate-300 text-sm hover:bg-white/5"
              >
                閉じる
              </button>
            </div>
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
