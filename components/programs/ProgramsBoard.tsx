"use client";

/* v1 / 2026-10-29 / EHC-0102 制度カードを締切の近い順に並べる（/tokyo・/kaigo の下）。
   onConsult を渡したページでは「この制度で相談する」で下の相談フォームへ。
   /kaigo では今のチャット（7つの質問）が相談の入口なので、ボタンはチャットへ戻す。 */

import Link from "next/link";
import { useState } from "react";
import { PROGRAMS, nextWindow, type ProgramId } from "@/lib/programs";
import { useTodayJst } from "@/lib/useToday";
import { ProgramCard } from "./ProgramCard";
import { ConsultForm } from "./ConsultForm";
import type { ProgramLeadSource } from "@/lib/programLead";

export function ProgramsBoard({
  ids,
  initialToday,
  source,
  withForm = true,
  showCheckCta = true,
  columns = 2,
  onConsultInstead,
  askCostHref,
}: {
  ids: ProgramId[];
  initialToday: string;
  source: ProgramLeadSource;
  withForm?: boolean;
  /** 6問の診断への案内を出すか（/kaigo は今のチャットが診断なので出さない） */
  showCheckCta?: boolean;
  /** パソコンの幅で何列に並べるか（/kaigo は本文の幅が狭いので1列） */
  columns?: 1 | 2;
  /** フォームを置かないページで「相談する」を押したとき */
  onConsultInstead?: () => void;
  /** 「自分の工事費で計算する」の行き先（既定は /shindan?from=…） */
  askCostHref?: string;
}) {
  const today = useTodayJst(initialToday) ?? initialToday;
  const [picked, setPicked] = useState<ProgramId | null>(null);
  const sorted = [...ids].sort((a, b) => (nextWindow(PROGRAMS[a], today).daysToEnd ?? 1e5) - (nextWindow(PROGRAMS[b], today).daysToEnd ?? 1e5));
  const consult = (id: ProgramId) => {
    if (!withForm) { onConsultInstead?.(); return; }
    setPicked(id);
    document.getElementById("consult")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  return (
    <div className="space-y-6">
      <div className={columns === 2 ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
        {sorted.map((id) => (
          <ProgramCard key={id} program={PROGRAMS[id]} today={today} onConsult={consult} place={source} onAskCost={showCheckCta || askCostHref ? () => { window.location.href = askCostHref ?? `/shindan?from=${source}`; } : undefined} />
        ))}
      </div>
      {showCheckCta && <div className="rounded-3xl bg-brand-deep p-5 text-white sm:p-6">
        <p className="text-[20px] font-bold leading-[1.5]">施設に合う制度と「結局いくら」を調べる</p>
        <p className="mt-1 text-[15px] leading-[1.8] opacity-90">所在地・施設の種類・法人・工事の内容・工事費の目安に答えると、使えそうな制度を締切の近い順に出します。約1分。</p>
        <Link href={source === "tokyo" ? "/shindan?for=tokyo" : `/shindan?from=${source}`} className="mt-3 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-brand-lime px-5 text-[17px] font-bold text-ink">
          使える補助金を調べる
        </Link>
      </div>}
      {withForm && <div className="no-print"><ConsultForm source={source} programId={picked} options={sorted} /></div>}
    </div>
  );
}
