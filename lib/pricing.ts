// 実勢単価モジュール
// 出典: 株式会社プロジェクトネオ(PN) 見積実績（第9期/第10期, 2024-2025年・担当 碓井）。
// あくまで「目安」。実見積は機種グレード・高所/搬入条件・配管長・電気容量で変動する。
export const PRICING_SOURCE = "PN見積 全500件分析（第9-10期 / 2024-2025年・参考値）";

/* ───────── エネルギー換算の共通定数 ─────────
   ここが唯一の情報源。補助金マッチング／ROIチャート／ドロップイン各試算は必ずこれを参照する
   （以前は27円・0.000438が各コンポーネントに独立ハードコードされ、片方だけ直すと数字がズレていた）。 */
export const ELECTRIC_PRICE_YEN_PER_KWH = 27;      // 円/kWh（既定・契約単価で上書き可）
export const CO2_TON_PER_KWH = 0.000438;           // t-CO2/kWh（省エネ効果レポートと同一係数）
export const CONSUMPTION_TAX_RATE = 0.1;           // 消費税率（投資額の税込換算に使用）
// 税込換算（投資回収年数は税込ベースに統一する）
export const taxIncluded = (yen: number) => Math.round(yen * (1 + CONSUMPTION_TAX_RATE));

/* ───────── 経年劣化・維持費の共通定数 ─────────
   エビデンス: 業務用空調は年約2%ずつ効率が低下する（資源エネルギー庁・業界資料）。
   AGE_DEGRADATION_PER_YEAR は「更新しなかった場合、今後1年ごとに電気代が何%増えるか」という
   “将来”の見込みで、ROIチャート／ドロップイン診断ウィザードの「何もしない」ラインに使う。
   一方 lib/match.ts の getAgeDegradationRate() は「設置からの経過年数で “すでに” どれだけ悪化しているか」
   という累積値（実測レンジ 10〜15年で20〜40% に合わせた非線形の階段）で、用途が異なる。
   両者は同じ「年約2%」というエビデンスを出発点にしている。 */
export const AGE_DEGRADATION_PER_YEAR = 0.02;
/* 老朽機を使い続けた場合の年間修理・メンテ増分（万円/年）。
   ※PN見積の実績平均ではなく保守的な仮置き値。実案件では現地調査後の保守契約額で置き換える。 */
export const OLD_EQUIPMENT_REPAIR_MANYEN_PER_YEAR = 15;
/* ROI比較チャートの表示年数。法定耐用年数15年に合わせている（regulations.ts の legalUsefulLifeYears と同値）。 */
export const ROI_CHART_YEARS = 15;
/* 撤去1台あたりの想定回収冷媒量(kg)。更新工事の破壊費計算の既定値。
   ※見積シミュレーター側でも同じ値を使うため定数化（以前は units×3 が2箇所に直書きされていた）。 */
export const DEFAULT_KG_PER_UNIT = 3;

/* ドロップインの想定削減率レンジ（消費電力ベース・桝口さん確認 25〜30%）。
   表示文言と clamp 上限をここで一元管理する。 */
export const DROPIN_REDUCTION = { min: 0.1, typicalLow: 0.25, typicalHigh: 0.3, max: 0.35 };
export const DROPIN_REDUCTION_LABEL = `${Math.round(DROPIN_REDUCTION.typicalLow * 100)}〜${Math.round(DROPIN_REDUCTION.typicalHigh * 100)}%`;
export const clampDropinRate = (v: number) =>
  Math.min(DROPIN_REDUCTION.max, Math.max(DROPIN_REDUCTION.min, v));

/* ── ドロップインの前提テーブル（簡易シミュレーターとROI診断ウィザードの共通定義） ──
   以前は両コンポーネントが同じ表を別々に持っており、片方だけ更新されてラベル・選択肢がズレていた。
   ここを直せば両方に反映される。 */
// 対象冷媒ごとの想定削減率ベース ※ドロップイン対象は業務用空調のみ（冷凍冷蔵機器は対象外）
export const DROPIN_REFRI_RATE: Record<string, { rate: number; label: string }> = {
  r410a: { rate: 0.25, label: "R410A 業務用空調（最多）" },
  r22: { rate: 0.3, label: "R22 旧型空調" },
  r407c: { rate: 0.22, label: "R407C ビル用マルチ" },
  unknown: { rate: 0.25, label: "わからない（標準で試算）" },
};
// 業種(稼働プロファイル)別の削減係数。稼働時間が長いほど削減効果が大きい想定。
export const DROPIN_INDUSTRY_FACTOR: Record<string, { factor: number; label: string }> = {
  food: { factor: 1.15, label: "飲食店（厨房・長時間）" },
  retail: { factor: 1.1, label: "スーパー/小売" },
  factory: { factor: 1.0, label: "工場/倉庫" },
  clinic: { factor: 0.95, label: "クリニック/福祉/ホテル" },
  office: { factor: 0.9, label: "オフィス/店舗" },
};

// フロンガス破壊費（円/kg）※碓井さん・桝口さん確認: 高騰により¥3,000/kg。ドロップイン/更新工事で共通。
export const GAS_DESTROY_PER_KG = 3000;

/* ── HCガス材料単価（円/kg・税抜）の並記 ──
   sale: 大塚倉庫 実見積（HyChill 8.14kg＝¥472,120 → ¥58,000/kg・お客様向け販売単価）
   purchase: 仕入単価 ¥23,000/kg（桝口さん確認・2026-07）。MODE を "purchase" にすると原価ベースで試算。 */
export const HC_GAS_PRICE: Record<"sale" | "purchase", number> = {
  sale: 58000,
  purchase: 23000, // 桝口さん確認（2026-07）
};
export const HC_GAS_PRICE_MODE: "sale" | "purchase" = "sale";

/* ───────── ドロップイン（冷媒置換・既存機流用） ─────────
   基準: J&M奏 PN0000000282 ＋ PN自然冷媒ガス工事見積単価設定表（Sheet1・桝口さん校正 2026-07）。
   ドロップイン対象は業務用パッケージ 4馬力以上（ルームエアコン・小型パッケージ・冷凍冷蔵は対象外）。 */
export const DROPIN = {
  // フロンガス破壊費（円/kg）※共通定数を参照（更新工事側 WORK.gasDestroyPerKg と同値）
  gasDestroyPerKg: GAS_DESTROY_PER_KG,
  // 消耗・ボンベ・証明書・窒素等（系統あたり）。桝口さん 2026-07 実績値 ¥4,285/系統
  consumablePerSystem: 4285,
  /* 諸経費率: 工事小計（作業＋破壊＋消耗）に対する比率。
     桝口さん回答(2026-07): 従来一括27%としていた枠は「旅費交通費・安全対策費・法定福利費・保険費用・諸経費」の合算であり、
     このうち“純粋な諸経費”は全体の10%が妥当。→ 合計27%は据え置いたまま 10%(諸経費) + 17%(現場経費) に分解して明示する。 */
  overheadRate: 0.10,
  // 現場経費率: 旅費交通費・安全対策費・法定福利費・保険費用（27% − 諸経費10%）
  siteExpenseRate: 0.17,
  // ビル用マルチは初期充填量が大きいため係数を掛ける（桝口さん: マルチは初期充填×1.5倍）
  multiChargeFactor: 1.5,
  // パッケージは配管長がこの距離以内なら追加充填不要（桝口さん: 30m以内）
  packageNoExtraChargePipeM: 30,
  // 系統あたり想定回収冷媒量(kg)の既定値（4馬力パッケージ基準）
  defaultKgPerSystem: 3.5,
  // 系統あたり作業費の既定値（プリセット未指定時のフォールバック）
  defaultWorkPerSystem: 60000,
  // ── HC冷媒（HyChill）ガス代金 ──
  // HC冷媒は比重が軽く、フロン充填量の約5割の重量で足りる（桝口さん確認）
  hcChargeRatio: 0.5,
  // HCガス材料単価（円/kg・税抜）。HC_GAS_PRICE / HC_GAS_PRICE_MODE で販売/仕入を切替。
  hcGasPerKg: HC_GAS_PRICE[HC_GAS_PRICE_MODE],
  // 1馬力の目安冷却能力(kW)。桝口さん確認: 1馬力≒2.8kW
  kwPerHp: 2.8,
};

/* 機器タイプ別プリセット（業務用パッケージ 4馬力以上のみ）。
   kg=系統あたり回収冷媒量、work=系統あたり作業費（PN Sheet1 客先提出費: 真空引き/新規チャージ＋フロン回収＋窒素ブロー）。 */
export type EquipType = "package" | "multi"; // multi=ビル用マルチ（初期充填×1.5倍）
export const KG_PRESETS: Record<string, { label: string; kg: number; work: number; equip: EquipType }> = {
  hp4_6: { label: "4〜6馬力 パッケージ", kg: 3.5, work: 60000, equip: "package" },
  hp8_10: { label: "8〜10馬力 パッケージ", kg: 5, work: 76000, equip: "package" },
  hp12: { label: "12馬力〜 パッケージ", kg: 7, work: 106000, equip: "package" },
  multi: { label: "ビル用マルチ（初期充填×1.5）", kg: 7, work: 106000, equip: "multi" },
};
export const DEFAULT_KG_PRESET = "hp4_6";

/* ドロップイン概算（税抜・円）= HCガス代金 + 工事費用。
   systems=系統数, kgPerSystem=系統あたり回収冷媒量, workPerSystem=系統あたり作業費
   opts.equipType: "multi" のとき初期充填を×1.5（桝口さん）
   opts.extraKgPerSystem: 点検表に記載の追加充填量(kg/系統)。実冷媒量が銘板より多い場合に加算する。 */
export function estimateDropinCost(
  systems: number,
  kgPerSystem = DROPIN.defaultKgPerSystem,
  workPerSystem = DROPIN.defaultWorkPerSystem,
  opts?: { equipType?: EquipType; extraKgPerSystem?: number }
) {
  const s = Math.max(0, Math.round(systems));
  const extraKgPerSystem = Math.max(0, opts?.extraKgPerSystem ?? 0);
  const kgPerSys = Math.max(0, kgPerSystem) + extraKgPerSystem;
  const kg = Math.round(s * kgPerSys * 10) / 10; // 回収・破壊対象フロン量
  const extraKg = Math.round(s * extraKgPerSystem * 10) / 10;
  const work = s * workPerSystem;
  const gas = Math.round(kg * DROPIN.gasDestroyPerKg);
  const consumable = s * DROPIN.consumablePerSystem;
  const preOverhead = work + gas + consumable; // 工事小計（作業＋破壊＋消耗）
  // 諸経費(10%) と 現場経費(17%=旅費交通費・安全対策費・法定福利費・保険) に分解。合計は従来どおり27%。
  const overhead = s > 0 ? Math.round(preOverhead * DROPIN.overheadRate) : 0;
  const siteExpense = s > 0 ? Math.round(preOverhead * DROPIN.siteExpenseRate) : 0;
  // 新冷媒（HCガス）代金: 回収フロン量×充填比×機器タイプ係数×単価
  const equipType: EquipType = opts?.equipType ?? "package";
  const chargeFactor = equipType === "multi" ? DROPIN.multiChargeFactor : 1;
  const hcKg = Math.round(kg * DROPIN.hcChargeRatio * chargeFactor * 10) / 10;
  const hcGas = Math.round(hcKg * DROPIN.hcGasPerKg);
  const workTotal = preOverhead + overhead + siteExpense; // 工事費用 計
  const total = hcGas + workTotal;                        // ガス代金 + 工事費用
  return { systems: s, kg, extraKg, work, gas, consumable, overhead, siteExpense, hcKg, hcGas, workTotal, total, equipType, chargeFactor };
}

/* ───────── 更新工事（機器入替） ─────────
   機器費(本体セット=室内+室外)の馬力別目安。
   実績: 2.5HP ¥278,400/標準・¥389,760/補助金グレード、4HP ¥325,500(日立)/¥479,150(ダイキン上位)、
        5HP ¥463,250、6HP ¥439,340〜489,500、10HP床置 ¥946,450。 */
export type MachineGrade = "standard" | "subsidy"; // subsidy=補助金要件を満たす高効率上位機
// 全500件(第9-10期)の馬力別 単価分布に再校正。標準=下位25%、上位(補助金)=中央〜上位。
export const MACHINE = {
  perHp: { standard: 52000, subsidy: 60000 } as Record<MachineGrade, number>,
  base: { standard: 150000, subsidy: 230000 } as Record<MachineGrade, number>,
  // 8馬力超は大型/床置で単価が跳ねるため高馬力プレミアムを加算
  highHpThreshold: 8,
  highHpPerHp: { standard: 120000, subsidy: 140000 } as Record<MachineGrade, number>,
  min: 250000,
};

/* メーカー/機種による価格差の補正（碓井さん: 補正した方が正確性が増す）。
   実績で同一4馬力でも ¥325,500（日立）〜¥479,150（ダイキン上位）と約1.47倍の開きがある。
   ただし裏取り済みのサンプルが2点のみのため、メーカー名を断定せず「コストクラス3段」の係数として実装する。 */
export type CostClass = "value" | "standard" | "premium";
export const COST_CLASS: Record<CostClass, { label: string; factor: number; note: string }> = {
  value:    { label: "コスト重視", factor: 0.85, note: "普及帯メーカー/型落ち想定（実績下限に近い水準）" },
  standard: { label: "標準",       factor: 1.0,  note: "PN見積の中央値水準" },
  premium:  { label: "上位グレード", factor: 1.25, note: "主要メーカー上位機/高効率仕様（実績上限に近い水準）" },
};

// 機器費(セット・円)目安。hp=馬力, costClass=メーカー/機種の価格帯補正
export function estimateMachineCost(hp: number, grade: MachineGrade = "standard", costClass: CostClass = "standard") {
  const h = Math.max(0, hp || 0);
  const f = COST_CLASS[costClass]?.factor ?? 1;
  let v = MACHINE.base[grade] + h * MACHINE.perHp[grade];
  if (h > MACHINE.highHpThreshold) v += (h - MACHINE.highHpThreshold) * MACHINE.highHpPerHp[grade];
  v *= f;
  return Math.max(Math.round((MACHINE.min * f) / 1000) * 1000, Math.round(v / 1000) * 1000);
}

/* 更新工事費(撤去+新設据付ほか)の単価目安。全500件・工事明細7,339行の中央値＋碓井さん校正(2026-07)。 */
export const WORK = {
  removeIndoorPerUnit: 22000,   // 既設室内機撤去（中央値 ¥22,000/台・n=451）
  removeOutdoorPerUnit: 28000,  // 既設室外機撤去（中央値 ¥28,700/台・n=320）
  installIndoorPerUnit: 30000,  // 新設室内機据付（中央値 ¥30,000/台・n=366）
  installOutdoorPerUnit: 37000, // 新設室外機据付（中央値 ¥37,500/台・n=189）
  pipingPerUnit: 25000,         // 配管工事（新設・更新）/台 ※碓井さん: 電気と分離
  electricPerUnit: 20000,       // 電気工事（脱着・結線・高所ほか）/台
  gasRecoverPerSystem: 25000,   // フロンガス回収（中央値 ¥25,000/系統・n=224）
  gasDestroyPerKg: GAS_DESTROY_PER_KG, // フロンガス破壊 ※共通定数（ドロップイン側 DROPIN.gasDestroyPerKg と同値）
  wastePerCubicMeter: 20000,    // 産業廃棄物処理 ¥20,000/㎥ ※碓井さん確認
  wasteVolPerUnit: 1.0,         // 撤去機1台あたり想定産廃体積(㎥)
  overheadRate: 0.05,           // 諸経費=工事小計×5%（案件規模連動）※碓井さん確認
  overheadMin: 50000,           // 諸経費 下限 ※碓井さん回答(2026-07)「¥50,000程度でも良い」→ ¥30,000から引上げ
};

/* 高所作業・仮設の単価（碓井さん 2026-07）。
   高所作業車は日額で独立計上する。足場は現地条件で大きく変わるため金額は入れず「要/不要」の暫定ルールのみ返す。 */
export const SITE_ACCESS = {
  aerialLiftPerDay: 20000,   // 高所作業車 ¥20,000/日
  scaffoldFloorThreshold: 3, // 3階以上=足場要 / 2階以下=不要（暫定ルール・金額は現地調査見積）
};
// 設置階から足場の要否を判定（暫定ルール）
export function needsScaffold(floor?: number) {
  return (floor ?? 1) >= SITE_ACCESS.scaffoldFloorThreshold;
}
// 高所作業車の費用（日額×日数）。更新工事・ドロップインの双方で使う。
export function aerialLiftCost(days?: number) {
  return Math.max(0, Math.round(days ?? 0)) * SITE_ACCESS.aerialLiftPerDay;
}

// 更新工事の総額概算（税抜・円）。台数・馬力・グレードから機器費+工事費を積算。ancillary=付帯工事(円)
export function estimateUpdateCost(opts: {
  units: number; hp: number; grade?: MachineGrade; costClass?: CostClass;
  systems?: number; kg?: number; ancillary?: number; aerialDays?: number; floor?: number;
}) {
  const units = Math.max(0, Math.round(opts.units));
  const grade = opts.grade ?? "standard";
  const costClass = opts.costClass ?? "standard";
  const systems = Math.max(1, opts.systems ?? Math.ceil(units / 2));
  const kg = Math.max(0, opts.kg ?? units * DEFAULT_KG_PER_UNIT);
  const ancillary = Math.max(0, opts.ancillary ?? 0);
  const aerialDays = Math.max(0, opts.aerialDays ?? 0);
  const aerial = Math.round(aerialDays * SITE_ACCESS.aerialLiftPerDay);
  const machine = units * estimateMachineCost(opts.hp, grade, costClass);
  const preOverhead =
    units * (WORK.removeIndoorPerUnit + WORK.removeOutdoorPerUnit + WORK.installIndoorPerUnit + WORK.installOutdoorPerUnit + WORK.pipingPerUnit + WORK.electricPerUnit) +
    systems * WORK.gasRecoverPerSystem +
    Math.round(kg * WORK.gasDestroyPerKg) +
    Math.round(units * WORK.wasteVolPerUnit * WORK.wastePerCubicMeter) +
    aerial;
  const overhead = Math.max(WORK.overheadMin, Math.round(preOverhead * WORK.overheadRate));
  const work = preOverhead + overhead + ancillary;
  return { machine, work, total: machine + work, units, grade, costClass, aerial, scaffoldRequired: needsScaffold(opts.floor) };
}

/* ───────── 更新工事の明細内訳（PN見積を再現） ─────────
   ★唯一の見積エンジン。「案件情報の設備投資概算（実勢で自動見積）」と
   「更新工事 見積シミュレーター」は必ずこの関数を経由し、同じ案件なら必ず同じ金額になる。

   ※2026-07 の連動改修による意図的な挙動変更:
     以前は estimateInvestManYenFromGroups() が設備群ごとに estimateUpdateCost() を呼んでいたため、
     諸経費の下限 ¥50,000 と 系統数 ceil(台数/2) が「設備群ごと」に効いていた。
     現在は1案件で1回だけ計上する（現場は1つなので実勢に近く、かつ上下の金額が一致する）。
     設備群が3つある案件では概算が最大 ¥100,000 程度下がる。 */
export interface EstimateLine { label: string; detail: string; amount: number; }
export interface UpdateGroupInput { units: number; hp?: number; }
export interface UpdateSiteOpts {
  grade?: MachineGrade; costClass?: CostClass;
  systems?: number; kg?: number; taxRate?: number;
  ancillary?: number; aerialDays?: number; floor?: number;
}

export function estimateUpdateBreakdownGroups(groups: UpdateGroupInput[], opts: UpdateSiteOpts = {}) {
  const gs = (groups ?? [])
    .map((g) => ({ units: Math.max(0, Math.round(g.units || 0)), hp: Math.max(0, g.hp ?? 0) }))
    .filter((g) => g.units > 0);
  const units = gs.reduce((a, g) => a + g.units, 0);
  const grade = opts.grade ?? "standard";
  const costClass = opts.costClass ?? "standard";
  // 台数0（未入力）のときは系統数も0にして、空の案件で諸経費だけが立つのを防ぐ
  const systems = units > 0 ? Math.max(1, opts.systems ?? Math.ceil(units / 2)) : 0;
  const kg = Math.max(0, opts.kg ?? units * DEFAULT_KG_PER_UNIT);
  const ancillary = Math.max(0, opts.ancillary ?? 0);
  const aerialDays = Math.max(0, opts.aerialDays ?? 0);
  const taxRate = opts.taxRate ?? CONSUMPTION_TAX_RATE; // 既定は共通の消費税率（表示側もこの値を参照する）
  const gradeLabel = grade === "subsidy" ? "高効率/補助金グレード" : "標準グレード";
  const classLabel = `${COST_CLASS[costClass].label}×${COST_CLASS[costClass].factor}`;
  const wasteVol = Math.round(units * WORK.wasteVolPerUnit * 10) / 10;

  // 機器費は設備群ごとに1行（馬力が違えば単価も違うため合算しない）
  const machineLines: EstimateLine[] = gs.length
    ? gs.map((g, i) => ({
        label: gs.length > 1 ? `機器費（室内外セット）${i + 1}` : "機器費（室内外セット）",
        detail: `${g.hp || "-"}馬力 × ${g.units}台（${gradeLabel}・${classLabel}）`,
        amount: g.units * estimateMachineCost(g.hp, grade, costClass),
      }))
    : [{ label: "機器費（室内外セット）", detail: `-馬力 × 0台（${gradeLabel}・${classLabel}）`, amount: 0 }];
  const machine = machineLines.reduce((a, l) => a + l.amount, 0);

  // 工事費は現場単位（台数・系統数の合計で1回だけ計上）
  const workLines: EstimateLine[] = [
    { label: "既設室内機 撤去", detail: `¥${WORK.removeIndoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.removeIndoorPerUnit },
    { label: "既設室外機 撤去", detail: `¥${WORK.removeOutdoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.removeOutdoorPerUnit },
    { label: "新設室内機 据付", detail: `¥${WORK.installIndoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.installIndoorPerUnit },
    { label: "新設室外機 据付", detail: `¥${WORK.installOutdoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.installOutdoorPerUnit },
    { label: "配管工事", detail: `¥${WORK.pipingPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.pipingPerUnit },
    { label: "電気工事（脱着・結線・高所ほか）", detail: `¥${WORK.electricPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.electricPerUnit },
    { label: "フロンガス回収", detail: `¥${WORK.gasRecoverPerSystem.toLocaleString()}/系統 × ${systems}`, amount: systems * WORK.gasRecoverPerSystem },
    { label: "フロンガス破壊", detail: `¥${WORK.gasDestroyPerKg.toLocaleString()}/kg × ${kg}kg`, amount: Math.round(kg * WORK.gasDestroyPerKg) },
    { label: "産業廃棄物処理", detail: `¥${WORK.wastePerCubicMeter.toLocaleString()}/㎥ × 約${wasteVol}㎥`, amount: Math.round(units * WORK.wasteVolPerUnit * WORK.wastePerCubicMeter) },
  ];
  if (aerialDays > 0) {
    workLines.push({ label: "高所作業車", detail: `¥${SITE_ACCESS.aerialLiftPerDay.toLocaleString()}/日 × ${aerialDays}日`, amount: Math.round(aerialDays * SITE_ACCESS.aerialLiftPerDay) });
  }
  const preOverhead = workLines.reduce((a, l) => a + l.amount, 0); // 機器費を除く工事小計
  const overhead = units > 0 ? Math.max(WORK.overheadMin, Math.round(preOverhead * WORK.overheadRate)) : 0;
  workLines.push({ label: "諸経費", detail: `工事小計×${Math.round(WORK.overheadRate * 100)}%（下限¥${WORK.overheadMin.toLocaleString()}）`, amount: overhead });
  if (ancillary > 0) workLines.push({ label: "付帯工事", detail: "配管更新・リモコン・養生・夜間割増ほか", amount: ancillary });

  const lines: EstimateLine[] = [...machineLines, ...workLines];
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const tax = Math.round(subtotal * taxRate);
  const aerial = Math.round(aerialDays * SITE_ACCESS.aerialLiftPerDay);
  return {
    lines, subtotal, tax, taxRate, total: subtotal + tax, machine, work: subtotal - machine,
    units, systems, kg, grade, costClass, aerial, aerialDays, groups: gs,
    scaffoldRequired: needsScaffold(opts.floor), floor: opts.floor ?? 1,
  };
}

// 単一設備（馬力×台数1種類）版。中身は estimateUpdateBreakdownGroups と同一エンジン。
export function estimateUpdateBreakdown(opts: {
  units: number; hp: number; grade?: MachineGrade; costClass?: CostClass;
  systems?: number; kg?: number; taxRate?: number; ancillary?: number; aerialDays?: number; floor?: number;
}) {
  return estimateUpdateBreakdownGroups([{ units: opts.units, hp: opts.hp }], opts);
}

/* 設備グループ（馬力×台数）から設備投資額(万円・税抜)を実勢で自動概算。補助金マッチングのROI連動用。
   見積シミュレーターと同じ estimateUpdateBreakdownGroups を通すので、両者の金額は必ず一致する。 */
export function estimateInvestManYenFromGroups(
  groups: { units: number; hp?: number }[], grade: MachineGrade = "standard", costClass: CostClass = "standard"
): number {
  return Math.round(estimateUpdateBreakdownGroups(groups, { grade, costClass }).subtotal / 10000);
}

export const yenJP = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

/* ───────── ドロップインROI判定基準 ─────────
   回収年数から営業判定を返す。目安: 系統あたり月電気代1万円以上≒3年以内回収の鉄板ゾーン。 */
export type RoiVerdict = { label: string; advice: string; tone: "good" | "ok" | "warn" | "weak" };
export function dropinRoiVerdict(paybackYears: number | null): RoiVerdict | null {
  if (paybackYears == null || !isFinite(paybackYears)) return null;
  if (paybackYears <= 3) return { label: "◎ 鉄板ゾーン", advice: "3年以内で回収。即ご提案を推奨", tone: "good" };
  if (paybackYears <= 5) return { label: "○ 標準", advice: "5年以内で回収。省エネ・脱炭素ニーズに有効", tone: "ok" };
  if (paybackYears <= 7) return { label: "△ 要検討", advice: "回収やや長め。消費電力 実測−33%の実績で補強を", tone: "warn" };
  return { label: "▲ 単体では弱い", advice: "フロン規制対応・機器更新＋補助金との合わせ技で提案", tone: "weak" };
}
