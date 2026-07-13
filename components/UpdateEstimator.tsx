"use client";
import { useState } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import { Receipt } from "lucide-react";
import { estimateUpdateBreakdown, MachineGrade, PRICING_SOURCE, yenJP } from "@/lib/pricing";

// 補助率プリセット（代表例）
const RATES: { key: string; label: string; rate: number }[] = [
  { key: "none", label: "補助金なし", rate: 0 },
  { key: "two_thirds", label: "2/3（持続化・一般）", rate: 0.667 },
  { key: "half", label: "1/2（SII先進等）", rate: 0.5 },
  { key: "third", label: "1/3（自治体等）", rate: 0.333 },
];

export function UpdateEstimator() {
  const [hp, setHp] = useState(4);
  const [units, setUnits] = useState(3);
  const [systems, setSystems] = useState(2);
  const [grade, setGrade] = useState<MachineGrade>("standard");
  const [rateKey, setRateKey] = useState("two_thirds");
  const [capManYen, setCapManYen] = useState(0); // 補助上限(万円, 0=なし)
  const [ancillaryManYen, setAncillaryManYen] = useState(0); // 付帯工事(万円)

  const kg = units * 3;
  const est = estimateUpdateBreakdown({ units, hp, grade, systems, kg, ancillary: ancillaryManYen * 10000 });
  const rate = RATES.find((r) => r.key === rateKey)?.rate ?? 0;
  let subsidy = Math.round(est.subtotal * rate); // 税抜ベースで補助
  if (capManYen > 0) subsidy = Math.min(subsidy, capManYen * 10000);
  const netOut = est.total - subsidy; // 実質負担(税込−補助)

  return (
    <Card>
      <CardTitle icon={<Receipt className="w-5 h-5" />}>更新工事 見積シミュレーター</CardTitle>
      <p className="text-xs text-slate-400 mb-3">
        馬力・台数・系統から<strong className="text-ehc-300">明細つき概算見積</strong>を自動作成（{PRICING_SOURCE}）。
        実見積は機種グレード・高所/搬入・配管長で変動する<strong className="text-slate-200">参考値</strong>です。
      </p>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <Field label="馬力">
          <Input type="number" value={hp} onChange={(e) => setHp(Number(e.target.value))} />
        </Field>
        <Field label="台数（セット）">
          <Input type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} />
        </Field>
        <Field label="冷媒系統数">
          <Input type="number" value={systems} onChange={(e) => setSystems(Number(e.target.value))} />
        </Field>
        <Field label="機種グレード">
          <Select value={grade} onChange={(e) => setGrade(e.target.value as MachineGrade)}>
            <option value="standard">標準</option>
            <option value="subsidy">高効率(補助金グレード)</option>
          </Select>
        </Field>
        <Field label="補助率">
          <Select value={rateKey} onChange={(e) => setRateKey(e.target.value)}>
            {RATES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="付帯工事(万円・任意)">
          <Input type="number" value={ancillaryManYen} onChange={(e) => setAncillaryManYen(Number(e.target.value))} placeholder="0" />
        </Field>
      </div>

      {/* 明細 */}
      <div className="border border-white/10 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-[11px]">
          <thead className="bg-night-900/80 text-slate-400">
            <tr>
              <th className="text-left px-3 py-2 font-medium">項目</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">内訳</th>
              <th className="text-right px-3 py-2 font-medium">金額</th>
            </tr>
          </thead>
          <tbody>
            {est.lines.map((l, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-3 py-1.5 text-slate-200">{l.label}</td>
                <td className="px-3 py-1.5 text-slate-500 hidden md:table-cell">{l.detail}</td>
                <td className="px-3 py-1.5 text-right text-slate-200 tabular-nums">{yenJP(l.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-white/15 bg-white/5">
              <td className="px-3 py-1.5 text-slate-300 font-semibold" colSpan={2}>小計（税抜）</td>
              <td className="px-3 py-1.5 text-right text-slate-100 font-semibold tabular-nums">{yenJP(est.subtotal)}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="px-3 py-1.5 text-slate-400" colSpan={2}>消費税（10%）</td>
              <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">{yenJP(est.tax)}</td>
            </tr>
            <tr className="border-t border-white/15 bg-white/5">
              <td className="px-3 py-2 text-slate-200 font-bold" colSpan={2}>合計（税込）</td>
              <td className="px-3 py-2 text-right text-ehc-300 font-bold tabular-nums">{yenJP(est.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 補助金・実質負担 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-night-900 border border-white/10 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 mb-1">機器費 / 工事費</div>
          <div className="text-sm font-semibold text-slate-200">{yenJP(est.machine)}<span className="text-slate-500"> / </span>{yenJP(est.work)}</div>
        </div>
        <div className="bg-night-900 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] text-slate-400">補助上限(万円)</div>
          </div>
          <input type="number" value={capManYen} onChange={(e) => setCapManYen(Number(e.target.value))}
            className="w-full bg-night-900 border border-white/15 rounded px-2 py-1 text-sm text-slate-100" placeholder="0=上限なし" />
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-night-900 border border-amber-500/30 rounded-xl p-3">
          <div className="text-[11px] text-amber-300 mb-1">補助金額（概算）</div>
          <div className="text-lg font-bold text-amber-300">{yenJP(subsidy)}</div>
        </div>
        <div className="bg-gradient-to-br from-ehc-500/10 to-night-900 border border-ehc-500/30 rounded-xl p-3">
          <div className="text-[11px] text-ehc-300 mb-1">実質負担（税込−補助）</div>
          <div className="text-lg font-bold text-ehc-300">{yenJP(netOut)}</div>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        ※ 補助金額は小計(税抜)×補助率の概算。消費税は補助対象外が一般的。上限・対象経費は各制度の公募要領で要確認。
      </p>
    </Card>
  );
}
