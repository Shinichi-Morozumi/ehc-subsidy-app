import { Subsidy, MatchInput, RefriType, EquipType, EquipGroup } from "./types";
import { getSubsidies } from "./subsidies";
import { ELECTRIC_PRICE_YEN_PER_KWH, CO2_TON_PER_KWH, subsidyAmountManYen } from "./pricing";
import {
  checkEligibility,
  canShowAmount,
  EligibilityResult,
  CO2_REQUIREMENT_THRESHOLDS_TON,
} from "./eligibility";
import { resolveInvestState } from "./roiState";
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
import { compareFromModelInputs } from "./performanceCompare";
import type { PerformanceComparison } from "./performanceCompare";

/* ───────── 削減率の根拠 ─────────
   2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）。

   measured    : メーカー一次資料の型番別性能（APF）から、同じ稼働前提での相対差として算出。
                 出典（カタログ番号・ページ・URL・確認日）が群ごとに付く。
   coefficient : lib/coefficients.ts の係数から算出。係数は現時点すべて provisional。

   1つの群がどちらかであり、両者を足し合わせることはしない。 */
export type ReductionBasis = "measured" | "coefficient";

export const REDUCTION_BASIS_LABEL: Record<ReductionBasis, string> = {
  measured: "メーカー公表値（型番別）による比較",
  coefficient: "係数による概算（型番未照合）",
};

/** 画面・帳票に共通で出す注記。文言を1箇所に集約する。 */
export const MEASURED_REDUCTION_NOTE =
  "既設機の型番をメーカーの標準仕様（公表値）と照合し、同じ室内機形状・同じ組合せ・同じ定格能力の" +
  "高効率機と、同一の測定条件で比べた相対差です。既設機の経年劣化は含めていないため、" +
  "実際の削減はこれより大きくなる可能性があります（小さく出る側で算定しています）。";

export const COEFFICIENT_REDUCTION_NOTE =
  "この設備群は既設機の型番が特定できていないため、メーカー公表値との照合ができていません。" +
  "係数による概算です。銘板の型番が分かれば、公表値に基づく比較へ切り替わります。";

export interface GroupResult {
  id: string;
  refri: RefriType;
  equip: EquipType;
  installYear: number;
  age: number;
  units: number;
  kwh: number;                  // 【表示用・整数に丸め済み】按分後 or 実測の年間kWh
  ageDegradationRate: number;
  refriGenRate: number;
  equipBonusRate: number;
  effectiveReductionRate: number;
  saveKwhPerYear: number;       // 【表示用・整数に丸め済み】
  saveYenPerYear: number;       // 【表示用・整数に丸め済み】
  /* 2026-09-11 EHC-0038 P0-10:
     丸める前の値。合算・実効削減率・CO2換算・適格性判定はすべてこちらを使う。
     上の3つは表示専用で、合算に使うと各グループの丸め誤差が積み上がり、
     グループを分けただけで判定結果が変わる（P0-9「計算途中で丸めない」の違反）。 */
  kwhExact: number;
  saveKwhPerYearExact: number;
  saveYenPerYearExact: number;
  label: string;                // 表示用ラベル（例: R410A・パッケージ・7台）
  /* 2026-08-27 監査での追加。
     このグループの削減率に、出典未確定の係数が1つでも入っているか。
     true のとき画面は「暫定値」と明示する。
     2026-09-16 追記: 実機比較（reductionBasis="measured"）を採った群では
     係数を1つも使っていないので false になる。 */
  ratesAreProvisional: boolean;
  /* ───────── 2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31） ───────── */
  /** この群の effectiveReductionRate を何から出したか。混ぜていないことを示す */
  reductionBasis: ReductionBasis;
  /** 実機比較の試行結果。null＝型番の入力口に何も入っていない（照合を試みていない）。
      status="not_comparable" のときは reason と needed に「何が足りないか」が入る。 */
  measuredComparison: PerformanceComparison | null;
  /** 係数だけで出した場合の値。実機比較を採った群でも対比のために持つ（表示は任意） */
  coefficientReductionRate: number;
  /** 画面・帳票に出す、根拠の断り書き */
  reductionBasisNote: string;
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
  saveYenPerYear: number;       // 【表示用・整数に丸め済み】全体（合算）
  totalKwh: number;             // 【表示用・整数に丸め済み】全体（合算）
  /* 2026-09-11 EHC-0038 P0-10: 丸める前の合算値。派生計算はこちらを使う。 */
  saveYenPerYearExact: number;
  totalKwhExact: number;
  totalSaveKwhExact: number;
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
  /* 年間CO2削減量(t)＝削減kWh×排出係数（自動計算）
     2026-09-11 EHC-0038 P0-10:
       null は「算定できていない」。0 は「算定した結果が0t」。両者は別物として返す。
       値は表示用に丸めてあるが、要件のしきい値（3t等）をまたぐ丸めはしない。
       判定に渡すのは下の co2ReductionTonExact で、丸める前の値。
       表示は co2TonLabel() を通すこと（null を「0 t」と書かないため）。 */
  co2ReductionTon: number | null;
  co2ReductionTonExact: number | null;
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

/* ───────── 2026-09-11 EHC-0038 P0-10: CO2削減量の表示 ─────────

   原則は P0-9 と同じ「計算途中で丸めず、表示のみ丸める」。
   ただし CO2 には、丸めた瞬間に意味が変わる境界がある。
   2.96t を小数第1位で丸めると 3.0t になり、
   画面には「CO2削減 3.0 t/年」と出たまま、
   判定は「3t未満のため対象外」と言う。読む側には矛盾しか見えない。

   そこで、しきい値をまたぐ丸めだけは桁を増やして避ける。
   境界以外は従来どおり小数第1位。桁が増えたこと自体が
   「ここは境界です」という合図になる。 */
function crossesRequirementThreshold(exact: number, shown: number): boolean {
  return CO2_REQUIREMENT_THRESHOLDS_TON.some(
    (t) => (exact < t && shown >= t) || (exact >= t && shown < t)
  );
}

/** 丸める前のCO2削減量(t)を、表示用の数値に落とす。しきい値はまたがない。 */
export function displayCo2Ton(exact: number): number {
  for (let digits = 1; digits <= 6; digits++) {
    const shown = Number(exact.toFixed(digits));
    if (!crossesRequirementThreshold(exact, shown)) return shown;
  }
  return exact;
}

export const CO2_UNKNOWN_LABEL = "未算定";

/** 画面・帳票の表示文言。null を「0 t」と書かないための唯一の入口。 */
export function co2TonLabel(ton: number | null, unit = "t"): string {
  return ton == null ? CO2_UNKNOWN_LABEL : `${ton} ${unit}`;
}

/* 年間電力使用量が「分かっているか」。
   2026-09-11 EHC-0038 P0-10:
     kWh が無いのに削減0tを算定結果として出すと、
     eligibility 側で「0t＝要件未達が確定」と読まれて対象外が確定してしまう。
     不明は不明（null）として渡し、needs_check に落とす。
     逆に kWh が分かっていて削減が0なら、それは確認できた0であって不明ではない。 */
function hasKnownAnnualKwh(input: MatchInput, groups: EquipGroup[]): boolean {
  if (input.kwhMode === "measured") {
    return groups.some((g) => Number.isFinite(g.kwh) && (g.kwh as number) > 0);
  }
  return Number.isFinite(input.kwh) && input.kwh > 0;
}

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
  const coefficientReductionRate = Math.min(
    0.6,
    1 - (1 - techReduction) / (1 + ageDegradationRate)
  );
  const used: Coefficient[] = [industry, ageCoefficient, refriCoefficient, equipCoefficient];

  /* ───────── 2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31） ─────────
     実機性能で比べられる群は、係数ではなく実機の値で削減率を出す。

     それまでの削減率は上の4係数だけで作っていた。4つとも provisional である。
     つまり実機の性能を1台も見ずに「実効削減率 33%」と出していた。

     ここでやること:
       既設の型番（g.models）を lib/equipmentPerformance.ts の一次資料と照合し、
       同じ室内機形状・同じ組合せ・同じ定格能力・同じ電源の高効率機を選んで、
       同じ稼働前提での相対差（1 − APF_既設 / APF_更新）を lib/performanceCompare.ts に出させる。

     混ぜない:
       実機比較が成立した群では、係数（経年劣化・冷媒世代差・制御効率差・業種別余地）を
       一切足さない。足すと「カタログ値の差」と「出典未確定の推定」が1つの％に溶け、
       どちらが根拠かを後から分離できなくなる。
       逆に成立しない群では実機の値を1つも使わず、従来の係数概算に落ちる。
       どちらを使ったかは reductionBasis として群ごとに持ち、画面・帳票に明示する。

     実機比較が成立した群では経年劣化を含めていない。
     カタログ値は新品同士の比較なので、既設機の現在の劣化は含まれない。
     つまり実機比較の削減率は、実際より小さく出る側（保守側）である。
     この断りを reductionBasisNote に持たせ、画面で必ず出す。 */
  const comparison: PerformanceComparison | null =
    g.models == null
      ? null
      : compareFromModelInputs(
          { set: g.models.set, indoor: g.models.indoor, outdoor: g.models.outdoor },
          "high_efficiency"
        );

  /* 実機比較が成立し、かつ更新候補のほうが効率が高いときだけ採用する。
     効率が同じか低い（improves=false）のは「既設がすでにその能力帯で
     一次資料上もっとも効率の高い機種」という意味なので、
     更新による削減は見込まない＝0 とする。
     マイナスの削減率を「削減」として下流へ流すことはしない
     （負の削減kWhは負の電気代・負のCO2になり、制度判定まで壊す）。
     採用しなかった事実と実測値は measuredComparison にそのまま残す。 */
  const useMeasured = comparison != null && comparison.status === "measured";
  const measuredRate =
    comparison != null && comparison.status === "measured" ? comparison.reductionRate : null;
  const effectiveReductionRate = useMeasured
    ? Math.max(0, measuredRate as number)
    : coefficientReductionRate;

  return {
    age,
    ageDegradationRate,
    refriGenRate,
    equipBonusRate,
    effectiveReductionRate,
    /** 係数だけで出した場合の値。実機比較を採った群でも、対比のために残す */
    coefficientReductionRate,
    reductionBasis: (useMeasured ? "measured" : "coefficient") as ReductionBasis,
    measuredComparison: comparison,
    used,
    /* 実機比較を採った群では、この％に provisional な係数は入っていない。
       入っていないものを「暫定値」と呼ぶと、暫定の意味が薄れる。 */
    ratesAreProvisional: useMeasured ? false : used.some(isProvisional),
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
    /* 2026-09-16 EHC-0039（台帳 #31）:
       監査（coefficientAudit）には「実際にその群の数字を作った係数」だけを入れる。
       実機比較を採った群の係数を入れると、係数を使っていない数字にまで
       「暫定値」の断りが付き、暫定の意味が薄れる。
       業種別係数は全体表示（industryReductionRate）として画面に出るので常に入れる。 */
    if (r.reductionBasis === "coefficient") {
      usedCoefficients.push(...r.used);
    } else {
      usedCoefficients.push(industryCoefficient);
    }
    const kwh =
      input.kwhMode === "measured"
        ? Math.max(0, g.kwh || 0)
        : input.kwh * (weights[i] / weightSum);
    /* 2026-09-11 EHC-0038 P0-10:
         ここは Math.round(kwh * rate) だった。丸めた削減kWhが
         そのまま合算 → CO2換算 → 制度判定まで流れていたため、
         2.96t の案件が 3.0t として3t要件を満たす（対象外→適合）反転が出ていた。
         丸めるのは表示のためだけ。判定へ流す値は丸めない。 */
    const saveKwhPerYearExact = kwh * r.effectiveReductionRate;
    /* 2026-09-10 EHC-0038 P0-5:
       ELECTRIC_PRICE_YEN_PER_KWH は契約区分の平均販売単価（基本料金込み）＋再エネ賦課金の【推計】。
       削減kWhに掛けた円は、その案件で実際に回避できる金額そのものではない。
       ここでは単価を持つ側の入力経路が無いため既定値のままとし、
       円を表示する画面には ELECTRIC_PRICE_ESTIMATE_NOTE を必ず添えること。 */
    const saveYenPerYearExact = saveKwhPerYearExact * ELECTRIC_PRICE_YEN_PER_KWH;
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
      saveKwhPerYear: Math.round(saveKwhPerYearExact),
      saveYenPerYear: Math.round(saveYenPerYearExact),
      kwhExact: kwh,
      saveKwhPerYearExact,
      saveYenPerYearExact,
      label: `${REFRI_LABEL[g.refri]}・${g.equip === "multi" ? "マルチ" : "パッケージ"}・${g.units}台（${g.installYear}年/築${r.age}年）`,
      ratesAreProvisional: r.ratesAreProvisional,
      reductionBasis: r.reductionBasis,
      measuredComparison: r.measuredComparison,
      coefficientReductionRate: r.coefficientReductionRate,
      reductionBasisNote:
        r.reductionBasis === "measured" ? MEASURED_REDUCTION_NOTE : COEFFICIENT_REDUCTION_NOTE,
    };
  });
  const coefficientAudit = auditCoefficients(usedCoefficients);

  /* 2026-09-11 EHC-0038 P0-10:
       合算はグループ別の丸め済み値ではなく、丸める前の値で行う。
       以前は丸めた値を合算していたため、同じ設備でもグループの分け方を変えると
       合計・実効削減率・CO2が動き、制度判定まで変わりうる状態だった。
       表示する合計は、合算し終えたあとで1回だけ丸める。 */
  const totalKwhExact = groupResults.reduce((a, g) => a + g.kwhExact, 0);
  const totalSaveKwhExact = groupResults.reduce((a, g) => a + g.saveKwhPerYearExact, 0);
  const saveYenPerYearExact = groupResults.reduce((a, g) => a + g.saveYenPerYearExact, 0);
  const totalKwh = Math.round(totalKwhExact);
  const saveYenPerYear = Math.round(saveYenPerYearExact);
  const effectiveReductionRate = totalKwhExact > 0 ? totalSaveKwhExact / totalKwhExact : 0;

  // 表示用の加重平均（kWhで重み付け）
  const wAvg = (sel: (g: GroupResult) => number) =>
    totalKwhExact > 0
      ? groupResults.reduce((a, g) => a + sel(g) * g.kwhExact, 0) / totalKwhExact
      : 0;
  const ageDegradationRate = wAvg((g) => g.ageDegradationRate);
  const refriGenRate = wAvg((g) => g.refriGenRate);
  const equipBonusRate = wAvg((g) => g.equipBonusRate);

  const hasMulti = groups.some((g) => g.equip === "multi");
  const representativeEquip: EquipType = hasMulti ? "multi" : "ac";
  /* CO2削減量(t/年)を削減kWhから自動計算。
     2026-09-11 EHC-0038 P0-10:
       以前は toFixed(1) で丸めた値を1つだけ作り、それを表示にも判定にも使っていた。
       判定へは丸める前（Exact）を渡し、表示は displayCo2Ton() で落とす。
       kWh が分かっていない案件は 0t ではなく null（未算定）。 */
  const co2ReductionTonExact = hasKnownAnnualKwh(input, groups)
    ? totalSaveKwhExact * CO2_FACTOR_TON_PER_KWH
    : null;
  const co2ReductionTon =
    co2ReductionTonExact == null ? null : displayCo2Ton(co2ReductionTonExact);

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
    /* 2026-09-11 EHC-0038 P0-10:
       渡すのは表示用に丸めた co2ReductionTon ではなく、丸める前の Exact。 */
    eligibility[s.id] = checkEligibility(s, matchInputWithGroups, {
      co2ReductionTon: co2ReductionTonExact,
      now,
    });
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
    /* 2026-09-10 EHC-0038 P0-7:
       補助上限や投資額が未確認だと subsidyAmountManYen は null を返す。
       null を 0 として比較すると「算定できなかった制度」が
       「補助額0円の制度」として最大額の候補に並ぶ。除外する。 */
    const calc = subsidyAmountManYen(input.invest, s.rateNum, s.capManYen);
    if (calc == null) return;
    if (calc > bestSubsidyManYen) {
      bestSubsidyManYen = calc;
      bestSubsidyId = s.id;
    }
  });
  /* 併用可否は公募要領の定めであり、こちらで断定できない。
     断定できないものを合算すると返還リスクを客に負わせるので、最大額1件のみを採る。
     この方針は lib/eligibility.ts の canSumAmounts() に明文化してある。 */

  // 2026-09-11 EHC-0038 P0-10: 回収年数の分母は丸める前の削減額から作る。
  const saveManYenPerYear = saveYenPerYearExact / 10000;
  /* 2026-09-10 EHC-0031 F01:
     設備投資額の入力を空にすると Number("") が 0 になり、ここが
     0 ÷ 年間削減額 ＝「回収 0.0年」を返していた。
     費用が不明なことと費用が0円であることは違うので null を返す
     （表示側は lib/roiState.ts の yearsOrUnknown が「未算定」と出す）。 */
  const investKnown = resolveInvestState(input.invest) === "known";
  const yearsToRecover =
    investKnown && saveManYenPerYear > 0
      ? Number((input.invest / saveManYenPerYear).toFixed(1))
      : null;
  const total15YearsYen = Math.round(saveYenPerYearExact * 15);

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
    saveYenPerYearExact,
    totalKwhExact,
    totalSaveKwhExact,
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
    co2ReductionTonExact,
    coefficientAudit,
    groups: groupResults,
  };
}
