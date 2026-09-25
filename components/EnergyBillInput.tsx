"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { ELECTRIC_PRICE_YEN_PER_KWH } from "@/lib/pricing";
import {
  parseBillNumber,
  readEnergyBill,
  type BillPeriod,
  type EnergyBasis,
  type EnergyBill,
} from "@/lib/diagnosisEnergy";

/* ───────────────────────────────────────────────────────────
   電気料金の明細（任意）で、年間の電気代削減を計算し直す（2026-09-25）

   「結果と根拠」の段の、まとめのすぐ下に置く（数字が変わるところが見える場所）。
   畳んだ状態で出し、入れなくても診断は進む。
   使い道は lib/diagnosisEnergy.ts の2つだけ（単価・空調の推計の上限）。ここで計算はしない。

   入力中の文字はこの部品が持ち、数字として読めたものだけを上（DiagnosisFlow の state）に渡す。
   全角数字・カンマ・「円」「kWh」付きで入れても読める（lib/diagnosisEnergy.ts の parseBillNumber）。
   ─────────────────────────────────────────────────────────── */

const kwhText = (v: number) => Math.round(v).toLocaleString("ja-JP");

export function EnergyBillInput({
  bill,
  energy,
  onChange,
}: {
  bill: EnergyBill;
  energy: EnergyBasis;
  onChange: (bill: EnergyBill) => void;
}) {
  const id = useId();
  const [kwhRaw, setKwhRaw] = useState(bill.kwh != null ? String(bill.kwh) : "");
  const [yenRaw, setYenRaw] = useState(bill.yen != null ? String(bill.yen) : "");
  const [kwhError, setKwhError] = useState<string | null>(null);
  const [yenError, setYenError] = useState<string | null>(null);
  const reading = readEnergyBill(bill);

  const setPeriod = (period: BillPeriod) => onChange({ ...bill, period });
  const onKwh = (raw: string) => {
    setKwhRaw(raw);
    const p = parseBillNumber(raw);
    setKwhError(p.error);
    onChange({ ...bill, kwh: p.value });
  };
  const onYen = (raw: string) => {
    setYenRaw(raw);
    const p = parseBillNumber(raw);
    setYenError(p.error);
    onChange({ ...bill, yen: p.value });
  };
  const clear = () => {
    setKwhRaw("");
    setYenRaw("");
    setKwhError(null);
    setYenError(null);
    onChange({ period: bill.period, kwh: null, yen: null });
  };

  const inputCls = (bad: boolean) =>
    cn(
      "mt-1 min-h-[48px] w-full rounded-xl border bg-white px-3 text-[16px] leading-[1.6] text-ink tabular-nums",
      "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
      bad ? "border-[1.5px] border-red-700 bg-red-50/40" : "border-ink-line"
    );

  return (
    <details
      className="ehc-energy-bill rounded-2xl border border-ink-line bg-paper-card px-4 py-1 sm:px-5"
      open={reading.entered || undefined}
    >
      <summary className="min-h-[56px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
        {/* 段の summary は横並び（flex・右端に＋／−）なので、見出しと札を1つの縦の箱に入れる。
            札を見出しの横に置くと、スマートフォンの幅で見出しが3行に割れる。 */}
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span>
            電気料金の明細で計算し直す<span className="whitespace-nowrap">（任意）</span>
          </span>
          {energy.priceSource === "bill" && (
            <span className="whitespace-nowrap rounded-full border border-brand/40 bg-paper-tint px-2.5 py-0.5 text-[14px] font-bold leading-[1.5] text-brand-deep">
              明細の単価で計算中
            </span>
          )}
        </span>
      </summary>

      <div className="space-y-4 pb-4 pt-1">
        <p className="text-[14px] leading-[1.8] text-ink-soft">
          お手元の「電気ご使用量のお知らせ」や請求書の数字を入れると、年間の電気代削減を実際の単価（請求額 ÷ 使用量）で計算し直します。
          空欄のままでも診断は進められます。入れた数字は、この画面の計算と担当者へのご相談にだけ使います。
        </p>
        <p className="text-[14px] leading-[1.8] text-ink-soft">
          業務用の空調は「低圧電力（動力）」の契約で、照明などとは別の明細になっていることがあります。別になっている場合は、動力の明細の数字を入れてください。
        </p>

        <fieldset>
          <legend className="text-[14px] font-bold leading-[1.7] text-ink">明細の期間</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["month", "1か月分"],
                ["year", "1年分の合計"],
              ] as [BillPeriod, string][]
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border px-4 text-[16px] leading-[1.6]",
                  bill.period === value ? "border-brand bg-paper-tint font-bold text-brand-deep" : "border-ink-line text-ink"
                )}
              >
                <input
                  type="radio"
                  name={`${id}-period`}
                  value={value}
                  checked={bill.period === value}
                  onChange={() => setPeriod(value)}
                  className="h-5 w-5 accent-[#286644]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-kwh`} className="block text-[14px] font-bold leading-[1.7] text-ink">
              使用量（kWh）
            </label>
            <input
              id={`${id}-kwh`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="例: 1,200"
              value={kwhRaw}
              onChange={(e) => onKwh(e.target.value)}
              aria-invalid={!!kwhError || undefined}
              aria-describedby={`${id}-kwh-hint${kwhError ? ` ${id}-kwh-error` : ""}`}
              className={inputCls(!!kwhError)}
            />
            <p id={`${id}-kwh-hint`} className="mt-1 text-[14px] leading-[1.6] text-ink-soft">
              明細の「ご使用量」
            </p>
            {kwhError && (
              <p id={`${id}-kwh-error`} className="mt-1 text-[14px] font-bold leading-[1.6] text-red-700">
                {kwhError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-yen`} className="block text-[14px] font-bold leading-[1.7] text-ink">
              請求額（円・税込）
            </label>
            <input
              id={`${id}-yen`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="例: 38,000"
              value={yenRaw}
              onChange={(e) => onYen(e.target.value)}
              aria-invalid={!!yenError || undefined}
              aria-describedby={`${id}-yen-hint${yenError ? ` ${id}-yen-error` : ""}`}
              className={inputCls(!!yenError)}
            />
            <p id={`${id}-yen-hint`} className="mt-1 text-[14px] leading-[1.6] text-ink-soft">
              明細の「ご請求金額」（基本料金・再エネ賦課金などを含む合計）
            </p>
            {yenError && (
              <p id={`${id}-yen-error`} className="mt-1 text-[14px] font-bold leading-[1.6] text-red-700">
                {yenError}
              </p>
            )}
          </div>
        </div>

        <div aria-live="polite" className="space-y-2">
          {energy.priceSource === "bill" && (
            <p className="rounded-xl bg-[#f3f8ea] px-4 py-3 text-[14px] leading-[1.8] text-ink">
              <span className="font-bold">単価 約{energy.priceYenPerKwh.toFixed(1)}円/kWh</span>
              （請求額 ÷ 使用量）で、年間の電気代削減を計算しています。推計の単価（{ELECTRIC_PRICE_YEN_PER_KWH.toFixed(1)}円/kWh）の代わりです。
            </p>
          )}
          {energy.cappedByBill && energy.equipmentAnnualKwh != null && energy.billAnnualKwh != null && (
            <p className="rounded-xl bg-[#f3f8ea] px-4 py-3 text-[14px] leading-[1.8] text-ink">
              設備からの推計（年間 約{kwhText(energy.equipmentAnnualKwh)}kWh）が、明細の年間使用量（約{kwhText(energy.billAnnualKwh)}kWh）を超えたため、明細の値にそろえました。
              照明などの契約だけの明細で、空調が別の契約（動力）になっている場合は、動力の明細の数字を入れてください。
            </p>
          )}
          {reading.note && (
            <p
              className={cn(
                "text-[14px] leading-[1.8]",
                reading.note.kind === "warn" ? "rounded-xl border border-amber-500/45 bg-amber-50 px-4 py-3 text-amber-900" : "text-ink-soft"
              )}
            >
              {reading.note.text}
            </p>
          )}
        </div>

        <p className="text-[14px] leading-[1.7] text-ink-soft">
          明細の使用量は建物（契約）全体の値で、照明などの電気も含みます。空調の使用量としてそのまま置き換えず、設備からの推計の上限にだけ使います。
          1か月分は12倍して年間に直しています（季節によって月の使用量は大きく変わります）。
        </p>

        {reading.entered && (
          <button
            type="button"
            onClick={clear}
            className="min-h-[48px] rounded-xl border border-ink-line bg-paper-card px-4 text-[14px] font-bold leading-[1.7] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            明細の数字を消す（推計の単価に戻す）
          </button>
        )}
      </div>
    </details>
  );
}
