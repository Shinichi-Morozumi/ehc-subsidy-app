"use client";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-11-08 / EHC-0153 介護チャットの結果に「結局いくら」を出す（工事費は任意）
   ・レビュー（EHC-0151 v2）の残り：介護チャットは補助率と上限まで、自分の負担が出なかった。
   ・質問を増やさず、結果の中で工事費（税抜・万円）を入れると、補助の目安と施設の負担を出す。
   ・計算は lib/programs.ts の estimateFor（制度カードと同じ式）。定員29人以下は国の交付金（10/10・上限は施設の種類で
     1,660万円か833万円）、30人以上は防災と一体の改修の交付金。
   ・補助が工事費に届くときは「0円」と書かない（消費税と対象外の費用は施設の負担）。景品表示法の言い回しに注意。
   ─────────────────────────────────────────────────────────── */

import { useId, useState } from "react";
import { PROGRAMS, estimateFor, estimateSummary, manRange } from "@/lib/programs";
import { facilityGroup, type KaigoAnswers } from "@/lib/kaigo";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

const PRESETS = [500, 1000, 2000] as const;

export function KaigoCostCalc({ answers }: { answers: KaigoAnswers }) {
  const id = useId();
  const [text, setText] = useState("");
  const big = answers.capacity === "ge30";
  const g = facilityGroup(answers.facility);
  const p = big ? PROGRAMS.kokuKaigo30 : PROGRAMS.kokuKaigo;
  const kaigoGroup = big ? null : g === "A" ? "A" : g === "B" || g === "yougo" ? "B" : null;
  const cost = Number(text.replace(/[^0-9]/g, "")) || null;
  const est = cost ? estimateFor(p, { costMan: cost, kaigoGroup }) : null;
  const sum = est ? estimateSummary(est) : null;
  const pick = (v: number) => { setText(String(v)); track("kaigo_step", { step: "cost" }); };

  return (
    <div className="rounded-2xl border border-ink-line bg-white p-4">
      <label htmlFor={`${id}-cost`} className="block text-[15px] font-bold">工事費の目安から、補助と施設の負担を計算する（任意）</label>
      <p className="mt-1 text-[13px] leading-[1.7] text-ink-soft">税抜・万円。分からなければ、例のボタンでどうぞ。{p.tag}「{p.title}」で計算します。</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESETS.map((v) => (
          <button key={v} type="button" onClick={() => pick(v)} aria-pressed={cost === v} className={cn("min-h-[44px] rounded-full border px-4 text-[15px] font-bold", cost === v ? "border-brand-deep bg-brand-deep text-white" : "border-ink-line bg-white text-ink")}>
            {v.toLocaleString("ja-JP")}万円
          </button>
        ))}
        <span className="inline-flex items-center gap-1">
          <input id={`${id}-cost`} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} placeholder="例：1200" className="min-h-[44px] w-28 rounded-xl border border-ink-line px-3 text-[16px]" />
          <span className="text-[15px]">万円</span>
        </span>
      </div>
      {sum && (
        <p className="mt-3 rounded-xl bg-paper-tint px-3 py-2 text-[16px] leading-[1.7]" aria-live="polite">
          補助の目安 <b className="text-[20px] text-brand-deep">{manRange(sum.subsidyMin, sum.subsidyMax)}</b>
          <span className="block text-[15px]">
            施設の負担 {sum.selfMin !== null && sum.selfMax !== null ? <><b>{manRange(sum.selfMin, sum.selfMax)}</b>＋消費税など</> : <>消費税と、補助の対象にならない費用（上限の内側）</>}
          </span>
          <span className="block text-[12px] text-ink-soft">{sum.varies ? "施設の種類で上限が違うため幅があります。" : ""}採択と金額は、審査と市区町村・都道府県の要綱で決まります。</span>
        </p>
      )}
      {cost && !sum && <p className="mt-2 text-[14px] text-ink-soft">この金額では計算できませんでした。下の制度カードで条件をご確認ください。</p>}
    </div>
  );
}
