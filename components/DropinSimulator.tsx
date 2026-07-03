"use client";
import { useState } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import { Gauge, Calculator } from "lucide-react";
import { estimateDropinCost, dropinRoiVerdict, DROPIN, PRICING_SOURCE, yenJP } from "@/lib/pricing";

const PRICE = 27; // 円/kWh
const CO2 = 0.000438; // t-CO2/kWh（省エネ効果レポートと同一係数）
// 対象冷媒ごとの想定削減率ベース（ドロップイン・実測校正前の概算）
// ※ドロップイン対象は業務用空調のみ（冷凍冷蔵機器は対象外）
const RATE: Record<string, { rate: number; label: string }> = {
  r410a: { rate: 0.25, label: "R410A 空調" },
  r22: { rate: 0.3, label: "R22 旧型空調" },
  r407c: { rate: 0.22, label: "R407C マルチ" },
};
// 業種(稼働プロファイル)別の削減係数。稼働時間が長いほど削減効果が大きい想定。
const INDUSTRY: Record<string, { factor: number; label: string }> = {
  food: { factor: 1.15, label: "飲食店（厨房・長時間）" },
  retail: { factor: 1.1, label: "スーパー/小売" },
  factory: { factor: 1.0, label: "工場/倉庫" },
  clinic: { factor: 0.95, label: "クリニック/福祉" },
  office: { factor: 0.9, label: "オフィス/店舗" },
};
const clamp = (v: number, lo = 0.1, hi = 0.45) => Math.min(hi, Math.max(lo, v));

export function DropinSimulator() {
  const [refri, setRefri] = useState("r410a");
  const [industry, setIndustry] = useState("factory");
  const [kwh, setKwh] = useState(80000);
  const [rate, setRate] = useState(0.25);
  const [systems, setSystems] = useState(10);          // 系統数
  const [kgPerSys] = useState(DROPIN.defaultKgPerSystem);
  const [manualCost, setManualCost] = useState<number | null>(null); // 手動上書き(万円)

  const suggest = (r: string, ind: string) =>
    Math.round(clamp(RATE[r].rate * INDUSTRY[ind].factor) * 100) / 100;
  const onRefri = (v: string) => { setRefri(v); setRate(suggest(v, industry)); };
  const onIndustry = (v: string) => { setIndustry(v); setRate(suggest(refri, v)); };

  const est = estimateDropinCost(systems, kgPerSys);
  const costYen = manualCost != null ? manualCost * 10000 : est.total; // 施工費(税抜)
  const costTaxIn = Math.round(costYen * 1.1);
  const saveKwh = Math.round(kwh * rate);
  const saveYen = saveKwh * PRICE;
  const co2 = Number((saveKwh * CO2).toFixed(1));
  const payback = saveYen > 0 ? Number((costYen / saveYen).toFixed(1)) : null;
  const verdict = dropinRoiVerdict(payback);
  const VERDICT_C: Record<string, string> = {
    good: "text-ehc-300 border-ehc-500/40 bg-ehc-500/10",
    ok: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    warn: "text-orange-300 border-orange-500/40 bg-orange-500/10",
    weak: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  };

  return (
    <Card>
      <CardTitle icon={<Gauge className="w-5 h-5" />}>ドロップイン 簡易シミュレーター</CardTitle>
      <p className="text-xs text-slate-400 mb-3">
        既存機はそのまま、冷媒置換による概算効果。投資額は<strong className="text-ehc-300">HCガス代金＋工事費用</strong>（PN見積の系統単価ベース）で自動概算（手動上書き可）。削減率は冷媒×業種(稼働)から自動提案——都内物流倉庫の厨房系統で<strong className="text-ehc-300">実測 削減率33%</strong>（30日計測・2026年）を確認済み。
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Field label="対象冷媒">
          <Select value={refri} onChange={(e) => onRefri(e.target.value)}>
            {Object.entries(RATE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="業種（稼働）">
          <Select value={industry} onChange={(e) => onIndustry(e.target.value)}>
            {Object.entries(INDUSTRY).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="年間電力使用量(kWh)">
          <Input type="number" value={kwh} onChange={(e) => setKwh(Number(e.target.value))} />
        </Field>
        <Field label={`想定削減率: ${Math.round(rate * 100)}%`}>
          <input type="range" min={10} max={45} value={Math.round(rate * 100)} onChange={(e) => setRate(Number(e.target.value) / 100)} className="w-full accent-ehc-400" />
        </Field>
        <Field label="系統数（台）">
          <Input type="number" value={systems} onChange={(e) => { setSystems(Number(e.target.value)); setManualCost(null); }} />
        </Field>
      </div>

      {/* ガス代金＋工事費用の自動概算（PN実勢単価） */}
      <div className="bg-night-900/60 border border-white/10 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300"><Calculator className="w-3.5 h-3.5 text-ehc-300" />ガス代金＋工事費用 自動概算（{PRICING_SOURCE}）</div>
          <div className="text-[10px] text-slate-400">回収冷媒 {kgPerSys}kg/系統・計{est.kg}kg → HC充填 約{est.hcKg}kg</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[10px] mb-2">
          <div><div className="text-slate-500">HCガス代金({est.hcKg}kg)</div><div className="text-ehc-300 font-semibold">{yenJP(est.hcGas)}</div></div>
          <div><div className="text-slate-500">作業費(¥16,000/系統)</div><div className="text-slate-200">{yenJP(est.work)}</div></div>
          <div><div className="text-slate-500">フロン破壊(¥2,600/kg)</div><div className="text-slate-200">{yenJP(est.gas)}</div></div>
          <div><div className="text-slate-500">消耗・ボンベ等</div><div className="text-slate-200">{yenJP(est.consumable)}</div></div>
          <div><div className="text-slate-500">諸経費</div><div className="text-slate-200">{yenJP(est.overhead)}</div></div>
          <div><div className="text-slate-500">概算合計(税抜)</div><div className="text-ehc-300 font-bold">{yenJP(est.total)}</div></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-400">手動上書き(万円):</span>
          <input
            type="number"
            placeholder={String(Math.round(est.total / 10000))}
            value={manualCost ?? ""}
            onChange={(e) => setManualCost(e.target.value === "" ? null : Number(e.target.value))}
            className="w-24 bg-night-900 border border-white/15 rounded px-2 py-1 text-xs text-slate-100"
          />
          {manualCost != null && (
            <button onClick={() => setManualCost(null)} className="text-[10px] text-ehc-300 underline">自動に戻す</button>
          )}
          <span className="text-[10px] text-slate-500">採用投資額（ガス代金＋工事費用）: {yenJP(costYen)}（税込 {yenJP(costTaxIn)}）</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-ehc-500/10 to-night-900 border border-ehc-500/30 rounded-xl p-3">
          <div className="text-[11px] text-ehc-300 mb-1">年間電力削減</div>
          <div className="text-xl font-bold text-ehc-300">{saveKwh.toLocaleString("ja-JP")}<span className="text-xs ml-1">kWh</span></div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-night-900 border border-amber-500/30 rounded-xl p-3">
          <div className="text-[11px] text-amber-300 mb-1">年間電気代削減</div>
          <div className="text-xl font-bold text-amber-300">{yenJP(saveYen)}</div>
        </div>
        <div className="bg-gradient-to-br from-sky-500/10 to-night-900 border border-sky-500/30 rounded-xl p-3">
          <div className="text-[11px] text-sky-300 mb-1">CO₂削減</div>
          <div className="text-xl font-bold text-sky-300">{co2}<span className="text-xs ml-1">t/年</span></div>
        </div>
        <div className="bg-gradient-to-br from-violet-500/10 to-night-900 border border-violet-500/30 rounded-xl p-3">
          <div className="text-[11px] text-violet-300 mb-1">投資回収（税抜）</div>
          <div className="text-xl font-bold text-violet-300">{payback ? `${payback}年` : "—"}</div>
        </div>
      </div>

      {verdict && (
        <div className={`mt-3 border rounded-xl px-3 py-2 text-xs flex items-center gap-2 flex-wrap ${VERDICT_C[verdict.tone]}`}>
          <span className="font-bold">{verdict.label}</span>
          <span className="text-slate-300">{verdict.advice}</span>
          <span className="text-[10px] text-slate-500 ml-auto">目安: 系統あたり月電気代1万円以上≒3年以内回収</span>
        </div>
      )}
    </Card>
  );
}
