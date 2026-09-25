"use client";

import { cn } from "@/lib/utils";
import { yenJP } from "@/lib/pricing";
import type { InvestChoice, InvestSource } from "@/lib/amountBasis";

/* ───────────────────────────────────────────────────────────
   補助額の計算に使う金額を選ぶ（2026-09-25 UXレビュー No.2）

   7問目で答えた金額と、この診断の概算が1万円以上違うときだけ出す。
   選んだ金額は DiagnosisFlow が持ち、C段（結果と根拠）・D段（概算費用と工事）の
   両方が同じ値を読む。どちらの段で選んでも、もう一方にも反映される。
   金額の式はここに書かない（概算は lib/pricing.ts、決め方は lib/amountBasis.ts）。
   ─────────────────────────────────────────────────────────── */

export function InvestBasisChooser({
  choice,
  onChange,
  idPrefix,
}: {
  choice: InvestChoice;
  onChange: (source: InvestSource) => void;
  /** 同じ画面に2つ出ても radio の組が混ざらないようにする */
  idPrefix: string;
}) {
  if (!choice.differs || choice.estimateSubtotalYen == null || choice.answerManYen == null) return null;
  const name = `${idPrefix}-invest-source`;
  const options: { value: InvestSource; title: string; amount: string; note: string }[] = [
    {
      value: "estimate",
      title: "この診断の概算で計算する",
      amount: `${yenJP(choice.estimateSubtotalYen)}（税抜）`,
      note: "入力した設備から出した金額です。迷ったらこちら。",
    },
    {
      value: "answer",
      title: "お答えいただいた金額で計算する",
      amount: `${choice.answerManYen.toLocaleString("ja-JP")}万円（税抜）`,
      note: "正式な見積をお持ちの場合はこちら。",
    },
  ];
  return (
    <fieldset className="ehc-invest-chooser rounded-2xl border border-ink-line bg-paper-card p-4 sm:p-5">
      <legend className="px-1 text-[16px] font-bold leading-[1.7] text-ink">補助額の計算に使う工事費</legend>
      <p className="text-[14px] leading-[1.8] text-ink-soft">
        7問目でお答えいただいた金額と、この診断の概算が違います。どちらで計算するかを選んでください。
        選んだ金額で、補助額・実質負担・回収の目安をすべての段で計算し直します。
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = choice.source === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4",
                checked ? "border-brand bg-[#edf6e8]" : "border-[#57685e] bg-paper-card hover:border-brand",
                "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-deep"
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="mt-1.5 h-5 w-5 shrink-0 accent-[#254d39]"
              />
              <span className="min-w-0">
                <span className="block text-[16px] font-bold leading-[1.6] text-ink">{o.title}</span>
                <span className="mt-1 block text-[18px] font-bold tabular-nums leading-[1.4] text-brand-deep">{o.amount}</span>
                <span className="mt-1 block text-[14px] leading-[1.7] text-ink-soft">{o.note}</span>
                {checked && <span className="mt-1 block text-[14px] font-bold leading-[1.7] text-brand">選択中</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
