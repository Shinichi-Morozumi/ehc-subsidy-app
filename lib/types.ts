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
  adoptionRate?: string; // 採択率の参考値（回次・年度により変動。自治体先着型は「予算枠」等）
  infoOnly?: boolean; // true=資金額/ROI計算に含めず情報提供のみ（例: 持続化補助金）
  closed?: boolean;   // true=今年度の受付終了（マッチング対象外・DBには表示）
  applyOpen?: string;   // 公募開始日(ISO yyyy-mm-dd)。判明している回のみ
  applyClose?: string;  // 申請締切日(ISO)。判明している回のみ
  scheduleNote?: string; // 次回公募の見込み等の注記
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

// 設備グループ（冷媒・種別・設置年・台数がバラバラな機種を1案件内で複数扱う）
export type KwhMode = "auto" | "measured"; // auto=総kWh按分 / measured=エニマス等の実測値をグループ別入力

export interface EquipGroup {
  id: string;
  refri: RefriType;
  equip: EquipType;     // ac=パッケージ / multi=ビル用マルチ
  installYear: number;  // 設置年(西暦)
  units: number;        // 台数
  hp?: number;          // 馬力(任意・自動按分の重み付けに使用)
  kwh?: number;         // 実測モード時のグループ別 年間電力使用量(kWh)
}

export interface MatchInput {
  bizType: BizType;
  size: SizeType;
  pref: string;
  building: string;
  equipGroups: EquipGroup[];
  kwhMode: KwhMode;
  kwh: number;          // 自動按分モード時の年間総電力使用量(kWh)
  invest: number;
  customerCompany: string;
  customerContact: string;
  ehcStaff: string;
}
