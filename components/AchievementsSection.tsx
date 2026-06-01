import { findMatchedAchievements, ACHIEVEMENT_STATS, AKITA_RICE_WAREHOUSE } from "@/lib/achievements";
import { Award, TrendingDown } from "lucide-react";

export function AchievementsSection({ building, equip }: { building: string; equip: "ac" | "multi" }) {
  const matched = findMatchedAchievements(building, equip);
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-ehc-700 to-ehc-600 text-white rounded-xl p-4 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-[10px] opacity-90">累計実績</div>
          <div className="text-xl font-bold">{ACHIEVEMENT_STATS.totalCases} 件</div>
        </div>
        <div className="text-center border-l border-r border-white/20">
          <div className="text-[10px] opacity-90">累計CO2削減</div>
          <div className="text-xl font-bold">{ACHIEVEMENT_STATS.totalCo2Ton.toFixed(1)} t</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] opacity-90">平均電力削減</div>
          <div className="text-xl font-bold">{ACHIEVEMENT_STATS.avgPowerReduction.toFixed(1)}%</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-ehc-600" />
          御社に近い導入事例
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {matched.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-900 mb-1">{a.industry}</div>
              <div className="text-[10px] text-slate-500 mb-2">{a.equipment} {a.units}台</div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-600">CO2削減</span>
                <span className="font-bold text-ehc-700">{a.co2ReductionTon}t</span>
              </div>
              <div className="flex justify-between text-[11px] mt-0.5">
                <span className="text-slate-600">電力削減</span>
                <span className="font-bold text-amber-700">{a.powerReductionRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5" />
          実証事例: {AKITA_RICE_WAREHOUSE.facility}（夏季ピーク時 最大{AKITA_RICE_WAREHOUSE.peakSummerReduction}%削減）
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {AKITA_RICE_WAREHOUSE.monthlyComparison.map((m, i) => (
            <div key={i} className="bg-white border border-amber-100 rounded-md p-1.5">
              <div className="text-[10px] text-slate-500">{m.month}</div>
              <div className="text-sm font-bold text-amber-700">{m.reduction.toFixed(0)}%</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-slate-600 mt-2">公共施設での実証データ（令和2年→令和3年 月別電気代比較）</div>
      </div>
    </div>
  );
}
