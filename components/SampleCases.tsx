"use client";

import { SAMPLE_CASES, SampleCase } from "@/lib/samples";
import { Sparkles } from "lucide-react";

export function SampleCases({ onPick }: { onPick: (sample: SampleCase) => void }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft no-print">
      <div className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-ehc-600" />
        サンプルケースから始める（クリックで自動入力）
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {SAMPLE_CASES.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="text-left p-3 rounded-xl border border-slate-200 hover:border-ehc-500 hover:bg-ehc-50 transition-all group"
          >
            <div className="text-xs font-semibold text-slate-900 group-hover:text-ehc-800 mb-0.5">
              {s.label}
            </div>
            <div className="text-[10px] text-slate-500 group-hover:text-ehc-700 leading-tight">
              {s.subtitle}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
