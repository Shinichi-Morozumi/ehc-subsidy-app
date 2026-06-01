export interface IndustryProfile {
  key: string;
  label: string;
  electricBreakdown: { category: string; pct: number; color: string }[];
  reductionPotentialPct: number;
  topReductionStrategies: { name: string; pct: number }[];
}

export const INDUSTRY_PROFILES: Record<string, IndustryProfile> = {
  office: {
    key: "office",
    label: "オフィスビル",
    electricBreakdown: [
      { category: "空調", pct: 48, color: "#10b981" },
      { category: "照明", pct: 24, color: "#f59e0b" },
      { category: "OA機器", pct: 16, color: "#3b82f6" },
      { category: "その他", pct: 12, color: "#94a3b8" },
    ],
    reductionPotentialPct: 30,
    topReductionStrategies: [
      { name: "冷房28℃/暖房20℃徹底", pct: 3.0 },
      { name: "換気ファン制御", pct: 3.0 },
      { name: "室外機遮熱塗料", pct: 2.0 },
      { name: "セントラル空調冷水温度調整", pct: 2.0 },
      { name: "エレベーター稼働半減", pct: 2.0 },
    ],
  },
  retail: {
    key: "retail",
    label: "卸・小売店",
    electricBreakdown: [
      { category: "空調", pct: 48, color: "#10b981" },
      { category: "照明", pct: 26, color: "#f59e0b" },
      { category: "冷凍冷蔵", pct: 9, color: "#3b82f6" },
      { category: "その他", pct: 17, color: "#94a3b8" },
    ],
    reductionPotentialPct: 33,
    topReductionStrategies: [
      { name: "室外機遮熱塗料", pct: 4.0 },
      { name: "冷房28℃/暖房20℃", pct: 3.0 },
      { name: "換気制御", pct: 3.0 },
      { name: "不要照明消灯", pct: 2.0 },
    ],
  },
  restaurant: {
    key: "restaurant",
    label: "食品スーパー/飲食店",
    electricBreakdown: [
      { category: "冷凍冷蔵", pct: 35, color: "#3b82f6" },
      { category: "空調", pct: 25, color: "#10b981" },
      { category: "照明", pct: 24, color: "#f59e0b" },
      { category: "その他", pct: 16, color: "#94a3b8" },
    ],
    reductionPotentialPct: 34,
    topReductionStrategies: [
      { name: "冷蔵庫凝縮器洗浄・台数限定", pct: 4.0 },
      { name: "不要エリア間引き", pct: 3.0 },
      { name: "室外機遮熱", pct: 2.0 },
    ],
  },
  medical: {
    key: "medical",
    label: "病院・福祉",
    electricBreakdown: [
      { category: "空調", pct: 38, color: "#10b981" },
      { category: "照明", pct: 37, color: "#f59e0b" },
      { category: "医療機器", pct: 12, color: "#3b82f6" },
      { category: "その他", pct: 13, color: "#94a3b8" },
    ],
    reductionPotentialPct: 26,
    topReductionStrategies: [
      { name: "室内機フィルタ清掃", pct: 2.0 },
      { name: "室外機遮熱", pct: 2.0 },
      { name: "換気制御", pct: 2.0 },
      { name: "部門別温度設定", pct: 1.0 },
    ],
  },
  hotel: {
    key: "hotel",
    label: "ホテル・旅館",
    electricBreakdown: [
      { category: "照明", pct: 31, color: "#f59e0b" },
      { category: "空調", pct: 26, color: "#10b981" },
      { category: "給湯", pct: 18, color: "#3b82f6" },
      { category: "その他", pct: 25, color: "#94a3b8" },
    ],
    reductionPotentialPct: 39,
    topReductionStrategies: [
      { name: "客室外照明 半分間引き", pct: 13.0 },
      { name: "客室外気給気制御", pct: 2.0 },
      { name: "エレベーター運転台数削減", pct: 2.0 },
    ],
  },
  school: {
    key: "school",
    label: "学校・教育",
    electricBreakdown: [
      { category: "空調", pct: 40, color: "#10b981" },
      { category: "照明", pct: 30, color: "#f59e0b" },
      { category: "OA機器", pct: 15, color: "#3b82f6" },
      { category: "その他", pct: 15, color: "#94a3b8" },
    ],
    reductionPotentialPct: 28,
    topReductionStrategies: [
      { name: "授業外時間の照明・空調OFF", pct: 4.0 },
      { name: "温度設定徹底", pct: 3.0 },
      { name: "室外機遮熱", pct: 2.0 },
    ],
  },
  other: {
    key: "other",
    label: "その他事業所",
    electricBreakdown: [
      { category: "空調", pct: 40, color: "#10b981" },
      { category: "照明", pct: 25, color: "#f59e0b" },
      { category: "その他", pct: 35, color: "#94a3b8" },
    ],
    reductionPotentialPct: 30,
    topReductionStrategies: [
      { name: "温度設定徹底", pct: 3.0 },
      { name: "室外機遮熱・点検", pct: 3.0 },
      { name: "不要照明消灯", pct: 2.0 },
    ],
  },
};

export function getIndustryReductionRate(building: string): number {
  return INDUSTRY_PROFILES[building]?.reductionPotentialPct / 100 || 0.30;
}
