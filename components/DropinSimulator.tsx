"use client";
import { useState } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import { Gauge } from "lucide-react";

const PRICE = 27; // 円/kWh
const CO2 = 0.000434; // t-CO2/kWh
// 対象冷媒ごとの想定削減率レンジ（ドロップイン・実測校正前の概算）
const RATE: Record<string, { rate: number; label: string }> = {
  r404a: { rate: 0.35, label: "R404A 冷凍冷蔵（削減大）" },
  r410a: { rate: 0.25, label: "R410A 空調" },
  r22: { rate: 0.3, label: "R22 旧空調/冷凍" },
  r407c: { rate: 0.22, label: "R407C マルチ" },
};

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

export function DropinSimulator() {
  const [refri, setRefri] = useState("r410a");
  const [kwh, setKwh] = useState(80000);
  const [rate, setRate] = useState(0.25);
  const [cost, setCost] = useState(60); // ドロップイン施工費(万円)

  const onRefri = (v: string) => {
    setRefri(v);
    setRate(RATE[v].rate);
  };

  const saveKwh = Math.round(kwh * rate);
  const saveYen = saveKwh * PRICE;
  const co2 = Number((saveKwh * CO2).toFixed(1));
  const payback = saveYen > 0 ? Number(((cost * 10000) / saveYen).toFixed(1)) : null;

  return (
    <Card>
      <CardTitle icon={<Gauge className="w-5 h-5" />}>ドロップイン 簡易シミュレーター</CardTitle>
      <p className="text-xs text-slate-400 mb-3">
        既存機はそのまま、冷媒置換による概算効果。削減率は実測（大塚ドロップイン等）の到着後に校正します。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <Field label="対象冷媒">
          <Select value={refri} onChange={(e) => onRefri(e.target.value)}>
            {Object.entries(RATE).map(([k, v]) => (
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
        <Field label="ドロップイン施工費(万円)">
          <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-ehc-500/10 to-night-900 border border-ehc-500/30 rounded-xl p-3">
          <div className="text-[11px] text-ehc-300 mb-1">年間電力削減</div>
          <div className="text-xl font-bold text-ehc-300">{saveKwh.toLocaleString("ja-JP")}<span className="text-xs ml-1">kWh</span></div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-night-900 border border-amber-500/30 rounded-xl p-3">
          <div className="text-[11px] text-amber-300 mb-1">年間電気代削減</div>
          <div className="text-xl font-bold text-amber-300">{yen(saveYen)}</div>
        </div>
        <div className="bg-gradient-to-br from-sky-500/10 to-night-900 border border-sky-500/30 rounded-xl p-3">
          <div className="text-[11px] text-sky-300 mb-1">CO₂削減</div>
          <div className="text-xl font-bold text-sky-300">{co2}<span className="text-xs ml-1">t/年</span></div>
        </div>
        <div className="bg-gradient-to-br from-violet-500/10 to-night-900 border border-violet-500/30 rounded-xl p-3">
          <div className="text-[11px] text-violet-300 mb-1">投資回収</div>
          <div className="text-xl font-bold text-violet-300">{payback ? `${payback}年` : "—"}</div>
        </div>
      </div>
    </Card>
  );
}
