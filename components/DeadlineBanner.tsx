"use client";
import { useEffect, useState } from "react";
import { SUBSIDIES } from "@/lib/subsidies";
import { AlarmClock } from "lucide-react";

// 公募中で締切が最も近い補助金を自動表示するカウントダウンバナー。
// 締切を過ぎたものは自動で消えるため、手動メンテ不要。
export function DeadlineBanner() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return null;

  const upcoming = SUBSIDIES.filter((s) => {
    if (s.closed || !s.applyClose) return false;
    const close = new Date(`${s.applyClose}T23:59:59+09:00`);
    const open = s.applyOpen ? new Date(`${s.applyOpen}T00:00:00+09:00`) : null;
    return close >= now && (!open || open <= now);
  }).sort((a, b) => (a.applyClose! < b.applyClose! ? -1 : 1));

  if (!upcoming.length) return null;
  const s = upcoming[0];
  const close = new Date(`${s.applyClose}T23:59:59+09:00`);
  const days = Math.ceil((close.getTime() - now.getTime()) / 86400000);
  const urgent = days <= 14;

  return (
    <div
      className={`px-4 py-3 rounded-xl text-xs mb-5 flex items-start gap-2.5 no-print border ${
        urgent ? "bg-red-500/10 border-red-500/40" : "bg-ehc-500/10 border-ehc-500/30"
      }`}
    >
      <AlarmClock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${urgent ? "text-red-300" : "text-ehc-300"}`} />
      <div className="text-slate-300">
        <strong className={urgent ? "text-red-300" : "text-ehc-300"}>
          締切間近：
        </strong>{" "}
        <strong className="text-white">{s.name}</strong> — 申請締切{" "}
        <strong className="text-white">
          {s.applyClose!.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, "$1/$2")}
        </strong>
        （あと<strong className={urgent ? "text-red-300 text-sm" : "text-white"}>{days}日</strong>）
        {upcoming.length > 1 && (
          <span className="text-slate-500">｜他 {upcoming.length - 1} 件が公募中</span>
        )}
      </div>
    </div>
  );
}
