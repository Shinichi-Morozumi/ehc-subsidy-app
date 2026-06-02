import { findMatchedAchievements, ACHIEVEMENT_STATS, AKITA_RICE_WAREHOUSE, EHC_FIELD_TEST_2026 } from "@/lib/achievements";
import { Award, TrendingDown, FlaskConical } from "lucide-react";

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
        <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-ehc-400" />
          御社に近い導入事例
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {matched.map((a) => (
            <div key={a.id} className="bg-night-900 border border-white/10 rounded-lg p-3">
              <div className="text-xs font-semibold text-white mb-1">{a.industry}</div>
              <div className="text-[10px] text-slate-500 mb-2">{a.equipment} {a.units}台</div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">CO2削減</span>
                <span className="font-bold text-ehc-300">{a.co2ReductionTon}t</span>
              </div>
              <div className="flex justify-between text-[11px] mt-0.5">
                <span className="text-slate-400">電力削減</span>
                <span className="font-bold text-amber-300">{a.powerReductionRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <div className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5" />
          実証事例: {AKITA_RICE_WAREHOUSE.facility}（夏季ピーク時 最大{AKITA_RICE_WAREHOUSE.peakSummerReduction}%削減）
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {AKITA_RICE_WAREHOUSE.monthlyComparison.map((m, i) => (
            <div key={i} className="bg-night-900 border border-amber-500/20 rounded-md p-1.5">
              <div className="text-[10px] text-slate-500">{m.month}</div>
              <div className="text-sm font-bold text-amber-300">{m.reduction.toFixed(0)}%</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-slate-400 mt-2">公共施設での実証データ（令和2年→令和3年 月別電気代比較）</div>
      </div>

      <div className="bg-ehc-500/10 border border-ehc-500/30 rounded-xl p-4">
        <div className="text-xs font-semibold text-ehc-300 mb-2 flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" />
          実環境比較レポート：フロン冷媒 vs ハイチルガス（{EHC_FIELD_TEST_2026.period}）
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div className="bg-night-900 border border-ehc-500/20 rounded-md p-2">
            <div className="text-[10px] text-slate-500">電力削減（同温度補正）</div>
            <div className="text-base font-bold text-ehc-300">−{EHC_FIELD_TEST_2026.reductionRate}%</div>
          </div>
          <div className="bg-night-900 border border-ehc-500/20 rounded-md p-2">
            <div className="text-[10px] text-slate-500">年間削減コスト</div>
            <div className="text-base font-bold text-ehc-300">約¥{EHC_FIELD_TEST_2026.annualYen.toLocaleString()}</div>
          </div>
          <div className="bg-night-900 border border-ehc-500/20 rounded-md p-2">
            <div className="text-[10px] text-slate-500">年間CO2削減</div>
            <div className="text-base font-bold text-ehc-300">約{EHC_FIELD_TEST_2026.annualCo2Kg.toLocaleString()}kg</div>
          </div>
          <div className="bg-night-900 border border-ehc-500/20 rounded-md p-2">
            <div className="text-[10px] text-slate-500">予測安定性</div>
            <div className="text-base font-bold text-ehc-300">R²={EHC_FIELD_TEST_2026.r2}</div>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 mt-2">
          同一空調設備で外気温を正規化した回帰分析による比較（年間換算は1日あたり削減量×365日。実稼働日数により変動）
        </div>
      </div>
    </div>
  );
}
