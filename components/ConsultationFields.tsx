"use client";
// v1 / 2026-10-23 / EHC-0089
import { CONSULTATION_GUIDE } from "@/lib/consultation";

export default function ConsultationFields({ id, dates, onChange, error }: {
  id: string; dates: string[]; onChange: (dates: string[]) => void; error?: string | null;
}) {
  return <fieldset className="min-w-0 rounded-2xl border border-ink-line bg-paper-sub p-4">
    <legend className="px-1 text-[17px] font-bold text-ink">Zoom相談の候補日時 <span className="text-[14px] text-red-800">必須・3件</span></legend>
    <p id={`${id}-guide`} className="text-[14px] leading-[1.8] text-ink-soft">{CONSULTATION_GUIDE}</p>
    <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-3">
      {[0, 1, 2].map(i => <div key={i} className="min-w-0">
        <label htmlFor={`${id}-${i}`} className="block text-[14px] font-bold text-ink">第{i + 1}希望（日本時間）</label>
        <input id={`${id}-${i}`} type="datetime-local" required value={dates[i] || ""}
          aria-describedby={`${id}-guide${error ? ` ${id}-error` : ""}`} aria-invalid={!!error || undefined}
          onChange={e => onChange(dates.map((d, n) => n === i ? e.target.value : d))}
          className="mt-1 min-h-[48px] w-full min-w-0 max-w-full rounded-xl border border-ink-line bg-white px-2 text-[16px] text-ink focus:outline-brand-deep" />
      </div>)}
    </div>
    {error && <p id={`${id}-error`} role="alert" className="mt-3 text-[14px] font-bold text-red-800">{error}</p>}
  </fieldset>;
}
