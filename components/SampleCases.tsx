"use client";

import { SAMPLE_CASES, SampleCase } from "@/lib/samples";
import { Sparkles, MousePointerClick, Check } from "lucide-react";

export function SampleCases({ onPick, selectedId }: { onPick: (sample: SampleCase) => void; selectedId?: string | null }) {
  return (
    <div className="bg-night-900 border border-white/10 rounded-2xl p-5 shadow-soft no-print">
      <div className="mb-4">
        <div className="text-sm font-bold text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-ehc-400" />
          まずはサンプルから試す
        </div>
        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5 text-ehc-500" />
          クリック → 全項目に自動入力 → 下の「即答」ボタンでシミュレーション開始
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {SAMPLE_CASES.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            aria-pressed={selectedId === s.id}
            className={`text-left p-3 rounded-xl border transition-all group relative ${
              selectedId === s.id
                ? "border-ehc-400 bg-ehc-500/15 ring-1 ring-ehc-400/60 shadow-card"
                : "border-white/10 hover:border-cobalt-400/50 hover:bg-ehc-500/10"
            }`}
          >
            {selectedId === s.id && (
              <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-ehc-500 text-white">
                <Check className="w-3 h-3" />
              </span>
            )}
            <div className={`text-xs font-semibold mb-0.5 ${selectedId === s.id ? "text-ehc-200" : "text-white group-hover:text-ehc-300"}`}>
              {s.label}
            </div>
            <div className={`text-[10px] leading-tight ${selectedId === s.id ? "text-ehc-300/80" : "text-slate-500 group-hover:text-ehc-300"}`}>
              {s.subtitle}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
