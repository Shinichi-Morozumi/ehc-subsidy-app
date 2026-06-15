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
};

// ドロップイン概算（税抜・円）。systems=系統数, kgPerSystem=系統あたり回収冷媒量
export function estimateDropinCost(systems: number, kgPerSystem = DROPIN.defaultKgPerSystem) {
  const s = Math.max(0, Math.round(systems));
  const kg = Math.max(0, s * kgPerSystem);
  const work = s * DROPIN.workPerSystem;
  const gas = Math.round(kg * DROPIN.gasDestroyPerKg);
  const consumable = s * DROPIN.consumablePerSystem;
  const overhead = s > 0 ? DROPIN.overhead : 0;
  const total = work + gas + consumable + overhead;
  return { systems: s, kg, work, gas, consumable, overhead, total };
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

/* 更新工事費(撤去+新設据付ほか)の単価目安。実績(中華そば/某焼き肉/まつむら歯科)より。 */
export const WORK = {
  removeIndoorPerUnit: 18000,   // 既設室内機撤去（天カセ）
  removeOutdoorPerUnit: 15000,  // 既設室外機撤去
  installIndoorPerUnit: 25000,  // 新設室内機据付
  installOutdoorPerUnit: 25000, // 新設室外機据付
  pipingElectricPerUnit: 45000, // 配管・電気・高所/脱着ほか（実勢ならし）
  gasRecoverPerSystem: 20000,   // フロンガス回収
  gasDestroyPerKg: 1800,        // フロンガス破壊（更新時）
  wastePerJob: 23000,           // 産業廃棄物処理
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

export const yenJP = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
