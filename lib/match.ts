import { Subsidy, MatchInput, RefriType, EquipType, EquipGroup } from "./types";
import { getSubsidies } from "./subsidies";
import { ELECTRIC_PRICE_YEN_PER_KWH, CO2_TON_PER_KWH, subsidyAmountManYen } from "./pricing";
import { checkEligibility, canShowAmount, EligibilityResult } from "./eligibility";
import {
  Coefficient,
  CoefficientAudit,
  auditCoefficients,
  getAgeDegradationCoefficient,
  getRefrigerantGenCoefficient,
  getEquipBonusCoefficient,
  getIndustryReductionCoefficient,
  isProvisional,
} from "./coefficients";

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
  /* 2026-08-27 監査での追加。
     このグループの削減率に、出典未確定の係数が1つでも入っているか。
     true のとき画面は「暫定値」と明示する。 */
  ratesAreProvisional: boolean;
}

export interface MatchResult {
  matched: Subsidy[];
  /* 2026-08-24 監査で追加。
     「対象外」ではなく「判定に必要な情報が足りない」制度。
     ここを画面に出さないと、聞けば通ったかもしれない制度が黙って消える。 */
  needsCheck: Subsidy[];
  /** 制度ID → 判定結果（理由・不足事項・確認事項）。UIはここから文言を作る。 */
  eligibility: Record<string, EligibilityResult>;
  /** 補助額の根拠として採用した制度のID。null＝根拠となる制度が無い（＝金額を出さない）。 */
  bestSubsidyId: string | null;
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
  /* 2026-08-27 監査での追加。
     削減率の算出に使った係数のうち、一次資料を特定できていないものの一覧。
     補助制度に verificationState を持たせたのと同じ扱いを係数にも適用する。
     UI・帳票はここが空でない限り「暫定値」と明示すること。 */
  coefficientAudit: CoefficientAudit;
  groups: GroupResult[];
}

// 電気単価・CO2係数は lib/pricing.ts の共通定数を参照（各所ハードコードによる不整合を防ぐ）
const CO2_FACTOR_TON_PER_KWH = CO2_TON_PER_KWH;
const CURRENT_YEAR = new Date().getFullYear();
const REFRI_LABEL: Record<RefriType, string> = {
  r22: "R22", r410a: "R410A", r32: "R32", unknown: "冷媒不明",
};

/* 2026-08-27 監査での修正:
     経年劣化率・冷媒世代差・制御効率差の3係数は、ここに直書きされた数値を返す関数だった。
     コメントには「資源エネルギー庁・業界資料」とあったが、どの資料の何ページかは辿れず、
     画面にも「出典: 資源エネルギー庁／メーカー資料／業界資料」としか出ていなかった。
     出典の無い数字が、出典のある数字と同じ顔で客先に出る状態である。
     定義は lib/coefficients.ts に移し、値と一緒に「根拠」「検証状態」を必ず持たせた。
     出典未確定のものは provisional として画面に「暫定値」と出す。
     以下は既存の呼び出し互換のための数値ラッパー。 */
export function getAgeDegradationRate(years: number): number {
  return getAgeDegradationCoefficient(years).value;
}
export function getRefrigerantGenRate(refri: RefriType): number {
  return getRefrigerantGenCoefficient(refri).value;
}
export function getEquipBonusRate(equip: EquipType): number {
  return getEquipBonusCoefficient(equip).value;
}

// 1グループの実効削減率を算出
function computeGroupRates(g: EquipGroup, industry: Coefficient) {
  const age = Math.max(0, CURRENT_YEAR - (g.installYear || CURRENT_YEAR));
  const ageCoefficient = getAgeDegradationCoefficient(age);
  const refriCoefficient = getRefrigerantGenCoefficient(g.refri);
  const equipCoefficient = getEquipBonusCoefficient(g.equip);
  const ageDegradationRate = ageCoefficient.value;
  const refriGenRate = refriCoefficient.value;
  const equipBonusRate = equipCoefficient.value;
  const techReduction =
    1 - (1 - industry.value) * (1 - refriGenRate) * (1 - equipBonusRate);
  const effectiveReductionRate = Math.min(
    0.6,
    1 - (1 - techReduction) / (1 + ageDegradationRate)
  );
  const used: Coefficient[] = [industry, ageCoefficient, refriCoefficient, equipCoefficient];
  return {
    age,
    ageDegradationRate,
    refriGenRate,
    equipBonusRate,
    effectiveReductionRate,
    used,
    ratesAreProvisional: used.some(isProvisional),
  };
}

export function matchSubsidies(input: MatchInput): MatchResult {
  const industryCoefficient = getIndustryReductionCoefficient(input.building);
  const industryReductionRate = industryCoefficient.value;
  const groups = input.equipGroups.length
    ? input.equipGroups
    : [{ id: "g1", refri: "r410a" as RefriType, equip: "ac" as EquipType, installYear: CURRENT_YEAR - 15, units: 1 }];

  // kWh の決定（auto=台数×馬力で按分 / measured=グループ別実測値）
  const weights = groups.map((g) => Math.max(1, g.units) * (g.hp && g.hp > 0 ? g.hp : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  const usedCoefficients: Coefficient[] = [];
  const groupResults: GroupResult[] = groups.map((g, i) => {
    const r = computeGroupRates(g, industryCoefficient);
    usedCoefficients.push(...r.used);
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
      ratesAreProvisional: r.ratesAreProvisional,
    };
  });
  const coefficientAudit = auditCoefficients(usedCoefficients);

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

  /* 2026-08-24 監査での修正:
       以前はここに `filter` が1本あるだけで、落ちた制度の理由が残らなかった。
       true/false しか無いので「要件を満たさないから0円」と
       「こちらが情報を持っていないから0円」が同じ“該当なし”に潰れていた。
       前者は本当に対象外、後者は聞けば対象かもしれない案件で、営業上まるで意味が違う。
       判定は lib/eligibility.ts に集約し、理由付きの3値で受け取る。 */
  const now = new Date();
  const allSubsidies = getSubsidies(now);
  const matchInputWithGroups: MatchInput = { ...input, equipGroups: groups };
  const eligibility: Record<string, EligibilityResult> = {};
  allSubsidies.forEach((s) => {
    eligibility[s.id] = checkEligibility(s, matchInputWithGroups, { co2ReductionTon, now });
  });

  // A判定: 要件を満たし、判定に必要な情報も揃っている制度だけ
  const matched = allSubsidies.filter((s) => eligibility[s.id].verdict === "eligible");
  // B判定: 対象外ではないが、判定に足りない情報がある制度（ヒアリングで拾える見込み）
  const needsCheck = allSubsidies.filter((s) => eligibility[s.id].verdict === "needs_check");

  /* 補助額の丸め（千円未満切捨て）は lib/pricing.ts の subsidyAmountManYen() に集約した。
     以前はこの計算が match.ts と ProgramMatchBoard.tsx に別々に書かれ、
     片方だけ切捨てをしていたため、同じ画面で同じ制度の金額が食い違っていた。 */
  let bestSubsidyManYen = 0;
  let bestSubsidyId: string | null = null;
  matched.forEach((s) => {
    // 情報提供のみ（持続化等）は canShowAmount が false になる
    if (!canShowAmount(eligibility[s.id])) return;
    const calc = subsidyAmountManYen(input.invest, s.rateNum, s.capManYen);
    if (calc > bestSubsidyManYen) {
      bestSubsidyManYen = calc;
      bestSubsidyId = s.id;
    }
  });
  /* 併用可否は公募要領の定めであり、こちらで断定できない。
     断定できないものを合算すると返還リスクを客に負わせるので、最大額1件のみを採る。
     この方針は lib/eligibility.ts の canSumAmounts() に明文化してある。 */

  const saveManYenPerYear = saveYenPerYear / 10000;
  const yearsToRecover =
    saveManYenPerYear > 0
      ? Number((input.invest / saveManYenPerYear).toFixed(1))
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
  if (oldest && oldest.age >= 15) reasons.push(`最も古い設備は築${oldest.age}年（${oldest.installYear}年設置）。法定耐用年数超過・経年劣化 約${Math.round(oldest.ageDegradationRate * 100)}%（暫定値）で、更新時の削減効果が大きい。`);
  reasons.push("冷媒規制や故障リスクを見据え、現地調査で更新・段階更新・既存設備活用を比較することを推奨します。");
  if (bestSubsidyManYen > 0) {
    reasons.push(`候補制度の要件を満たす場合、最大 ${(bestSubsidyManYen * 10000).toLocaleString("ja-JP")} 円の補助額概算です。採択・受給・補助額を保証するものではありません。`);
  }
  if (saveYenPerYear > 0) reasons.push(`年間電気代 ${saveYenPerYear.toLocaleString("ja-JP")} 円削減（全体実効 ${Math.round(effectiveReductionRate * 100)}%）：15年で ${total15YearsYen.toLocaleString("ja-JP")} 円。`);
  /* 2026-08-27 監査での追加。
     削減率が暫定値の係数に依っていることは、訴求文の中でも言い切っておく。
     ここを言わずに「実効33%」だけを出すと、大塚倉庫の「−33%」と同じ立場になる。 */
  if (!coefficientAudit.allSourced && saveYenPerYear > 0) {
    reasons.push(`上記の削減率は、経年劣化・冷媒世代差・業種別省エネ余地の各係数に一次資料を特定できていない暫定値を含みます（${coefficientAudit.provisional.length}項目）。現地調査と実測により再算定します。`);
  }

  let ehcPlan = "";
  if (representativeEquip === "ac") {
    ehcPlan = "推奨機種: ダイキン FIVE STAR ZEAS または 三菱電機 スリムZR 等の高効率R32機（型番・発売時期・性能値は各メーカーの最新カタログでご確認ください）。 / 適用補助金: SII 設備単位型 or 都道府県補助金。 / EHC施工: 既存配管を流用したリプレース or フル更新を現地診断のうえご提案します（配管流用の可否は既設配管の状態・洗浄結果によります。流用できる場合は工期・費用を圧縮できます）。※炭化水素冷媒への「ドロップイン」は既存機を残す別メニューで、省エネ補助金の対象外です。";
  } else {
    ehcPlan = "推奨機種: ダイキンVRV、三菱シティマルチ、日立セットフリー等。冷媒R32。 / 適用補助金: SII GX設備単位型 (メーカー強化枠 最大3億円)。 / EHC施工: ビル一棟まるごと更新計画、段階更新プラン両対応。複数世代の混在は古い群から優先更新を提案。";
  }

  return {
    matched,
    needsCheck,
    eligibility,
    bestSubsidyId,
    bestSubsidyManYen,
    saveYenPerYear,
    totalKwh,
    yearsToRecover,
    total15YearsYen,
    reasons, // 訴求文はすべて返す（以前は slice(0,5) で電気代削減の根拠まで切り捨てられていた）
    ehcPlan,
    industryReductionRate,
    ageDegradationRate,
    refriGenRate,
    equipBonusRate,
    effectiveReductionRate,
    representativeEquip,
    co2ReductionTon,
    coefficientAudit,
    groups: groupResults,
  };
}
