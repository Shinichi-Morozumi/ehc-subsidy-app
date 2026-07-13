"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import { Gauge, Calculator, Printer, Mail, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useTabSwitch } from "./ui/Tabs";
import { estimateDropinCost, dropinRoiVerdict, KG_PRESETS, DEFAULT_KG_PRESET, PRICING_SOURCE, yenJP } from "@/lib/pricing";

const DEFAULT_PRICE = 27; // 円/kWh（既定・契約単価で上書き可）
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
// 桝口さん確認: 電気「使用量」削減の想定は25〜30%が現実的。電気「料金」の削減率は保証しない。
const clamp = (v: number, lo = 0.1, hi = 0.35) => Math.min(hi, Math.max(lo, v));

// 設備グループ（冷媒/機器タイプ/系統数がバラバラな機種を1試算で複数扱う）
interface DropGroup { id: string; refri: string; systems: number; machineType: string; }
const newGroup = (): DropGroup => ({
  id: `g${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
  refri: "r410a",
  systems: 10,
  machineType: DEFAULT_KG_PRESET,
});

export function DropinSimulator() {
  const [industry, setIndustry] = useState("factory");
  const [kwh, setKwh] = useState(80000);
  const [rate, setRate] = useState(0.25);
  const [groups, setGroups] = useState<DropGroup[]>([newGroup()]);
  const [manualCost, setManualCost] = useState<number | null>(null); // 手動上書き(万円)
  const [price, setPrice] = useState(DEFAULT_PRICE); // 電力単価(円/kWh)
  const switchTab = useTabSwitch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 冷媒×機器量(系統数×kg)で重み付けした加重平均削減率 × 業種係数
  const suggestRate = (gs: DropGroup[], ind: string) => {
    let wsum = 0, acc = 0;
    gs.forEach((g) => {
      const w = Math.max(0, g.systems) * KG_PRESETS[g.machineType].kg;
      wsum += w;
      acc += (RATE[g.refri]?.rate ?? 0.25) * w;
    });
    const base = wsum > 0 ? acc / wsum : 0.25;
    return Math.round(clamp(base * INDUSTRY[ind].factor) * 100) / 100;
  };

  const applyGroups = (next: DropGroup[]) => { setGroups(next); setRate(suggestRate(next, industry)); setManualCost(null); };
  const addGroup = () => applyGroups([...groups, newGroup()]);
  const removeGroup = (id: string) => { if (groups.length <= 1) return; applyGroups(groups.filter((x) => x.id !== id)); };
  const updateGroup = (id: string, patch: Partial<DropGroup>) => applyGroups(groups.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const onIndustry = (v: string) => { setIndustry(v); setRate(suggestRate(groups, v)); };

  // 設備グループ別に概算し合算（HCガス代金・工事費用とも加算）
  const groupEsts = groups.map((g) => ({
    ...g,
    kgPerSys: KG_PRESETS[g.machineType].kg,
    workPerSys: KG_PRESETS[g.machineType].work,
    est: estimateDropinCost(g.systems, KG_PRESETS[g.machineType].kg, KG_PRESETS[g.machineType].work),
  }));
  const est = groupEsts.reduce(
    (a, x) => ({
      systems: a.systems + x.est.systems,
      kg: a.kg + x.est.kg,
      work: a.work + x.est.work,
      gas: a.gas + x.est.gas,
      consumable: a.consumable + x.est.consumable,
      overhead: a.overhead + x.est.overhead,
      hcKg: Math.round((a.hcKg + x.est.hcKg) * 10) / 10,
      hcGas: a.hcGas + x.est.hcGas,
      workTotal: a.workTotal + x.est.workTotal,
      total: a.total + x.est.total,
    }),
    { systems: 0, kg: 0, work: 0, gas: 0, consumable: 0, overhead: 0, hcKg: 0, hcGas: 0, workTotal: 0, total: 0 }
  );
  const sysTotal = est.systems;
  const multi = groups.length > 1;

  const costYen = manualCost != null ? manualCost * 10000 : est.total; // 施工費(税抜)
  const costTaxIn = Math.round(costYen * 1.1);
  const saveKwh = Math.round(kwh * rate);
  const saveYen = saveKwh * price;
  const co2 = Number((saveKwh * CO2).toFixed(1));
  const payback = saveYen > 0 ? Number((costYen / saveYen).toFixed(1)) : null;
  const verdict = dropinRoiVerdict(payback);
  const VERDICT_C: Record<string, string> = {
    good: "text-ehc-300 border-ehc-500/40 bg-ehc-500/10",
    ok: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    warn: "text-orange-300 border-orange-500/40 bg-orange-500/10",
    weak: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  };

  // ヘッドライン用の設備サマリー
  const equipSummary = multi
    ? `設備${groups.length}種・計${sysTotal}系統`
    : `${RATE[groups[0].refri].label}・${groups[0].systems}台`;

  // 問い合わせメールに現在の試算条件を自動転記
  const mailBody = [
    "ドロップイン簡易シミュレーターの条件で相談します。",
    "",
    `業種（稼働）: ${INDUSTRY[industry].label}`,
    `年間電力使用量: ${kwh.toLocaleString("ja-JP")}kWh（単価 ¥${price}/kWh）`,
    `想定削減率: ${Math.round(rate * 100)}%`,
    `対象設備（計${sysTotal}系統）:`,
    ...groups.map((g, i) => `  ${i + 1}) ${RATE[g.refri].label} / ${g.systems}台 / ${KG_PRESETS[g.machineType].label}`),
    `概算投資額: ${yenJP(costYen)}（税込 ${yenJP(costTaxIn)}）`,
    `年間電気代削減: ${yenJP(saveYen)} ／ 投資回収: ${payback != null ? `約${payback}年` : "—"}`,
  ].join("\n");
  const mailHref = `mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent("【ドロップイン】簡易見積の相談")}&body=${encodeURIComponent(mailBody)}`;

  // 印刷: body に print-dropin を付け、印刷専用ビューのみ出力
  const printQuote = () => {
    document.body.classList.add("print-dropin");
    const off = () => { document.body.classList.remove("print-dropin"); window.removeEventListener("afterprint", off); };
    window.addEventListener("afterprint", off);
    window.print();
  };

  return (
    <Card>
      <CardTitle icon={<Gauge className="w-5 h-5" />}>ドロップイン 簡易シミュレーター</CardTitle>
      <p className="text-xs text-slate-400 mb-3">
        既存機はそのまま、冷媒置換による概算効果。冷媒・機器・系統数が異なる場合は<strong className="text-ehc-300">設備グループを複数追加</strong>できます。投資額は<strong className="text-ehc-300">HCガス代金＋工事費用</strong>（PN見積の系統単価ベース）でグループ別に概算し合算（手動上書き可）。削減率は冷媒×業種(稼働)の加重平均から自動提案——想定は<strong className="text-ehc-300">消費電力の25〜30%</strong>（都内物流倉庫の厨房系統で実測−33%・30日計測/2026年）。※電気「料金」の削減率は契約条件により変動し保証されません。
      </p>

      {/* 共通条件（業種・電力） */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
        <Field label="電力単価(円/kWh)">
          <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          <p className="text-[9px] text-slate-500 mt-1 leading-tight">※基本料金＋従量で変動。大手電力(東電/関電/中電/九電/東北電/北電)HPの従量単価が目安</p>
        </Field>
        <Field label={`想定削減率: ${Math.round(rate * 100)}%`}>
          <input type="range" min={10} max={35} value={Math.round(rate * 100)} onChange={(e) => setRate(Number(e.target.value) / 100)} className="w-full accent-ehc-400" />
          <p className="text-[9px] text-slate-500 mt-1 leading-tight">※冷媒×業種の加重平均から自動提案（手動調整可）</p>
        </Field>
      </div>

      {/* 設備グループ（冷媒・機器・系統数をグループ別に入力） */}
      <div className="space-y-2 mb-4">
        {groups.map((g, i) => (
          <div key={g.id} className="bg-night-900/60 border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-ehc-300">設備グループ {i + 1}</span>
              {multi && (
                <button onClick={() => removeGroup(g.id)} className="text-slate-400 hover:text-rose-300 inline-flex items-center gap-0.5 text-[10px]">
                  <Trash2 className="w-3 h-3" />削除
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="対象冷媒">
                <Select value={g.refri} onChange={(e) => updateGroup(g.id, { refri: e.target.value })}>
                  {Object.entries(RATE).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="系統数（台）">
                <Input type="number" value={g.systems} onChange={(e) => updateGroup(g.id, { systems: Number(e.target.value) })} />
              </Field>
              <Field label="機器タイプ（冷媒量）">
                <Select value={g.machineType} onChange={(e) => updateGroup(g.id, { machineType: e.target.value })}>
                  {Object.entries(KG_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button onClick={addGroup} className="border border-dashed border-ehc-500/40 text-ehc-300 rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-ehc-500/10 transition-colors">
            <Plus className="w-3.5 h-3.5" />設備グループを追加
          </button>
          <span className="text-[11px] text-slate-400">合計 {groups.length} グループ・{sysTotal} 系統</span>
        </div>
      </div>

      {/* ガス代金＋工事費用の自動概算（PN実勢単価・グループ合算） */}
      <div className="bg-night-900/60 border border-white/10 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300"><Calculator className="w-3.5 h-3.5 text-ehc-300" />ガス代金＋工事費用 自動概算（{PRICING_SOURCE}）</div>
          <div className="text-[10px] text-slate-400">回収冷媒 計{est.kg}kg → HC充填 約{est.hcKg}kg{multi ? `・${groups.length}グループ合算` : ""}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[10px] mb-2">
          <div><div className="text-slate-500">HCガス代金({est.hcKg}kg)</div><div className="text-ehc-300 font-semibold">{yenJP(est.hcGas)}</div></div>
          <div><div className="text-slate-500">作業費{multi ? "（系統別単価）" : ""}</div><div className="text-slate-200">{yenJP(est.work)}</div></div>
          <div><div className="text-slate-500">フロン破壊(¥3,000/kg)</div><div className="text-slate-200">{yenJP(est.gas)}</div></div>
          <div><div className="text-slate-500">消耗・ボンベ等</div><div className="text-slate-200">{yenJP(est.consumable)}</div></div>
          <div><div className="text-slate-500">諸経費(約27%)</div><div className="text-slate-200">{yenJP(est.overhead)}</div></div>
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
          <span className="text-[10px] text-slate-500">※実勢±20%程度のレンジあり</span>
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
          {(verdict.tone === "warn" || verdict.tone === "weak") && switchTab && (
            <button onClick={() => switchTab("match")}
              className="underline font-semibold inline-flex items-center gap-0.5 hover:opacity-80">
              補助金マッチングで診断<ArrowRight className="w-3 h-3" />
            </button>
          )}
          <span className="text-[10px] text-slate-500 ml-auto">目安: 系統あたり月電気代1万円以上≒3年以内回収</span>
        </div>
      )}

      {/* アクション: 条件付きで相談メール・印刷/PDF */}
      <div className="mt-3 flex flex-wrap gap-2 no-print">
        <a href={mailHref}
          className="bg-ehc-500/15 text-ehc-300 border border-ehc-500/40 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-ehc-500/25 transition-colors">
          <Mail className="w-3.5 h-3.5" />この条件で相談メール
        </a>
        <button onClick={printQuote}
          className="bg-white/5 text-slate-300 border border-white/15 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-white/10 transition-colors">
          <Printer className="w-3.5 h-3.5" />簡易見積を印刷 / PDF
        </button>
      </div>

      {/* 印刷専用ビュー（body直下にポータル・画面では非表示） */}
      {mounted && createPortal(
        <div className="dropin-print-view bg-white text-slate-900 p-2">
          <div className="flex items-baseline justify-between border-b-2 border-emerald-700 pb-2 mb-4">
            <div>
              <div className="text-lg font-bold">ドロップイン 簡易お見積り（概算）</div>
              <div className="text-[11px] text-slate-600">炭化水素冷媒（HyChill）置換による省エネ効果と概算費用</div>
            </div>
            <div className="text-right text-[11px] text-slate-600">
              <div className="font-bold text-slate-900">株式会社EHCソリューションズ</div>
              <div>発行日: {new Date().toLocaleDateString("ja-JP")}</div>
            </div>
          </div>

          <div className="text-xs font-bold mb-1">■ 試算条件</div>
          <table className="w-full text-[11px] border border-slate-300 mb-3">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-1.5 bg-slate-100 w-36 font-semibold">業種（稼働）</td><td className="p-1.5">{INDUSTRY[industry].label}</td>
                <td className="p-1.5 bg-slate-100 w-36 font-semibold">想定削減率</td><td className="p-1.5">{Math.round(rate * 100)}%</td>
              </tr>
              <tr>
                <td className="p-1.5 bg-slate-100 font-semibold">年間電力使用量</td><td className="p-1.5">{kwh.toLocaleString("ja-JP")} kWh（単価 ¥{price}/kWh）</td>
                <td className="p-1.5 bg-slate-100 font-semibold">系統数 合計</td><td className="p-1.5">{sysTotal} 台（回収冷媒 計{est.kg}kg）</td>
              </tr>
            </tbody>
          </table>

          <div className="text-xs font-bold mb-1">■ 対象設備（{groups.length}グループ）</div>
          <table className="w-full text-[11px] border border-slate-300 mb-4">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-1.5 text-left font-semibold">#</th>
                <th className="p-1.5 text-left font-semibold">対象冷媒</th>
                <th className="p-1.5 text-left font-semibold">機器タイプ</th>
                <th className="p-1.5 text-right font-semibold">系統数</th>
                <th className="p-1.5 text-right font-semibold">回収冷媒</th>
              </tr>
            </thead>
            <tbody>
              {groupEsts.map((g, i) => (
                <tr key={g.id} className="border-b border-slate-200">
                  <td className="p-1.5">{i + 1}</td>
                  <td className="p-1.5">{RATE[g.refri].label}</td>
                  <td className="p-1.5">{KG_PRESETS[g.machineType].label}</td>
                  <td className="p-1.5 text-right">{g.systems} 台</td>
                  <td className="p-1.5 text-right">{g.est.kg} kg</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-xs font-bold mb-1">■ 概算費用内訳（ガス代金＋工事費用・全グループ合算）</div>
          <table className="w-full text-[11px] border border-slate-300 mb-4">
            <tbody>
              <tr className="border-b border-slate-200"><td className="p-1.5 bg-slate-100 font-semibold">HCガス代金（約{est.hcKg}kg）</td><td className="p-1.5 text-right">{yenJP(est.hcGas)}</td></tr>
              <tr className="border-b border-slate-200"><td className="p-1.5 bg-slate-100 font-semibold">作業費（回収・真空引き・フラッシュ・充填）</td><td className="p-1.5 text-right">{yenJP(est.work)}</td></tr>
              <tr className="border-b border-slate-200"><td className="p-1.5 bg-slate-100 font-semibold">フロンガス破壊費</td><td className="p-1.5 text-right">{yenJP(est.gas)}</td></tr>
              <tr className="border-b border-slate-200"><td className="p-1.5 bg-slate-100 font-semibold">消耗・ボンベ・証明書等</td><td className="p-1.5 text-right">{yenJP(est.consumable)}</td></tr>
              <tr className="border-b border-slate-200"><td className="p-1.5 bg-slate-100 font-semibold">諸経費</td><td className="p-1.5 text-right">{yenJP(est.overhead)}</td></tr>
              <tr className="border-b border-slate-300 font-bold"><td className="p-1.5 bg-emerald-50">概算合計（税抜）{manualCost != null ? "※手動調整あり" : ""}</td><td className="p-1.5 text-right text-emerald-800">{yenJP(costYen)}</td></tr>
              <tr className="font-bold"><td className="p-1.5 bg-emerald-50">概算合計（税込）</td><td className="p-1.5 text-right text-emerald-800">{yenJP(costTaxIn)}</td></tr>
            </tbody>
          </table>

          <div className="text-xs font-bold mb-1">■ 期待効果（年間）</div>
          <table className="w-full text-[11px] border border-slate-300 mb-4">
            <tbody>
              <tr>
                <td className="p-1.5 bg-slate-100 font-semibold w-1/4">電力削減</td><td className="p-1.5">{saveKwh.toLocaleString("ja-JP")} kWh</td>
                <td className="p-1.5 bg-slate-100 font-semibold w-1/4">電気代削減</td><td className="p-1.5 font-bold text-emerald-800">{yenJP(saveYen)}</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="p-1.5 bg-slate-100 font-semibold">CO₂削減</td><td className="p-1.5">{co2} t/年</td>
                <td className="p-1.5 bg-slate-100 font-semibold">投資回収（税抜）</td><td className="p-1.5 font-bold text-emerald-800">{payback ? `約${payback}年` : "—"}{verdict ? `（${verdict.label}）` : ""}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-[10px] text-slate-600 leading-relaxed">
            ※本書は概算（目安）です。実際の効果・費用は機種・稼働・現地条件により±20%程度変動します。正式なお見積りは現地確認のうえご提示します。<br />
            ※ドロップイン対象は業務用パッケージ（4馬力以上）のみ。ルームエアコン/小型パッケージ/冷凍冷蔵機器は対象外です。<br />
            ※ドロップイン工事は省エネ補助金の対象外です（補助金で更新した機器にはドロップインを施工できません）。<br />
            ※削減率は消費電力ベースの想定（25〜30%）。電気「料金」の削減率は契約条件により変動し保証されません。<br />
            ※単価出典: {PRICING_SOURCE}。都内物流倉庫の厨房系統で消費電力 実測−33%（30日計測・2026年）を確認済み。
          </div>
          <div className="mt-3 pt-2 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between">
            <span>お問い合わせ: info@ehcjpn.com</span>
            <span>© 2026 株式会社EHCソリューションズ</span>
          </div>
        </div>,
        document.body
      )}
    </Card>
  );
}
