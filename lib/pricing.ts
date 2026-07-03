// 実勢単価モジュール
// 出典: 株式会社プロジェクトネオ(PN) 見積実績（第9期/第10期, 2024-2025年・担当 碓井）。
// あくまで「目安」。実見積は機種グレード・高所/搬入条件・配管長・電気容量で変動する。
export const PRICING_SOURCE = "PN見積 全500件分析（第9-10期 / 2024-2025年・参考値）";

/* ───────── ドロップイン（冷媒置換・既存機流用） ─────────
   基準: J&M奏 ドロップイン工事(ルームエアコン) PN0000000282
   21系統 / 工事代金 ¥610,000(税抜)。内訳から系統単価を抽出。 */
export const DROPIN = {
  // 系統あたり作業費（回収¥6,000+真空引き¥2,000+窒素ブロー/フラッシュ¥5,000+ノンフロン充填¥3,000）
  workPerSystem: 16000,
  // フロンガス破壊費（円/kg）
  gasDestroyPerKg: 2600,
  // 系統あたり消耗・ボンベ・証明書等
  consumablePerSystem: 2000,
  // 諸経費（運搬¥50,000+現場¥15,000+会社経費¥60,000）。案件固定の目安。
  overhead: 125000,
  // 系統あたり想定回収冷媒量(kg)の既定値（ルームエアコン基準）
  defaultKgPerSystem: 2,
  // ── HC冷媒（HyChill）ガス代金 ──
  // HC冷媒は比重が軽く、フロン充填量の約4割の重量で足りる（HyChill技術資料の一般値）
  hcChargeRatio: 0.4,
  // HCガス材料単価（円/kg・税抜）。※仮単価 — 実勢仕入値で要校正（桝口さん確認事項）
  hcGasPerKg: 8000,
};

// ドロップイン概算（税抜・円）= HCガス代金 + 工事費用。systems=系統数, kgPerSystem=系統あたり回収冷媒量
export function estimateDropinCost(systems: number, kgPerSystem = DROPIN.defaultKgPerSystem) {
  const s = Math.max(0, Math.round(systems));
  const kg = Math.max(0, s * kgPerSystem);
  const work = s * DROPIN.workPerSystem;
  const gas = Math.round(kg * DROPIN.gasDestroyPerKg);
  const consumable = s * DROPIN.consumablePerSystem;
  const overhead = s > 0 ? DROPIN.overhead : 0;
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

/* 更新工事費(撤去+新設据付ほか)の単価目安。全500件・工事明細7,339行の中央値に校正。 */
export const WORK = {
  removeIndoorPerUnit: 22000,   // 既設室内機撤去（中央値 ¥22,000/台・n=451）
  removeOutdoorPerUnit: 28000,  // 既設室外機撤去（中央値 ¥28,700/台・n=320）
  installIndoorPerUnit: 30000,  // 新設室内機据付（中央値 ¥30,000/台・n=366）
  installOutdoorPerUnit: 37000, // 新設室外機据付（中央値 ¥37,500/台・n=189）
  pipingElectricPerUnit: 45000, // 配管・電気・高所/脱着ほか（実勢ならし）
  gasRecoverPerSystem: 25000,   // フロンガス回収（中央値 ¥25,000/系統・n=224）
  gasDestroyPerKg: 2000,        // フロンガス破壊（更新時・実勢¥1,800〜2,600）
  wastePerJob: 40000,           // 産業廃棄物処理（産廃中央値 ¥71,429・処分込みならし）
  overheadPerJob: 30000,        // 諸経費（小規模案件）
};

// 更新工事の総額概算（税抜・円）。台数・馬力・グレードから機器費+工事費を積算。
export function estimateUpdateCost(opts: {
  units: number; hp: number; grade?: MachineGrade; systems?: number; kg?: number;
}) {
  const units = Math.max(0, Math.round(opts.units));
  const grade = opts.grade ?? "standard";
  const systems = Math.max(1, opts.systems ?? Math.ceil(units / 2));
  const kg = Math.max(0, opts.kg ?? units * 3);
  const machine = units * estimateMachineCost(opts.hp, grade);
  const work =
    units * (WORK.removeIndoorPerUnit + WORK.removeOutdoorPerUnit + WORK.installIndoorPerUnit + WORK.installOutdoorPerUnit + WORK.pipingElectricPerUnit) +
    systems * WORK.gasRecoverPerSystem +
    Math.round(kg * WORK.gasDestroyPerKg) +
    WORK.wastePerJob + WORK.overheadPerJob;
  return { machine, work, total: machine + work, units, grade };
}

// 更新工事の明細内訳（PN見積を再現）。見積シミュレーター表示用。
export interface EstimateLine { label: string; detail: string; amount: number; }
export function estimateUpdateBreakdown(opts: {
  units: number; hp: number; grade?: MachineGrade; systems?: number; kg?: number; taxRate?: number;
}) {
  const units = Math.max(0, Math.round(opts.units));
  const grade = opts.grade ?? "standard";
  const systems = Math.max(1, opts.systems ?? Math.ceil(units / 2));
  const kg = Math.max(0, opts.kg ?? units * 3);
  const taxRate = opts.taxRate ?? 0.1;
  const mc = estimateMachineCost(opts.hp, grade);
  const lines: EstimateLine[] = [
    { label: "機器費（室内外セット）", detail: `${opts.hp || "-"}馬力 × ${units}台（${grade === "subsidy" ? "高効率/補助金グレード" : "標準グレード"}）`, amount: units * mc },
    { label: "既設室内機 撤去", detail: `¥${WORK.removeIndoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.removeIndoorPerUnit },
    { label: "既設室外機 撤去", detail: `¥${WORK.removeOutdoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.removeOutdoorPerUnit },
    { label: "新設室内機 据付", detail: `¥${WORK.installIndoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.installIndoorPerUnit },
    { label: "新設室外機 据付", detail: `¥${WORK.installOutdoorPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.installOutdoorPerUnit },
    { label: "配管・電気・高所/脱着ほか", detail: `¥${WORK.pipingElectricPerUnit.toLocaleString()}/台 × ${units}`, amount: units * WORK.pipingElectricPerUnit },
    { label: "フロンガス回収", detail: `¥${WORK.gasRecoverPerSystem.toLocaleString()}/系統 × ${systems}`, amount: systems * WORK.gasRecoverPerSystem },
    { label: "フロンガス破壊", detail: `¥${WORK.gasDestroyPerKg.toLocaleString()}/kg × ${kg}kg`, amount: Math.round(kg * WORK.gasDestroyPerKg) },
    { label: "産業廃棄物処理", detail: "一式", amount: WORK.wastePerJob },
    { label: "諸経費", detail: "一式", amount: WORK.overheadPerJob },
  ];
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
