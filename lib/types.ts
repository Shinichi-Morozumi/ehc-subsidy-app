export type EquipType = "ac" | "multi";
export type BizType = "business" | "personal";
export type SizeType = "sme" | "middle" | "large";
export type RefriType = "r22" | "r410a" | "r32" | "unknown";

export interface Subsidy {
  id: string;
  name: string;
  org: string;
  period: string;
  rate: string;
  max: string;
  target: EquipType[];
  biz: BizType[];
  size: SizeType[];
  pref: "all" | string[];
  requirement: string;
  docs: string;
  url: string;
  rateNum: number;
  capManYen: number;
}

export interface Vendor {
  maker: string;
  series: string;
  refri: string;
  use: string;
  note: string;
}

export interface Weapon {
  title: string;
  body: string;
}

export interface Diff {
  title: string;
  body: string;
}

export interface MatchInput {
  bizType: BizType;
  size: SizeType;
  pref: string;
  building: string;
  equip: EquipType;
  years: number;
  refri: RefriType;
  kwh: number;
  invest: number;
  co2: number;
  customerCompany: string;
  customerContact: string;
  ehcStaff: string;
}
