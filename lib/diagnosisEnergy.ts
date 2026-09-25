/* ───────────────────────────────────────────────────────────
   5段の診断で使う「年間の電力使用量」（2026-09-25 UXレビュー 追加所見）

   ■ 何が起きていたか
   　　5段の診断は年間の電力使用量を聞いていない。それなのに計算入力には、
   　　旧シミュレーターの初期値（kWh 80,000・自動按分）がそのまま入っていた。
   　　「結果と根拠」の段の省エネ見込み（年間の削減額・CO2削減量）は、
   　　誰も答えていない 80,000kWh から出ていたことになる。
   　　室内機3台・5馬力の事務所なら、設備からの推計は年間 約1.5万kWh で、
   　　初期値はその5倍以上。削減額も回収年数も実際より良く見える向きにずれる。
   　　CO2の量で要件を判定する制度（例：3t以上）の判定も、この初期値に引きずられていた。

   ■ ここで決めること
   　　入力された設備（台数×馬力）と建物用途から、lib/pricing.ts の
   　　estimateAnnualKwhFromGroups()（SII 指定計算の参照機にもとづく推計）で年間kWhを出して使う。
   　　馬力が未入力の設備があるときは推計しない（馬力を仮置きしない＝EHC-0038 P0-9 と同じ考え方）。
   　　そのときは kWh を 0（＝不明）にし、削減額・CO2・回収年数は「未算定」と表示する。

   ■ ここで決めないこと
   　　kWh の式は書かない。推計は estimateAnnualKwhFromGroups() だけが行う。
   ─────────────────────────────────────────────────────────── */

import type { MatchInput } from "./types";
import { estimateAnnualKwhFromGroups } from "./pricing";

export type EnergySource = "equipment_estimate" | "unknown";

export interface EnergyBasis {
  /** equipment_estimate＝設備（台数×馬力）と建物用途からの推計／unknown＝推計できない */
  source: EnergySource;
  /** 推計した年間kWh（丸めない）。unknown のときは null */
  annualKwh: number | null;
}

export function applyEquipmentEnergy(input: MatchInput): { input: MatchInput; energy: EnergyBasis } {
  const kwh = estimateAnnualKwhFromGroups(
    input.equipGroups.map((g) => ({ units: g.units, hp: g.hp })),
    input.building
  );
  if (kwh == null || !Number.isFinite(kwh) || kwh <= 0) {
    return { input: { ...input, kwhMode: "auto", kwh: 0 }, energy: { source: "unknown", annualKwh: null } };
  }
  return { input: { ...input, kwhMode: "auto", kwh }, energy: { source: "equipment_estimate", annualKwh: kwh } };
}

export const ENERGY_SOURCE_NOTE: Record<EnergySource, string> = {
  equipment_estimate:
    "入力した設備（台数×馬力）と建物用途から推計した年間の電力使用量です。電気料金の明細があれば、実際の使用量に置き換えて精度を上げられます。",
  unknown:
    "馬力が未入力の設備があるため、年間の電力使用量を推計していません。削減額・CO2削減量・回収年数は未算定です（0という意味ではありません）。",
};
