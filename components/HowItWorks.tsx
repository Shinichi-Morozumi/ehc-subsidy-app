"use client";

import { ClipboardList, Calculator, FileText } from "lucide-react";

/* 着地直後に「何を入れると、何が返ってくるか」を3秒で伝える常時表示バー。
   ツアーUI（コーチマーク）は文言が腐る・客先で毎回出る/一度も出ないのどちらかで事故るため採用しない。
   主導線はこのバーのCTA1本に集約し、サンプル／直接入力はテキストリンクへ格下げする。 */

const STEPS = [
  {
    icon: ClipboardList,
    n: "1",
    title: "設備の情報を入れる",
    body: "1画面1問のガイドに沿って回答。分からない項目だけAI目安を使えます。",
  },
  {
    icon: Calculator,
    n: "2",
    title: "候補制度と回収年数を照合",
    body: "国・自治体の候補を横断照合。要件確認前は補助金0円で安全側に試算します。",
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
        このツールでできること
      </h2>
      <p className="text-xs text-slate-400 mb-4">
        業務用空調の設備情報から、補助金候補・実質負担・投資回収・申請準備を整理し、診断書にします。
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT))}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 text-white font-bold text-sm shadow-glow hover:from-ehc-500 hover:to-ehc-400 transition-all active:scale-[0.98]"
        >
          <ClipboardList className="w-4 h-4" />
          かんたんガイド診断を始める
        </button>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <button type="button" onClick={() => scrollTo("sample-cases")} className="underline underline-offset-2 hover:text-slate-200">サンプルで試す</button>
          <span className="text-slate-600">/</span>
          <button type="button" onClick={() => scrollTo("project-info-section")} className="underline underline-offset-2 hover:text-slate-200">フォームに直接入力</button>
        </div>
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
