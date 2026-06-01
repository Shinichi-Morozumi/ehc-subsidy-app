export interface Achievement {
  id: string;
  industry: string;
  industryKey: string;
  equipment: string;
  units: number;
  co2ReductionTon: number;
  powerReductionRate: number;
  buildingMatch: string[];
  equipMatch: ("ac" | "multi")[];
}

// 出典: 株式会社EHCソリューションズ「炭化水素冷媒 導入事例集」（全24件）
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "hospital",
    industry: "病院",
    industryKey: "medical",
    equipment: "パッケージ + マルチ",
    units: 51,
    co2ReductionTon: 161.2,
    powerReductionRate: 26.1,
    buildingMatch: ["medical"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "elderly_care_home",
    industry: "住宅型老人ホーム",
    industryKey: "medical",
    equipment: "パッケージエアコン",
    units: 5,
    co2ReductionTon: 37.1,
    powerReductionRate: 27.0,
    buildingMatch: ["medical"],
    equipMatch: ["ac"],
  },
  {
    id: "nursery",
    industry: "保育園",
    industryKey: "medical",
    equipment: "パッケージエアコン",
    units: 3,
    co2ReductionTon: 12.7,
    powerReductionRate: 43.3,
    buildingMatch: ["medical", "school"],
    equipMatch: ["ac"],
  },
  {
    id: "factory_assembly",
    industry: "組み立て工場",
    industryKey: "factory",
    equipment: "パッケージエアコン",
    units: 29,
    co2ReductionTon: 335.1,
    powerReductionRate: 43.2,
    buildingMatch: ["other"],
    equipMatch: ["ac"],
  },
  {
    id: "auto_parts_factory",
    industry: "自動車部品工場",
    industryKey: "factory",
    equipment: "パッケージエアコン",
    units: 2,
    co2ReductionTon: 25.4,
    powerReductionRate: 40.6,
    buildingMatch: ["other"],
    equipMatch: ["ac"],
  },
  {
    id: "supermarket",
    industry: "スーパーマーケット",
    industryKey: "retail",
    equipment: "パッケージエアコン",
    units: 6,
    co2ReductionTon: 46.8,
    powerReductionRate: 33.6,
    buildingMatch: ["retail"],
    equipMatch: ["ac"],
  },
  {
    id: "supermarket_tohoku",
    industry: "スーパー（東北）",
    industryKey: "retail",
    equipment: "パッケージエアコン",
    units: 1,
    co2ReductionTon: 5.9,
    powerReductionRate: 69.0,
    buildingMatch: ["retail"],
    equipMatch: ["ac"],
  },
  {
    id: "fitness_gym",
    industry: "フィットネスジム",
    industryKey: "retail",
    equipment: "パッケージエアコン",
    units: 1,
    co2ReductionTon: 5.2,
    powerReductionRate: 27.6,
    buildingMatch: ["retail"],
    equipMatch: ["ac"],
  },
  {
    id: "pizza_shop",
    industry: "ピザ店",
    industryKey: "restaurant",
    equipment: "パッケージ + 冷凍機",
    units: 4,
    co2ReductionTon: 29.8,
    powerReductionRate: 33.4,
    buildingMatch: ["restaurant"],
    equipMatch: ["ac"],
  },
  {
    id: "coffee_chain",
    industry: "珈琲チェーン",
    industryKey: "restaurant",
    equipment: "パッケージエアコン",
    units: 5,
    co2ReductionTon: 30.3,
    powerReductionRate: 26.8,
    buildingMatch: ["restaurant"],
    equipMatch: ["ac"],
  },
  {
    id: "funeral_hall",
    industry: "葬儀場",
    industryKey: "other",
    equipment: "パッケージエアコン",
    units: 1,
    co2ReductionTon: 2.1,
    powerReductionRate: 65.1,
    buildingMatch: ["other"],
    equipMatch: ["ac"],
  },
  {
    id: "rice_warehouse",
    industry: "米倉庫",
    industryKey: "other",
    equipment: "パッケージエアコン",
    units: 2,
    co2ReductionTon: 21.8,
    powerReductionRate: 51.2,
    buildingMatch: ["other"],
    equipMatch: ["ac"],
  },
  {
    id: "logistics_office",
    industry: "物流事務所",
    industryKey: "other",
    equipment: "パッケージエアコン",
    units: 2,
    co2ReductionTon: 7.7,
    powerReductionRate: 40.4,
    buildingMatch: ["office", "other"],
    equipMatch: ["ac"],
  },
  {
    id: "farm_hub",
    industry: "農作物循環拠点施設",
    industryKey: "other",
    equipment: "パッケージエアコン",
    units: 3,
    co2ReductionTon: 19.1,
    powerReductionRate: 18.2,
    buildingMatch: ["other"],
    equipMatch: ["ac"],
  },
  {
    id: "culture_museum",
    industry: "文化資料館",
    industryKey: "other",
    equipment: "パッケージ + マルチ",
    units: 6,
    co2ReductionTon: 120.6,
    powerReductionRate: 33.9,
    buildingMatch: ["other", "school"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "heritage_museum",
    industry: "世界遺産資料館",
    industryKey: "other",
    equipment: "マルチエアコン",
    units: 20,
    co2ReductionTon: 105.4,
    powerReductionRate: 35.5,
    buildingMatch: ["other", "school"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "roadside_kyushu",
    industry: "道の駅（九州）",
    industryKey: "retail",
    equipment: "パッケージエアコン",
    units: 16,
    co2ReductionTon: 81.2,
    powerReductionRate: 37.3,
    buildingMatch: ["retail", "restaurant"],
    equipMatch: ["ac"],
  },
  {
    id: "roadside_tohoku",
    industry: "道の駅（東北）",
    industryKey: "retail",
    equipment: "パッケージエアコン",
    units: 2,
    co2ReductionTon: 5.9,
    powerReductionRate: 44.9,
    buildingMatch: ["retail", "restaurant"],
    equipMatch: ["ac"],
  },
  {
    id: "hotel_kyushu_1",
    industry: "ホテルチェーン（九州）",
    industryKey: "hotel",
    equipment: "パッケージ + マルチ",
    units: 5,
    co2ReductionTon: 35.8,
    powerReductionRate: 34.9,
    buildingMatch: ["hotel"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "hotel_kyushu_2",
    industry: "ホテルチェーン（九州）",
    industryKey: "hotel",
    equipment: "マルチエアコン",
    units: 2,
    co2ReductionTon: 50.8,
    powerReductionRate: 37.3,
    buildingMatch: ["hotel"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "hotel_kyushu_3",
    industry: "ホテルチェーン（九州）",
    industryKey: "hotel",
    equipment: "マルチエアコン",
    units: 2,
    co2ReductionTon: 19.8,
    powerReductionRate: 57.9,
    buildingMatch: ["hotel"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "hotel_tohoku",
    industry: "ホテルチェーン（東北）",
    industryKey: "hotel",
    equipment: "マルチエアコン",
    units: 2,
    co2ReductionTon: 78.4,
    powerReductionRate: 33.8,
    buildingMatch: ["hotel"],
    equipMatch: ["ac", "multi"],
  },
];

export const ACHIEVEMENT_STATS = {
  totalCases: ACHIEVEMENTS.length,
  totalCo2Ton: ACHIEVEMENTS.reduce((sum, a) => sum + a.co2ReductionTon, 0),
  avgPowerReduction:
    ACHIEVEMENTS.reduce((sum, a) => sum + a.powerReductionRate, 0) /
    ACHIEVEMENTS.length,
};

export function findMatchedAchievements(building: string, equip: "ac" | "multi"): Achievement[] {
  const matched = ACHIEVEMENTS.filter(
    (a) => a.buildingMatch.includes(building) && a.equipMatch.includes(equip)
  );
  if (matched.length >= 2) return matched.slice(0, 3);
  const partial = ACHIEVEMENTS.filter((a) => a.equipMatch.includes(equip));
  return partial.slice(0, 3);
}

export const AKITA_RICE_WAREHOUSE = {
  facility: "秋田県村営コメ倉庫",
  monthlyComparison: [
    { month: "5〜6月", before: 78201, after: 42611, reduction: 45.51 },
    { month: "6〜7月", before: 85064, after: 55426, reduction: 34.84 },
    { month: "7〜8月", before: 90379, after: 59174, reduction: 34.53 },
    { month: "8〜9月", before: 95645, after: 38865, reduction: 59.37 },
    { month: "9〜10月", before: 63314, after: 37789, reduction: 40.31 },
  ],
  peakSummerReduction: 59.37,
};

// 同一空調設備でのフロン冷媒 vs ハイチルガス 実環境比較（2026/5/14〜5/28・15日間測定）
// 外気温で正規化した回帰分析（y=6.80x−119.39, R²=0.86, p=0.0025）に基づく
export const EHC_FIELD_TEST_2026 = {
  period: "2026/5/14〜5/28（15日間）",
  reductionRate: 16.2, // 同温度補正後の電力削減率(%)
  r2: 0.86,
  annualKwh: 1940, // 年間削減電力量(kWh)
  annualYen: 95600, // 年間削減コスト(円)
  annualCo2Kg: 1168, // 年間CO2削減量(kg)
  pricePerKwh: 27, // 実測電気単価(円/kWh)
};
