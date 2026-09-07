"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ELECTRIC_PRICE_YEN_PER_KWH, AGE_DEGRADATION_PER_YEAR,
  OLD_EQUIPMENT_REPAIR_MANYEN_PER_YEAR, ROI_CHART_YEARS,
  ELECTRIC_PRICE_ASOF, ELECTRIC_PRICE_SOURCE,
  ELECTRIC_CONTRACT_LABEL, ELECTRIC_PRICE_DEFAULT_CONTRACT,
} from "@/lib/pricing";

interface RoiChartProps {
  invest: number;
  bestSubsidyManYen: number;
  saveYenPerYear: number;
  kwhPerYear: number;
  reductionRate?: number;
  /** 電力単価(円/kWh)。未指定時は lib/pricing.ts の共通定数（マッチング試算と同一）を使う */
  electricPrice?: number;
  /** 老朽機を使い続けた場合の年間修理・メンテ増分(万円/年)。
      保守契約額・修理履歴で実額が判明した案件でのみ渡す。
      未指定なら 0（出典の無い金額で「何もしない」を不利に見せない）。 */
  repairCostManYenPerYear?: number;
}

export function RoiChart({ invest, bestSubsidyManYen, saveYenPerYear, kwhPerYear, reductionRate = 0.3, electricPrice, repairCostManYenPerYear }: RoiChartProps) {
  const ELECTRIC_PRICE = electricPrice && electricPrice > 0 ? electricPrice : ELECTRIC_PRICE_YEN_PER_KWH;
  const priceIsDefault = !(electricPrice && electricPrice > 0);
  // 経年劣化率・修理費は lib/pricing.ts の共通定数を参照
  // （ドロップイン診断ウィザードと別々に0.02を持っていたため、片方だけ直すとタブ間で数字がズレていた）
  const OLD_EQUIPMENT_DEGRADATION_PER_YEAR = AGE_DEGRADATION_PER_YEAR;
  const REPAIR_COST_PER_YEAR =
    repairCostManYenPerYear && repairCostManYenPerYear > 0
      ? repairCostManYenPerYear
      : OLD_EQUIPMENT_REPAIR_MANYEN_PER_YEAR;
  // 業種別の想定削減率を反映（更新後の電力＝旧×(1−削減率)）。未指定時は従来通り30%。
  const newPowerFactor = Math.max(0, Math.min(1, 1 - reductionRate));

  const years = ROI_CHART_YEARS;
  const data = [];

  for (let y = 0; y <= years; y++) {
    const oldCost =
      kwhPerYear * ELECTRIC_PRICE * y * (1 + OLD_EQUIPMENT_DEGRADATION_PER_YEAR * y) / 10000 +
      REPAIR_COST_PER_YEAR * y;

    const newCostWithSubsidy =
      (invest - bestSubsidyManYen) + (kwhPerYear * newPowerFactor * ELECTRIC_PRICE * y) / 10000;

    const newCostNoSubsidy = invest + (kwhPerYear * newPowerFactor * ELECTRIC_PRICE * y) / 10000;

    data.push({
      year: `${y}年`,
      "何もしない（旧機器維持）": Math.round(oldCost),
      "更新（補助金なし）": Math.round(newCostNoSubsidy),
      "更新（補助金あり）": Math.round(newCostWithSubsidy),
    });
  }

  const formatYen = (val: number) => `¥${(val * 10000).toLocaleString("ja-JP")}`;

  return (
    <div className="w-full">
    <div className="w-full h-72 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v) => `${v}万`}
            width={55}
          />
          <Tooltip
            formatter={(v: number) => formatYen(v)}
            contentStyle={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Line
            type="monotone"
            dataKey="何もしない（旧機器維持）"
            stroke="#dc2626"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="更新（補助金なし）"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="更新（補助金あり）"
            stroke="#059669"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
      {/* 2026-08-24 監査: 計算に使った前提と出典を、グラフと同じ画面に必ず出す。
          前提が見えないグラフは、後から「その単価はどこから来たのか」と問われた時に守れない。 */}
      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
        電力単価 {ELECTRIC_PRICE.toLocaleString("ja-JP")}円/kWh
        {priceIsDefault ? `（既定・${ELECTRIC_CONTRACT_LABEL[ELECTRIC_PRICE_DEFAULT_CONTRACT]}の実勢＋再エネ賦課金／${ELECTRIC_PRICE_ASOF}）` : "（入力値）"}
        ／経年劣化 年{Math.round(AGE_DEGRADATION_PER_YEAR * 1000) / 10}%
        ／修理・メンテ増分{" "}
        {REPAIR_COST_PER_YEAR > 0
          ? `${REPAIR_COST_PER_YEAR.toLocaleString("ja-JP")}万円/年（入力値）`
          : "未計上（保守契約額が判明するまで加算しません）"}
        。
        {priceIsDefault && <>出典: {ELECTRIC_PRICE_SOURCE}。実際の電気料金明細の単価で上書きしてください。</>}
      </p>
    </div>
  );
}
