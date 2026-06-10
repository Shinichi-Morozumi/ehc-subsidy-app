import { Subsidy, MatchInput, RefriType, EquipType, EquipGroup } from "./types";
import { SUBSIDIES } from "./subsidies";
import { getIndustryReductionRate } from "./industries";

export interface GroupResult {
  id: string;
  refri: RefriType;
  equip: EquipType;
  installYear: number;
  age: number;
  units: number;
  kwh: number;                  // 按分後 or 実測の年間kWh
  ageDegradationRate: number;
  refriGenRate: number;
  equipBonusRate: number;
  effectiveReductionRate: number;
  saveKwhPerYear: number;
  saveYenPerYear: number;
  label: string;                // 表示用ラベル（例: R410A・パッケージ・7台）
}

export interface MatchResult {
  matched: Subsidy[];
  bestSubsidyManYen: number;
  saveYenPerYear: number;       // 全体（合算）
  totalKwh: number;
  yearsToRecover: number | null;
  total15YearsYen: number;
  reasons: string[];
  ehcPlan: string;
  industryReductionRate: number;   // 業種ベース（全体共通）
  ageDegradationRate: number;       // 表示用：加重平均
  refriGenRate: number;             // 表示用：加重平均
  equipBonusRate: number;           // 表示用：加重平均
  effectiveReductionRate: number;   // 全体の実効削減率（合算saveKwh / 総kWh）
  representativeEquip: EquipType;   // AchievementsSection等の代表種別
  co2ReductionTon: number;          // 年間CO2削減量(t)＝削減kWh×排出係数（自動計算）
  groups: GroupResult[];
}

const ELECTRIC_PRICE_YEN_PER_KWH = 27;
// CO2排出係数（t-CO2/kWh）＝約0.434 kg-CO2/kWh（環境省・電気事業 全国平均ベース）
const CO2_FACTOR_TON_PER_KWH = 0.000434;
const CURRENT_YEAR = new Date().getFullYear();
const REFRI_LABEL: Record<RefriType, string> = {
  r22: "R22", r410a: "R410A", r32: "R32", unknown: "冷媒不明",
};

// 経年劣化率（エビデンス: 業務用空調は年約2%効率低下、10〜15年で20〜40%低下／
// 資源エネルギー庁・業界資料。コイル汚れ・冷媒漏れ・圧縮機摩耗による）
export function getAgeDegradationRate(years: number): number {
  if (years >= 25) return 0.40;
  if (years >= 20) return 0.33;
  if (years >= 15) return 0.25;
  if (years >= 10) return 0.12;
  if (years >= 5) return 0.08;
  return 0.03;
}

// 冷媒世代による技術効率差（エビデンス: R22機は最新R32機比で消費電力が大幅に大きい。
// R410A→R32でAPF向上。資源エネルギー庁/メーカー資料）。現行R32を基準(0)に旧世代ほど加算
export function getRefrigerantGenRate(refri: RefriType): number {
  switch (refri) {
    case "r22": return 0.12;
    case "r410a": return 0.05;
    case "r32": return 0.0;
    default: return 0.05;
  }
}

// 設備種別の制御効率差（マルチ/VRFは個別・部分負荷制御で運用省エネ）
export function getEquipBonusRate(equip: EquipType): number {
  return equip === "multi" ? 0.03 : 0.0;
}

// 1グループの実効削減率を算出
function computeGroupRates(g: EquipGroup, industryRate: number) {
  const age = Math.max(0, CURRENT_YEAR - (g.installYear || CURRENT_YEAR));
  const ageDegradationRate = getAgeDegradationRate(age);
  const refriGenRate = getRefrigerantGenRate(g.refri);
  const equipBonusRate = getEquipBonusRate(g.equip);
  const techReduction =
    1 - (1 - industryRate) * (1 - refriGenRate) * (1 - equipBonusRate);
  const effectiveReductionRate = Math.min(
    0.6,
    1 - (1 - techReduction) / (1 + ageDegradationRate)
  );
  return { age, ageDegradationRate, refriGenRate, equipBonusRate, effectiveReductionRate };
}

export function matchSubsidies(input: MatchInput): MatchResult {
  const industryReductionRate = getIndustryReductionRate(input.building);
  const groups = input.equipGroups.length
    ? input.equipGroups
    : [{ id: "g1", refri: "r410a" as RefriType, equip: "ac" as EquipType, installYear: CURRENT_YEAR - 15, units: 1 }];

  // kWh の決定（auto=台数×馬力で按分 / measured=グループ別実測値）
  const weights = groups.map((g) => Math.max(1, g.units) * (g.hp && g.hp > 0 ? g.hp : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  const groupResults: GroupResult[] = groups.map((g, i) => {
    const r = computeGroupRates(g, industryReductionRate);
    const kwh =
      input.kwhMode === "measured"
        ? Math.max(0, g.kwh || 0)
        : input.kwh * (weights[i] / weightSum);
    const saveKwhPerYear = Math.round(kwh * r.effectiveReductionRate);
    const saveYenPerYear = Math.round(saveKwhPerYear * ELECTRIC_PRICE_YEN_PER_KWH);
    return {
      id: g.id,
      refri: g.refri,
      equip: g.equip,
      installYear: g.installYear,
      age: r.age,
      units: g.units,
      kwh: Math.round(kwh),
      ageDegradationRate: r.ageDegradationRate,
      refriGenRate: r.refriGenRate,
      equipBonusRate: r.equipBonusRate,
      effectiveReductionRate: r.effectiveReductionRate,
      saveKwhPerYear,
      saveYenPerYear,
      label: `${REFRI_LABEL[g.refri]}・${g.equip === "multi" ? "マルチ" : "パッケージ"}・${g.units}台（${g.installYear}年/築${r.age}年）`,
    };
  });

  const totalKwh = groupResults.reduce((a, g) => a + g.kwh, 0);
  const totalSaveKwh = groupResults.reduce((a, g) => a + g.saveKwhPerYear, 0);
  const saveYenPerYear = groupResults.reduce((a, g) => a + g.saveYenPerYear, 0);
  const effectiveReductionRate = totalKwh > 0 ? totalSaveKwh / totalKwh : 0;

  // 表示用の加重平均（kWhで重み付け）
  const wAvg = (sel: (g: GroupResult) => number) =>
    totalKwh > 0 ? groupResults.reduce((a, g) => a + sel(g) * g.kwh, 0) / totalKwh : 0;
  const ageDegradationRate = wAvg((g) => g.ageDegradationRate);
  const refriGenRate = wAvg((g) => g.refriGenRate);
  const equipBonusRate = wAvg((g) => g.equipBonusRate);

  const hasMulti = groups.some((g) => g.equip === "multi");
  const representativeEquip: EquipType = hasMulti ? "multi" : "ac";
  // CO2削減量(t/年)を削減kWhから自動計算
  const co2ReductionTon = Number((totalSaveKwh * CO2_FACTOR_TON_PER_KWH).toFixed(1));

  // 補助金マッチング（いずれかのグループの種別が対象なら適用）
  const matched = SUBSIDIES.filter((s) => {
    if (!s.biz.includes(input.bizType)) return false;
    if (!s.size.includes(input.size)) return false;
    if (s.pref !== "all" && !s.pref.includes(input.pref)) return false;
    if (!groups.some((g) => s.target.includes(g.equip))) return false;
    if (s.id === "kanagawa" && co2ReductionTon < 3) return false;
    if (s.id === "hotel_sustainability" && input.building !== "hotel") return false;
    return true;
  });

  let bestSubsidyManYen = 0;
  matched.forEach((s) => {
    if (s.infoOnly) return; // 情報提供のみ（持続化等）は資金額/ROIに含めない
    const calc = Math.min(input.invest * s.rateNum, s.capManYen);
    if (calc > bestSubsidyManYen) bestSubsidyManYen = calc;
  });

  const saveManYenPerYear = saveYenPerYear / 10000;
  const yearsToRecover =
    saveManYenPerYear > 0
      ? Number(((input.invest - bestSubsidyManYen) / saveManYenPerYear).toFixed(1))
      : null;
  const total15YearsYen = saveYenPerYear * 15;

  // 理由（グループ横断で判定）
  const anyR22 = groups.some((g) => g.refri === "r22");
  const anyR410a = groups.some((g) => g.refri === "r410a");
  const oldest = groupResults.reduce((m, g) => (g.age > m.age ? g : m), groupResults[0]);
  const reasons: string[] = [];
  if (anyR22) reasons.push("R22機を含みます。2020年全廃の最旧世代で最新R32機比の消費電力が大きく、更新による削減余地が特に大（修理用冷媒も入手困難）。");
  if (anyR410a) reasons.push("R410A機を含みます。2025年で製造規制完了の1世代前。R32最新機への更新でAPF世代差分も削減（故障時の修理コスト2-3倍）。");
  if (hasMulti) reasons.push("マルチ(ビル用)は室内機の個別・部分負荷制御で未使用ゾーンを停止でき、運用面でも追加の省エネが可能。");
  if (oldest && oldest.age >= 15) reasons.push(`最も古い設備は築${oldest.age}年（${oldest.installYear}年設置）。法定耐用年数超過・経年劣化 約${Math.round(oldest.ageDegradationRate * 100)}%で、更新時の削減効果が大きい。`);
  reasons.push("2027年フロン排出抑制法改正案：罰則強化検討。今のうちに更新で将来コストゼロ。");
  reasons.push(`補助金 ${(bestSubsidyManYen * 10000).toLocaleString("ja-JP")} 円獲得可能：来年度は予算縮小可能性あり、今年度中の申請推奨。`);
  if (saveYenPerYear > 0) reasons.push(`年間電気代 ${saveYenPerYear.toLocaleString("ja-JP")} 円削減（全体実効 ${Math.round(effectiveReductionRate * 100)}%）：15年で ${total15YearsYen.toLocaleString("ja-JP")} 円。`);

  let ehcPlan = "";
  if (representativeEquip === "ac") {
    ehcPlan = "推奨機種: ダイキン FIVE STAR ZEAS（2026/4新発売）または 三菱スリムZR（SiC搭載・電力35%減）。冷媒R32。 / 適用補助金: SII 設備単位型 or 都道府県補助金。 / EHC施工: 既存配管流用ドロップイン or フル更新を診断後ご提案。R410A→R32なら冷媒入替+配管洗浄で工事日数1/2・コスト30%減も可能。";
  } else {
    ehcPlan = "推奨機種: ダイキンVRV、三菱シティマルチ、日立セットフリー等。冷媒R32。 / 適用補助金: SII GX設備単位型 (メーカー強化枠 最大3億円)。 / EHC施工: ビル一棟まるごと更新計画、段階更新プラン両対応。複数世代の混在は古い群から優先更新を提案。";
  }

  return {
    matched,
    bestSubsidyManYen,
    saveYenPerYear,
    totalKwh,
    yearsToRecover,
    total15YearsYen,
    reasons: reasons.slice(0, 5),
    ehcPlan,
    industryReductionRate,
    ageDegradationRate,
    refriGenRate,
    equipBonusRate,
    effectiveReductionRate,
    representativeEquip,
    co2ReductionTon,
    groups: groupResults,
  };
}
