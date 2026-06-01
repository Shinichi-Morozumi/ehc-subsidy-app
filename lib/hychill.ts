export interface HyChillProduct {
  id: string;
  name: string;
  type: string;
  targetRefri: string[];
  description: string;
}

export const HYCHILL_PRODUCTS: HyChillProduct[] = [
  {
    id: "minus10",
    name: "Minus 10",
    type: "イソブタン単一冷媒",
    targetRefri: ["R134A"],
    description: "R134Aドロップイン対応の単一冷媒タイプ",
  },
  {
    id: "minus30",
    name: "Minus 30",
    type: "R134A対応混合冷媒",
    targetRefri: ["R134A"],
    description: "R134A機器の混合冷媒対応版（カーエアコン等）",
  },
  {
    id: "minus40",
    name: "Minus 40",
    type: "プロパン単一冷媒",
    targetRefri: ["R290"],
    description: "プロパン純度の高い単一冷媒",
  },
  {
    id: "minus50",
    name: "Minus 50",
    type: "R22/R404A/R407C/R410A対応混合冷媒",
    targetRefri: ["R22", "R404A", "R407C", "R410A"],
    description: "業務用冷凍冷蔵 + 空調の最も汎用性の高い混合冷媒。EHC主力商材。",
  },
  {
    id: "minus60",
    name: "Minus 60",
    type: "R32/R410A対応混合冷媒",
    targetRefri: ["R32", "R410A"],
    description: "業務用エアコン主流のR32/R410Aに最適化された混合冷媒",
  },
  {
    id: "hc32",
    name: "HC 32",
    type: "R32専用混合冷媒",
    targetRefri: ["R32"],
    description: "R32最新機種に特化した専用混合冷媒",
  },
];

export const GWP_COMPARISON = [
  { gas: "R22", gwp: 1810, color: "#dc2626" },
  { gas: "R32", gwp: 675, color: "#f59e0b" },
  { gas: "R410A", gwp: 2090, color: "#dc2626" },
  { gas: "R404A", gwp: 3920, color: "#991b1b" },
  { gas: "R407C", gwp: 1770, color: "#dc2626" },
  { gas: "Hychill GAS", gwp: 3, color: "#059669" },
];

export const JAPAN_MARKET_SIZE = {
  totalBusinessAcUnits: 1050,
  unit: "万台",
  breakdown: [
    { category: "業務用空調機器", units: 950, refri: "R410A / R32" },
    { category: "ビル用マルチエアコン", units: 100, refri: "R410A / R407C" },
  ],
  source: "経済産業省推計",
};
