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

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "hospital_5f",
    industry: "5階建て病院",
    industryKey: "medical",
    equipment: "パッケージエアコン + マルチエアコン",
    units: 70,
    co2ReductionTon: 195.4,
    powerReductionRate: 26.0,
    buildingMatch: ["medical"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "factory_assembly",
    industry: "組み立て工場",
    industryKey: "factory",
    equipment: "パッケージエアコン",
    units: 28,
    co2ReductionTon: 335.1,
    powerReductionRate: 40.7,
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
    powerReductionRate: 33.7,
    buildingMatch: ["retail"],
    equipMatch: ["ac"],
  },
  {
    id: "elderly_care",
    industry: "有料老人ホーム",
    industryKey: "medical",
    equipment: "パッケージエアコン",
    units: 5,
    co2ReductionTon: 37.1,
    powerReductionRate: 27.0,
    buildingMatch: ["medical"],
    equipMatch: ["ac"],
  },
  {
    id: "business_hotel",
    industry: "ビジネスホテル",
    industryKey: "hotel",
    equipment: "マルチエアコン18馬力",
    units: 1,
    co2ReductionTon: 48.5,
    powerReductionRate: 39.2,
    buildingMatch: ["hotel"],
    equipMatch: ["multi"],
  },
  {
    id: "roadside_station",
    industry: "道の駅",
    industryKey: "retail",
    equipment: "パッケージエアコン",
    units: 16,
    co2ReductionTon: 49.6,
    powerReductionRate: 37.0,
    buildingMatch: ["retail", "restaurant"],
    equipMatch: ["ac"],
  },
  {
    id: "pizza_roadside",
    industry: "ピザ店（ロードサイド）",
    industryKey: "restaurant",
    equipment: "パッケージエアコン + 冷凍機",
    units: 4,
    co2ReductionTon: 29.8,
    powerReductionRate: 34.1,
    buildingMatch: ["restaurant"],
    equipMatch: ["ac"],
  },
  {
    id: "precision_factory",
    industry: "精密加工工場",
    industryKey: "factory",
    equipment: "パッケージエアコン",
    units: 8,
    co2ReductionTon: 38.3,
    powerReductionRate: 39.2,
    buildingMatch: ["other"],
    equipMatch: ["ac"],
  },
  {
    id: "museum",
    industry: "資料館",
    industryKey: "other",
    equipment: "パッケージエアコン + マルチエアコン",
    units: 37,
    co2ReductionTon: 323.3,
    powerReductionRate: 39.6,
    buildingMatch: ["other", "school"],
    equipMatch: ["ac", "multi"],
  },
  {
    id: "fitness_gym",
    industry: "フィットネスジム",
    industryKey: "retail",
    equipment: "パッケージエアコン",
    units: 1,
    co2ReductionTon: 5.9,
    powerReductionRate: 27.4,
    buildingMatch: ["retail"],
    equipMatch: ["ac"],
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
