/* ───────────────────────────────────────────────────────────
   5段の診断で使う「年間の電力使用量」と「電気の単価」（2026-09-25）

   ■ 何が起きていたか（UXレビュー 追加所見）
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

   ■ 電気料金の明細（任意・2026-09-25 追加）
   　　明細の「使用量（kWh）」と「請求額（円）」を入れてもらえたら、次の2つだけに使う。
   　　1) 単価 ＝ 請求額 ÷ 使用量。年間の削減額（円）をこの単価で計算する（無ければ推計の単価）。
   　　   10〜80円/kWh を外れる値は、桁や期間の取り違えとみて使わない（理由を画面に出す）。
   　　2) 上限。明細の使用量は建物（契約）全体の値で、空調だけの値ではない。
   　　   空調の推計がそれを超えることはあり得ないので、超えたときは明細の値で頭を押さえる。
   　　   明細の値で推計を置き換えはしない（照明など空調以外の電気まで空調として数えてしまうため）。
   　　1か月分の明細は12倍して年間に直す（季節で変わることは画面に書く）。

   ■ ここで決めないこと
   　　kWh の式は書かない。推計は estimateAnnualKwhFromGroups() だけが行う。
   　　削減率と削減額の計算は lib/match.ts が行う（ここは入力を整えるだけ）。
   ─────────────────────────────────────────────────────────── */

import type { MatchInput } from "./types";
import { estimateAnnualKwhFromGroups, ELECTRIC_PRICE_YEN_PER_KWH } from "./pricing";

export type EnergySource = "equipment_estimate" | "unknown";

/* ───────── 電気料金の明細（任意入力） ───────── */
export type BillPeriod = "month" | "year";

export interface EnergyBill {
  /** 明細の期間。1か月分か、1年分の合計か */
  period: BillPeriod;
  /** 使用量（kWh）。未入力は null */
  kwh: number | null;
  /** 請求額（円・税込）。未入力は null */
  yen: number | null;
}

export const EMPTY_ENERGY_BILL: EnergyBill = { period: "month", kwh: null, yen: null };

/** 単価として使ってよい範囲（円/kWh）。これを外れる値は桁違い（千円単位の入力・期間の取り違え）とみる */
export const BILL_PRICE_RANGE = { min: 10, max: 80 } as const;

export interface BillReading {
  /** 何か1つでも入っているか */
  entered: boolean;
  /** 年間に直した使用量（kWh）。1か月分は×12。未入力は null */
  annualKwh: number | null;
  /** 単価（円/kWh）。使用量と請求額がそろい、範囲内のときだけ */
  priceYenPerKwh: number | null;
  /** 画面に出す一言。hint＝あと1つ入れると使える／warn＝入った値を使っていない */
  note: { kind: "hint" | "warn"; text: string } | null;
}

const positive = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

export function readEnergyBill(bill: EnergyBill | null | undefined): BillReading {
  const kwh = positive(bill?.kwh);
  const yen = positive(bill?.yen);
  const entered = kwh != null || yen != null;
  if (!bill || !entered) return { entered: false, annualKwh: null, priceYenPerKwh: null, note: null };
  const annualKwh = kwh == null ? null : bill.period === "month" ? kwh * 12 : kwh;
  if (kwh != null && yen != null) {
    const p = yen / kwh;
    if (p >= BILL_PRICE_RANGE.min && p <= BILL_PRICE_RANGE.max) {
      return { entered, annualKwh, priceYenPerKwh: p, note: null };
    }
    return {
      entered,
      annualKwh,
      priceYenPerKwh: null,
      note: {
        kind: "warn",
        text: `請求額 ÷ 使用量 が 約${p < 1 ? p.toFixed(2) : p.toFixed(1)}円/kWh になり、ふつうの範囲（${BILL_PRICE_RANGE.min}〜${BILL_PRICE_RANGE.max}円/kWh）を外れているため、この単価は使っていません。桁（千円単位になっていないか）と、使用量・請求額が同じ期間の値かをご確認ください。`,
      },
    };
  }
  if (kwh != null) {
    return { entered, annualKwh, priceYenPerKwh: null, note: { kind: "hint", text: "請求額も入れると、実際の単価（請求額 ÷ 使用量）で計算し直します。" } };
  }
  return { entered, annualKwh: null, priceYenPerKwh: null, note: { kind: "hint", text: "使用量（kWh）も入れると、単価を計算できます。" } };
}

/** 明細を見ながら打つので、「１，２００kWh」「38,000円」「¥38000」なども読む。読めなければ null（空欄も null） */
export function parseBillNumber(raw: string): { value: number | null; error: string | null } {
  const t = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,、\s]/g, "")
    .replace(/[．。]/g, ".")
    .replace(/^[¥￥]/, "")
    .replace(/(円|ｋＷｈ|kwh|kWh|KWH)$/i, "");
  if (t === "") return { value: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(t)) return { value: null, error: "数字で入力してください（例: 1,200）。" };
  const v = Number(t);
  if (!Number.isFinite(v) || v <= 0) return { value: null, error: "0より大きい数字を入力してください。" };
  return { value: v, error: null };
}

export interface EnergyBasis {
  /** equipment_estimate＝設備（台数×馬力）と建物用途からの推計／unknown＝推計できない */
  source: EnergySource;
  /** 計算に使った年間kWh（明細で上限を掛けたあと。丸めない）。unknown のときは null */
  annualKwh: number | null;
  /** 設備からの推計そのもの（上限を掛ける前）。unknown のときは null */
  equipmentAnnualKwh: number | null;
  /** 明細の使用量を年間に直した値。未入力は null */
  billAnnualKwh: number | null;
  /** 設備からの推計が明細の年間使用量を超えたため、明細の値にそろえたか */
  cappedByBill: boolean;
  /** 年間の削減額に使った単価（円/kWh） */
  priceYenPerKwh: number;
  /** bill＝明細から出した単価／estimate＝推計の単価（ELECTRIC_PRICE_YEN_PER_KWH） */
  priceSource: "bill" | "estimate";
}

export function applyEquipmentEnergy(
  input: MatchInput,
  bill?: EnergyBill | null
): { input: MatchInput; energy: EnergyBasis } {
  const reading = readEnergyBill(bill);
  const price = reading.priceYenPerKwh;
  const priceFields = {
    priceYenPerKwh: price ?? ELECTRIC_PRICE_YEN_PER_KWH,
    priceSource: price != null ? ("bill" as const) : ("estimate" as const),
  };
  const kwh = estimateAnnualKwhFromGroups(
    input.equipGroups.map((g) => ({ units: g.units, hp: g.hp })),
    input.building
  );
  if (kwh == null || !Number.isFinite(kwh) || kwh <= 0) {
    return {
      input: { ...input, kwhMode: "auto", kwh: 0, electricPriceYenPerKwh: price ?? undefined },
      energy: {
        source: "unknown",
        annualKwh: null,
        equipmentAnnualKwh: null,
        billAnnualKwh: reading.annualKwh,
        cappedByBill: false,
        ...priceFields,
      },
    };
  }
  const capped = reading.annualKwh != null && kwh > reading.annualKwh;
  const used = capped ? (reading.annualKwh as number) : kwh;
  return {
    input: { ...input, kwhMode: "auto", kwh: used, electricPriceYenPerKwh: price ?? undefined },
    energy: {
      source: "equipment_estimate",
      annualKwh: used,
      equipmentAnnualKwh: kwh,
      billAnnualKwh: reading.annualKwh,
      cappedByBill: capped,
      ...priceFields,
    },
  };
}

export const ENERGY_SOURCE_NOTE: Record<EnergySource, string> = {
  equipment_estimate:
    "入力した設備（台数×馬力）と建物用途から推計した年間の電力使用量です。電気料金の明細があれば「電気料金の明細で計算し直す」に入れると、実際の単価で削減額を計算し直します。",
  unknown:
    "馬力が未入力の設備があるため、年間の電力使用量を推計していません。削減額・CO2削減量・回収年数は未算定です（0という意味ではありません）。",
};
