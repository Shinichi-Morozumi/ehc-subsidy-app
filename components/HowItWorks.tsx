"use client";

import { ClipboardList, SearchCheck, FileText } from "lucide-react";

/* 着地直後に「何を入れると、何が返ってくるか」を3秒で伝える常時表示バー。
   ツアーUI（コーチマーク）は文言が腐る・客先で毎回出る/一度も出ないのどちらかで事故るため採用しない。
   主導線はこのバーのCTA1本に集約し、サンプル／直接入力はテキストリンクへ格下げする。 */

const STEPS = [
  {
    icon: ClipboardList,
    n: "1",
    title: "更新時期と所在地を入力",
    body: "期限に関わる質問から開始。細かな空調仕様は後で補完できます。",
  },
  {
    icon: SearchCheck,
    n: "2",
    title: "候補制度と期限を確認",
    body: "申請可能性・条件確認・対象外に分け、次に何をするかを表示します。",
  },
  {
    icon: FileText,
    n: "3",
    title: "同意後に診断書PDFを発行",
    body: "匿名結果を先に確認し、希望する場合だけ宛名入りPDF・相談へ進めます。",
  },
];

// 画面内のガイド診断コンポーネントを開くイベント名
export const OPEN_HEARING_EVENT = "ehc:open-hearing";

export function HowItWorks() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="no-print mb-5 rounded-2xl border border-white/10 bg-night-900 p-5 md:p-6 shadow-soft">
      <h2 className="text-sm md:text-base font-bold text-white mb-1">
        空調更新に使える制度と期限を、3分で確認
      </h2>
      <p className="text-xs text-slate-400 mb-4">
        個人情報なしで候補を確認できます。採択・受給を保証する診断ではありません。
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT))}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 text-white font-bold text-sm shadow-glow hover:from-ehc-500 hover:to-ehc-400 transition-all active:scale-[0.98]"
        >
          <ClipboardList className="w-4 h-4" />
          3分で診断を始める
        </button>
        <button type="button" onClick={() => scrollTo("project-info-section")} className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-200">詳しい設備情報を直接入力する</button>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-ehc-500 to-ehc-700 text-white text-[11px] font-black flex-shrink-0">
                  {s.n}
                </span>
                <Icon className="w-4 h-4 text-ehc-300 flex-shrink-0" />
                <span className="text-[13px] font-bold text-white leading-tight">{s.title}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{s.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
