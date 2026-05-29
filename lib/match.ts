import { Subsidy, MatchInput } from "./types";
import { SUBSIDIES } from "./subsidies";

export interface MatchResult {
  matched: Subsidy[];
  bestSubsidyManYen: number;
  saveYenPerYear: number;
  yearsToRecover: number | null;
  total15YearsYen: number;
  reasons: string[];
  ehcPlan: string;
}

const ELECTRIC_PRICE_YEN_PER_KWH = 27;
const EFFICIENCY_IMPROVEMENT = 0.30;

export function matchSubsidies(input: MatchInput): MatchResult {
  const matched = SUBSIDIES.filter((s) => {
    if (!s.biz.includes(input.bizType)) return false;
    if (!s.size.includes(input.size)) return false;
    if (s.pref !== "all" && !s.pref.includes(input.pref)) return false;
    if (!s.target.includes(input.equip)) return false;
    if (s.id === "kanagawa" && input.co2 < 3) return false;
    return true;
  });

  let bestSubsidyManYen = 0;
  matched.forEach((s) => {
    const calc = Math.min(input.invest * s.rateNum, s.capManYen);
    if (calc > bestSubsidyManYen) bestSubsidyManYen = calc;
  });

  const saveKwh = input.kwh * EFFICIENCY_IMPROVEMENT;
  const saveYenPerYear = Math.round(saveKwh * ELECTRIC_PRICE_YEN_PER_KWH);
  const saveManYenPerYear = saveYenPerYear / 10000;
  const yearsToRecover =
    saveManYenPerYear > 0
      ? Number(((input.invest - bestSubsidyManYen) / saveManYenPerYear).toFixed(1))
      : null;
  const total15YearsYen = saveYenPerYear * 15;

  const reasons: string[] = [];
  if (input.refri === "r22") reasons.push("R22は既に製造禁止。修理用冷媒の入手困難・価格高騰。1日でも早く更新を。");
  if (input.refri === "r410a") reasons.push("R410Aは2025年で製造規制完了。故障時の修理コストが従来比2-3倍。");
  if (input.years >= 15) reasons.push(`設置${input.years}年経過：法定耐用年数超過。効率20-40%低下＋夏季故障リスク大。`);
  if (input.years >= 10 && input.years < 15) reasons.push(`設置${input.years}年：更新推奨ゾーン。今なら補助金活用＋計画的更新が可能。`);
  reasons.push("2027年フロン排出抑制法改正案：罰則強化検討。今のうちに更新で将来コストゼロ。");
  reasons.push(`補助金 ${(bestSubsidyManYen * 10000).toLocaleString("ja-JP")} 円獲得可能：来年度は予算縮小可能性あり、今年度中の申請推奨。`);
  if (saveYenPerYear > 0) reasons.push(`年間電気代 ${saveYenPerYear.toLocaleString("ja-JP")} 円削減：15年で ${total15YearsYen.toLocaleString("ja-JP")} 円。投資回収後は純利益。`);

  let ehcPlan = "";
  if (input.equip === "ac") {
    ehcPlan = "推奨機種: ダイキン FIVE STAR ZEAS（2026/4新発売）または 三菱スリムZR（SiC搭載・電力35%減）。冷媒R32。 / 適用補助金: SII 設備単位型 or 都道府県補助金。 / EHC施工: 既存配管流用ドロップイン or フル更新を診断後ご提案。R410A→R32なら冷媒入替+配管洗浄で工事日数1/2・コスト30%減も可能。";
  } else if (input.equip === "multi") {
    ehcPlan = "推奨機種: ダイキンVRV、三菱シティマルチ、日立セットフリー等。冷媒R32。 / 適用補助金: SII GX設備単位型 (メーカー強化枠 最大3億円)。 / EHC施工: ビル一棟まるごと更新計画、段階更新プラン両対応。";
  }

  return {
    matched,
    bestSubsidyManYen,
    saveYenPerYear,
    yearsToRecover,
    total15YearsYen,
    reasons: reasons.slice(0, 5),
    ehcPlan,
  };
}
