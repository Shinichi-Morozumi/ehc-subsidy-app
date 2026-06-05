import { MatchInput } from "./types";

export interface SampleCase {
  id: string;
  label: string;
  subtitle: string;
  data: Partial<MatchInput>;
}

const CY = new Date().getFullYear();

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "office_medium",
    label: "オフィス・中規模",
    subtitle: "パッケージ 10台 / 築15年 / R410A",
    data: {
      bizType: "business", size: "sme", pref: "東京都", building: "office",
      kwhMode: "auto", kwh: 120000, invest: 1200,
      equipGroups: [
        { id: "s1a", refri: "r410a", equip: "ac", installYear: CY - 15, units: 10, hp: 5 },
      ],
    },
  },
  {
    id: "restaurant_small",
    label: "飲食店・小規模",
    subtitle: "パッケージ 4台 / 築12年 / R410A",
    data: {
      bizType: "business", size: "sme", pref: "東京都", building: "restaurant",
      kwhMode: "auto", kwh: 45000, invest: 400,
      equipGroups: [
        { id: "s2a", refri: "r410a", equip: "ac", installYear: CY - 12, units: 4, hp: 3 },
      ],
    },
  },
  {
    id: "retail_old",
    label: "小売店舗・老朽",
    subtitle: "パッケージ 6台 / 築25年 / R22",
    data: {
      bizType: "business", size: "sme", pref: "神奈川県", building: "retail",
      kwhMode: "auto", kwh: 75000, invest: 650,
      equipGroups: [
        { id: "s3a", refri: "r22", equip: "ac", installYear: CY - 25, units: 6, hp: 4 },
      ],
    },
  },
  {
    id: "building_large",
    label: "ビル全体・大型",
    subtitle: "マルチ / 築20年 / R410A",
    data: {
      bizType: "business", size: "middle", pref: "大阪府", building: "office",
      kwhMode: "auto", kwh: 600000, invest: 5000,
      equipGroups: [
        { id: "s4a", refri: "r410a", equip: "multi", installYear: CY - 20, units: 4, hp: 20 },
      ],
    },
  },
  {
    id: "mixed_fleet",
    label: "複数機種 混在",
    subtitle: "R32×2 / R410A×7 / R22×10 の混在ビル",
    data: {
      bizType: "business", size: "middle", pref: "東京都", building: "office",
      kwhMode: "auto", kwh: 480000, invest: 4200,
      equipGroups: [
        { id: "s5a", refri: "r32", equip: "ac", installYear: 2022, units: 2, hp: 5 },
        { id: "s5b", refri: "r410a", equip: "ac", installYear: 2018, units: 5, hp: 5 },
        { id: "s5c", refri: "r410a", equip: "ac", installYear: 2024, units: 2, hp: 5 },
        { id: "s5d", refri: "r22", equip: "multi", installYear: 2000, units: 10, hp: 8 },
      ],
    },
  },
];
