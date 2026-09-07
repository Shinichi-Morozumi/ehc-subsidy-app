"use client";

import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import { createContext, useContext, useId } from "react";

/* 2026-08-24 監査での修正:
     Field の <label> は htmlFor を持たず、入力欄は label の「兄弟」だった。
     つまり見た目の上では項目名が付いているのに、支援技術からは
     「名前のない入力欄」に見えていた（27個中25個が該当）。
     Field が項目名テキストに id を振り、その id を配下の Input / Select が
     aria-labelledby で参照する。aria-labelledby は複数の入力欄が
     同じラベルを指してよいので、1つの Field に入力欄が2つあっても壊れない。
     見た目とマークアップは一切変わらない。 */
const FieldLabelContext = createContext<string | null>(null);

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col">
      {/* 対応する control を持たない <label> は支援技術側で「孤立ラベル」と警告される。
          役割は aria-labelledby が担うので、要素自体は div にする（見た目は同一）。 */}
      <div className="text-xs text-slate-300 mb-1.5 font-semibold flex items-center gap-1.5">
        <span id={labelId}>{label}</span>
        {help && (
          <span
            className="tooltip-trigger relative inline-flex items-center cursor-help"
            tabIndex={0}
            role="note"
            aria-label={`補足: ${help}`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-cobalt-300 transition-colors" aria-hidden="true" />
            <span className="tooltip">{help}</span>
          </span>
        )}
      </div>
      <FieldLabelContext.Provider value={labelId}>{children}</FieldLabelContext.Provider>
    </div>
  );
}

/** Field の項目名を aria-labelledby で参照させる。明示指定があればそちらを優先。 */
function useFieldLabelledBy(explicitLabel?: string, explicitLabelledBy?: string) {
  const ctx = useContext(FieldLabelContext);
  if (explicitLabel || explicitLabelledBy) return explicitLabelledBy;
  return ctx ?? undefined;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const labelledBy = useFieldLabelledBy(props["aria-label"], props["aria-labelledby"]);
  return (
    <select
      aria-labelledby={labelledBy}
      className={cn(
        "min-h-[44px] px-3 py-2.5 border border-white/15 rounded-lg text-sm bg-night-800 text-white shadow-soft transition-all",
        "focus:outline-none focus:ring-2 focus:ring-cobalt-500/40 focus:border-cobalt-500 hover:border-white/30",
        "appearance-none bg-no-repeat bg-[right_0.7rem_center] pr-8",
        className
      )}
      style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%2394a3b8'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E\")", backgroundSize: "16px" }}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const labelledBy = useFieldLabelledBy(props["aria-label"], props["aria-labelledby"]);
  return (
    <input
      aria-labelledby={labelledBy}
      className={cn(
        "min-h-[44px] px-3 py-2.5 border border-white/15 rounded-lg text-sm bg-night-800 text-white placeholder:text-slate-500 shadow-soft transition-all",
        "focus:outline-none focus:ring-2 focus:ring-cobalt-500/40 focus:border-cobalt-500 hover:border-white/30",
        className
      )}
      {...props}
    />
  );
}

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "bg-gradient-to-r from-cobalt-600 to-cobalt-500 hover:from-cobalt-700 hover:to-cobalt-600",
        "text-white font-semibold px-6 py-3.5 rounded-xl w-full transition-all",
        "shadow-card hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0",
        "flex items-center justify-center gap-2",
        className
      )}
      {...props}
    />
  );
}
