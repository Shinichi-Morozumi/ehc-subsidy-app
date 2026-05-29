import { MatchInput } from "./types";

export interface SampleCase {
  id: string;
  label: string;
  subtitle: string;
  data: Partial<MatchInput>;
}

export const SAMPLE_CASES: SampleCase[] = [
  {
    id: "office_medium",
    label: "オフィス・中規模",
    subtitle: "パッケージ 10台 / 15年経過 / R410A",
    data: {
      bizType: "business",
      size: "sme",
      pref: "東京都",
      building: "office",
      equip: "ac",
      years: 15,
      refri: "r410a",
      kwh: 120000,
      invest: 1200,
      co2: 8,
    },
  },
  {
    id: "restaurant_small",
    label: "飲食店・小規模",
    subtitle: "パッケージ 4台 / 12年経過 / R410A",
    data: {
      bizType: "business",
      size: "sme",
      pref: "東京都",
      building: "restaurant",
      equip: "ac",
      years: 15,
      refri: "r410a",
      kwh: 45000,
      invest: 400,
      co2: 3,
    },
  },
  {
    id: "retail_old",
    label: "小売店舗・老朽",
    subtitle: "パッケージ 6台 / 20年経過 / R22",
    data: {
      bizType: "business",
      size: "sme",
      pref: "神奈川県",
      building: "retail",
      equip: "ac",
      years: 25,
      refri: "r22",
      kwh: 75000,
      invest: 650,
      co2: 5,
    },
  },
  {
    id: "building_large",
    label: "ビル全体・大型",
    subtitle: "マルチ / 20年経過 / R410A",
    data: {
      bizType: "business",
      size: "middle",
      pref: "大阪府",
      building: "office",
      equip: "multi",
      years: 25,
      refri: "r410a",
      kwh: 600000,
      invest: 5000,
      co2: 40,
    },
  },
  {
    id: "hotel_mid",
    label: "ホテル・中規模",
    subtitle: "マルチ / 15年経過 / R410A",
    data: {
      bizType: "business",
      size: "middle",
      pref: "東京都",
      building: "hotel",
      equip: "multi",
      years: 15,
      refri: "r410a",
      kwh: 320000,
      invest: 2800,
      co2: 22,
    },
  },
];
