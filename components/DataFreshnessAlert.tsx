"use client";
import { useEffect, useState } from "react";
import { SUBSIDY_DATA_ASOF } from "@/lib/subsidies";
import { CalendarX2 } from "lucide-react";

// 補助金データの最終確認日（SUBSIDY_DATA_ASOF）から30日を超えたら自動で警告を出す。
// データ更新時に lib/subsidies.ts の SUBSIDY_DATA_ASOF を更新すれば自動で消える。
const STALE_DAYS = 30;

export function DataFreshnessAlert() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const m = SUBSIDY_DATA_ASOF.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!m) return;
    const asof = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    setDays(Math.floor((Date.now() - asof.getTime()) / 86400000));
  }, []);

  if (days === null || days <= STALE_DAYS) return null;

  return (
    <div className="px-4 py-3 rounded-xl text-xs mb-5 flex items-start gap-2.5 no-print border bg-amber-500/10 border-amber-500/40">
      <CalendarX2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-300" />
      <div className="text-slate-300">
        <strong className="text-amber-300">データ鮮度注意：</strong>{" "}
        補助金情報の最終確認日（{SUBSIDY_DATA_ASOF}）から{" "}
        <strong className="text-amber-300">{days}日</strong> 経過しています。
        公募状況・締切が変わっている可能性があるため、提案前に各補助金の公式サイトで最新情報をご確認ください。
      </div>
    </div>
  );
}
