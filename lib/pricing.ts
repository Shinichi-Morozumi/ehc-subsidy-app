// 実勢単価モジュール
// 出典: 株式会社プロジェクトネオ(PN) 見積実績（第9期/第10期, 2024-2025年・担当 碓井）。
// あくまで「目安」。実見積は機種グレード・高所/搬入条件・配管長・電気容量で変動する。
export const PRICING_SOURCE = "PN見積 全500件分析（第9-10期 / 2024-2025年・参考値）";

/* ── HCガス材料単価（円/kg・税抜）の並記 ──
   sale: 大塚倉庫 実見積（HyChill 8.14kg＝¥472,120 → ¥58,000/kg・お客様向け販売単価）
   purchase: 仕入単価 ¥23,000/kg（桝口さん確認・2026-07）。MODE を "purchase" にすると原価ベースで試算。 */
export const HC_GAS_PRICE: Record<"sale" | "purchase", number> = {
  sale: 58000,
  purchase: 23000, // 桝口さん確認（2026-07）
};
export const HC_GAS_PRICE_MODE: "sale" | "purchase" = "sale";
// 粗利計算用: 販売−仕入（円/kg）
export const HC_GAS_MARGIN_PER_KG = HC_GAS_PRICE.sale - HC_GAS_PRICE.purchase;

/* ───────── ドロップイン（冷媒置換・既存機流用） ─────────
   基準: J&M奏 PN0000000282 ＋ PN自然冷媒ガス工事見積単価設定表（Sheet1・桝口さん校正 2026-07）。
   ドロップイン対象は業務用パッケージ 4馬力以上（ルームエアコン・小型パッケージ・冷凍冷蔵は対象外）。 */
export const DROPIN = {
  // フロンガス破壊費（円/kg）※桝口さん確認 3,000/kg
  gasDestroyPerKg: 3000,
  // 消耗・ボンベ・証明書・窒素等（系統あたり）。桝口さん 2026-07 実績値 ¥4,285/系統
  consumablePerSystem: 4285,
  // 諸経費率: 工事小計（作業＋破壊＋消耗）に対する比率。桝口さん目安「全体の25〜30%」→中央27%
  overheadRate: 0.27,
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
export const KG_PRESETS: Record<string, { label: string; kg: number; work: number }> = {
  hp4_6: { label: "4〜6馬力 パッケージ", kg: 3.5, work: 60000 },
  hp8_10: { label: "8〜10馬力 パッケージ", kg: 5, work: 76000 },
  hp12: { label: "12馬力〜 / ビル用マルチ", kg: 7, work: 106000 },
};
export const DEFAULT_KG_PRESET = "hp4_6";

// ドロップイン概算（税抜・円）= HCガス代金 + 工事費用。systems=系統数, kgPerSystem=系統あたり回収冷媒量, workPerSystem=系統あたり作業費
export function estimateDropinCost(
  systems: number,
  kgPerSystem = DROPIN.defaultKgPerSystem,
  workPerSystem = DROPIN.defaultWorkPerSystem
) {
  const s = Math.max(0, Math.round(systems));
  const kg = Math.max(0, s * kgPerSystem);
  const work = s * workPerSystem;
  const gas = Math.round(kg * DROPIN.gasDestroyPerKg);
  const consumable = s * DROPIN.consumablePerSystem;
  // 諸経費 = 工事小計（作業＋破壊＋消耗）× 諸経費率
  const overhead = s > 0 ? Math.round((work + gas + consumable) * DROPIN.overheadRate) : 0;
  // 新冷媒（HCガス）代金: 回収フロン量×充填比×単価
  const hcKg = Math.round(kg * DROPIN.hcChargeRatio * 10) / 10;
  const hcGas = Math.round(hcKg * DROPIN.hcGasPerKg);
  const workTotal = work + gas + consumable + overhead; // 工事費用 計
  const total = hcGas + workTotal;                      // ガス代金 + 工事費用
  return { systems: s, kg, work, gas, consumable, overhead, hcKg, hcGas, workTotal, total };
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

// 機器費(セット・円)目安。hp=馬力
export function estimateMachineCost(hp: number, grade: MachineGrade = "standard") {
  const h = Math.max(0, hp || 0);
  let v = MACHINE.base[grade] + h * MACHINE.perHp[grade];
  if (h > MACHINE.highHpThreshold) v += (h - MACHINE.highHpThreshold) * MACHINE.highHpPerHp[grade];
  return Math.max(MACHINE.min, Math.round(v / 1000) * 1000);
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
  gasDestroyPerKg: 3000,        // フロンガス破壊 ※碓井さん確認: 高騰により¥3,000/kg
  wastePerCubicMeter: 20000,    // 産業廃棄物処理 ¥20,000/㎥ ※碓井さん確認
  wasteVolPerUnit: 1.0,         // 撤去機1台あたり想定産廃体積(㎥)
  overheadRate: 0.05,           // 諸経費=工事小計×5%（案件規模連動）※碓井さん確認
  overheadMin: 30000,           // 諸経費 下限
};

// 更新工事の総額概算（税抜・円）。台数・馬力・グレードから機器費+工事費を積算。ancillary=付帯工事(円)
export function estimateUpdateCost(opts: {
  units: number; hp: number; grade?: MachineGrade; systems?: number; kg?: number; ancillary?: number;
}) {
  const units = Math.max(0, Math.round(opts.units));
  const grade = opts.grade ?? "standard";
  const systems = Math.max(1, opts.systems ?? Math.ceil(units / 2));
  const kg = Math.max(0, opts.kg ?? units * 3);
  const ancillary = Math.max(0, opts.ancillary ?? 0);
  const machine = units * estimateMachineCost(opts.hp, grade);
  const preOverhead =
    units * (WORK.removeIndoorPerUnit + WORK.removeOutdoorPerUnit + WORK.installIndoorPerUnit + WORK.installOutdoorPerUnit + WORK.pipingPerUnit + WORK.electricPerUnit) +
    systems * WORK.gasRecoverPerSystem +
    Math.round(kg * WORK.gasDestroyPerKg) +
    Math.round(units * WORK.wasteVolPerUnit * WORK.wastePerCubicMeter);
  const overhead = Math.max(WORK.overheadMin, Math.round(preOverhead * WORK.overheadRate));
  const work = preOverhead + overhead + ancillary;
  return { machine, work, total: machine + work, units, grade };
}

// 更新工事の明細内訳（PN見積を再現）。見積シミュレーター表示用。
export interface EstimateLine { label: string; detail: string; amount: number; }
export function estimateUpdateBreakdown(opts: {
  units: number; hp: number; grade?: MachineGrade; systems?: number; kg?: number; taxRate?: number; ancillary?: number;
}) {
  const units = Math.max(0, Math.round(opts.units));
  const grade = opts.grade ?? "standard";
  const systems = Math.max(1, opts.systems ?? Math.ceil(units / 2));
  const kg = Math.max(0, opts.kg ?? units * 3);
  const ancillary = Math.max(0, opts.ancillary ?? 0);
  const taxRate = opts.taxRate ?? 0.1;
  const mc = estimateMachineCost(opts.hp, grade);
  const wasteVol = Math.round(units * WORK.wasteVolPerUnit * 10) / 10;
  const baseLines: EstimateLine[] = [
    { label: "機器費（室内外セット）", detail: `${opts.hp || "-"}馬力 × ${units}台（${grade === "subsidy" ? "高効率/補助金グレード" : "標準グレード"}）`, amount: units * mc },
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
  const preOverhead = baseLines.slice(1).reduce((a, l) => a + l.amount, 0); // 機器費を除く工事小計
  const overhead = Math.max(WORK.overheadMin, Math.round(preOverhead * WORK.overheadRate));
  const lines: EstimateLine[] = [...baseLines, { label: "諸経費", detail: `工事小計×${Math.round(WORK.overheadRate * 100)}%（下限¥${WORK.overheadMin.toLocaleString()}）`, amount: overhead }];
  if (ancillary > 0) lines.push({ label: "付帯工事", detail: "配管更新・リモコン・養生・高所車・夜間割増ほか", amount: ancillary });
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const tax = Math.round(subtotal * taxRate);
  const machine = units * mc;
  return { lines, subtotal, tax, total: subtotal + tax, machine, work: subtotal - machine, units, systems, kg, grade };
}

// 設備グループ（馬力×台数）から設備投資額(万円)を実勢で自動概算。補助金マッチングのROI連動用。
export function estimateInvestManYenFromGroups(
  groups: { units: number; hp?: number }[], grade: MachineGrade = "standard"
): number {
  const yen = groups.reduce((a, g) => a + estimateUpdateCost({ units: g.units, hp: g.hp ?? 0, grade }).total, 0);
  return Math.round(yen / 10000);
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
