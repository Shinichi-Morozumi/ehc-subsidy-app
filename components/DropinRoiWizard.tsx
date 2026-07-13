"use client";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceDot,
} from "recharts";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import {
  Sparkles, ArrowRight, ArrowLeft, RotateCcw, TrendingDown, Wallet, Leaf, CalendarClock, Mail, Plus, Trash2,
} from "lucide-react";
import { useTabSwitch } from "./ui/Tabs";
import { estimateDropinCost, dropinRoiVerdict, KG_PRESETS, DEFAULT_KG_PRESET, yenJP } from "@/lib/pricing";

const DEFAULT_PRICE = 27; // 円/kWh（既定・契約単価で上書き可）
const CO2 = 0.000438;      // t-CO2/kWh（省エネ効果レポートと同一係数）
const YEARS = 15;
const DEGRADE = 0.02;      // 旧機の年あたり電力増（経年劣化）

// 対象冷媒ごとのドロップイン想定削減率ベース
// ※ドロップイン対象は業務用空調のみ（冷凍冷蔵機器は対象外）
const RATE: Record<string, { rate: number; label: string }> = {
  r410a: { rate: 0.25, label: "R410A 業務用空調（最多）" },
  r22: { rate: 0.3, label: "R22 旧型空調" },
  r407c: { rate: 0.22, label: "R407C ビル用マルチ" },
  unknown: { rate: 0.25, label: "わからない（標準で試算）" },
};
// 業種(稼働プロファイル)別の削減係数
const INDUSTRY: Record<string, { factor: number; label: string }> = {
  food: { factor: 1.15, label: "飲食店（厨房・長時間）" },
  retail: { factor: 1.1, label: "スーパー/小売" },
  factory: { factor: 1.0, label: "工場/倉庫" },
  clinic: { factor: 0.95, label: "クリニック/福祉/ホテル" },
  office: { factor: 0.9, label: "オフィス/店舗" },
};
// 桝口さん確認: 消費電力の削減想定は25〜30%が現実的。電気「料金」削減率は保証しない。
const clamp = (v: number, lo = 0.1, hi = 0.35) => Math.min(hi, Math.max(lo, v));

// 設備グループ（冷媒・系統数・機器タイプがバラバラな機種を1診断内で複数扱う）
interface DropGroup { id: string; refri: string; systems: number | ""; machineType: string; }
const newGroup = (): DropGroup => ({ id: `g${Date.now()}${Math.random().toString(36).slice(2, 6)}`, refri: "", systems: "", machineType: DEFAULT_KG_PRESET });

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["業種", "設備", "電気代", "ご提案"];

export function DropinRoiWizard() {
  const [step, setStep] = useState<Step>(0);
  const [industry, setIndustry] = useState("");
  const [groups, setGroups] = useState<DropGroup[]>([newGroup()]);
  const [monthlyBill, setMonthlyBill] = useState<number | "">("");  // 対象設備 全体の月の電気代(円)
  const [price, setPrice] = useState(DEFAULT_PRICE);                 // 電力単価(円/kWh)
  const switchTab = useTabSwitch();

  const addGroup = () => setGroups((gs) => [...gs, newGroup()]);
  const removeGroup = (id: string) => setGroups((gs) => (gs.length > 1 ? gs.filter((g) => g.id !== id) : gs));
  const updateGroup = (id: string, patch: Partial<DropGroup>) =>
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const groupsReady = groups.every((g) => g.refri !== "" && typeof g.systems === "number" && g.systems > 0);
  const canNext =
    (step === 0 && industry !== "") ||
    (step === 1 && groupsReady) ||
    (step === 2 && typeof monthlyBill === "number" && monthlyBill > 0);

  const reset = () => { setStep(0); setIndustry(""); setGroups([newGroup()]); setMonthlyBill(""); setPrice(DEFAULT_PRICE); };

  // ───────── 試算 ─────────
  const bill = typeof monthlyBill === "number" ? monthlyBill : 0;
  const annualBill = bill * 12;
  const kwh = annualBill / (price || DEFAULT_PRICE);

  // 有効な設備グループ（系統数・冷媒が入力済み）
  const validGroups = groups.filter((g) => typeof g.systems === "number" && g.systems > 0 && g.refri !== "");
  const sysTotal = validGroups.reduce((a, g) => a + (g.systems as number), 0);

  // 削減率: 系統数×冷媒量(kg)で加重平均した冷媒別レート × 業種係数
  let weightSum = 0, weightedRate = 0;
  validGroups.forEach((g) => {
    const w = (g.systems as number) * KG_PRESETS[g.machineType].kg;
    weightSum += w;
    weightedRate += (RATE[g.refri]?.rate ?? 0.25) * w;
  });
  const baseRate = weightSum > 0 ? weightedRate / weightSum : 0.25;
  const factor = industry ? INDUSTRY[industry].factor : 1;
  const rate = Math.round(clamp(baseRate * factor) * 100) / 100;

  const saveYen = Math.round(annualBill * rate);
  const saveKwh = Math.round(kwh * rate);
  const co2 = Number((saveKwh * CO2).toFixed(1));

  // 費用: 全グループ合算（HCガス代金＋工事費用）
  const costAgg = validGroups.reduce(
    (acc, g) => {
      const p = KG_PRESETS[g.machineType];
      const e = estimateDropinCost(g.systems as number, p.kg, p.work);
      return { hcGas: acc.hcGas + e.hcGas, workTotal: acc.workTotal + e.workTotal, total: acc.total + e.total };
    },
    { hcGas: 0, workTotal: 0, total: 0 }
  );
  const investNoTax = costAgg.total;
  const invest = Math.round(investNoTax * 1.1); // 税込（お客様の実支払い目安）
  const paybackYears = saveYen > 0 ? Number((invest / saveYen).toFixed(1)) : null;
  const verdict = dropinRoiVerdict(paybackYears);
  const VERDICT_C: Record<string, string> = {
    good: "text-ehc-300 border-ehc-500/40 bg-ehc-500/10",
    ok: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    warn: "text-orange-300 border-orange-500/40 bg-orange-500/10",
    weak: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  };

  // 累積コスト推移（万円）
  const chart = [];
  let breakEven: { year: number; value: number } | null = null;
  for (let y = 0; y <= YEARS; y++) {
    const noAction = (annualBill * y * (1 + DEGRADE * y)) / 10000;          // 何もしない（劣化込み累積電気代）
    const dropin = (invest + annualBill * (1 - rate) * y) / 10000;          // 初期投資＋削減後の累積電気代
    chart.push({ year: `${y}年`, y, "何もしない": Math.round(noAction), "ドロップイン導入": Math.round(dropin) });
    if (!breakEven && y > 0 && dropin <= noAction) breakEven = { year: y, value: Math.round(dropin) };
  }
  const tenYearGain = Math.round(((annualBill * 10 * (1 + DEGRADE * 10)) - (invest + annualBill * (1 - rate) * 10)) / 10000);

  const refriSummary =
    validGroups.length <= 1
      ? (RATE[validGroups[0]?.refri]?.label ?? "—")
      : `設備${validGroups.length}種・計${sysTotal}系統`;

  return (
    <Card>
      <CardTitle icon={<Sparkles className="w-5 h-5" />}>ドロップイン かんたんROI診断（お客様向け）</CardTitle>
      <p className="text-xs text-slate-400 mb-4">
        質問に答えるだけ。<strong className="text-ehc-300">「このくらいの投資で、年いくら削減、何年で回収」</strong>を即お見せします。冷媒や機器の種類が違う設備は<strong className="text-ehc-300">複数グループ</strong>で入力できます。すべて概算（目安）です。
      </p>

      {/* ステッパー */}
      <div className="flex items-center gap-1.5 mb-5">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 flex-1">
            <div className={`flex items-center gap-1.5 ${i <= step ? "text-ehc-300" : "text-slate-500"}`}>
              <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold border ${
                i < step ? "bg-ehc-500/20 border-ehc-500/50" : i === step ? "bg-ehc-500/30 border-ehc-400 text-white" : "border-white/15"
              }`}>{i + 1}</span>
              <span className="text-[11px] font-medium hidden sm:inline">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-ehc-500/50" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      {/* ───────── 質問ステップ ───────── */}
      {step === 0 && (
        <StepWrap title="① どんな業種・使い方ですか？" hint="稼働時間が長いほど削減効果が大きくなります。">
          <Field label="業種（稼働プロファイル）">
            <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="" disabled>選択してください</option>
              {Object.entries(INDUSTRY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
        </StepWrap>
      )}

      {step === 1 && (
        <div className="min-h-[120px]">
          <div className="text-sm font-bold text-slate-100 mb-1">② 対象の設備を入力してください</div>
          <div className="text-[11px] text-slate-400 mb-3">
            冷媒・機器タイプ・台数が違う設備は「＋ 設備グループを追加」で分けて入力できます。室外機の銘板やメンテ記録に冷媒（ガス）の記載があります。わからなければ「わからない」でOK。
          </div>
          <div className="max-w-2xl space-y-3">
            {groups.map((g, i) => (
              <div key={g.id} className="border border-white/10 rounded-xl p-3 bg-night-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ehc-300">設備グループ {i + 1}</span>
                  {groups.length > 1 && (
                    <button onClick={() => removeGroup(g.id)}
                      className="text-rose-300 text-[11px] inline-flex items-center gap-1 hover:text-rose-200 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />削除
                    </button>
                  )}
                </div>
                <Field label="対象冷媒（ガス）">
                  <Select value={g.refri} onChange={(e) => updateGroup(g.id, { refri: e.target.value })}>
                    <option value="" disabled>選択してください</option>
                    {Object.entries(RATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="系統数（台）">
                    <Input type="number" inputMode="numeric" placeholder="例: 10"
                      value={g.systems}
                      onChange={(e) => updateGroup(g.id, { systems: e.target.value === "" ? "" : Number(e.target.value) })} />
                  </Field>
                  <Field label="機器タイプ（不明なら中型でOK）">
                    <Select value={g.machineType} onChange={(e) => updateGroup(g.id, { machineType: e.target.value })}>
                      {Object.entries(KG_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
            <button onClick={addGroup}
              className="w-full border border-dashed border-ehc-500/40 text-ehc-300 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-ehc-500/10 transition-colors">
              <Plus className="w-4 h-4" />設備グループを追加
            </button>
            {sysTotal > 0 && (
              <p className="text-[11px] text-slate-400">→ 合計 {groups.length}グループ・{sysTotal}系統</p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <StepWrap title="③ 対象の空調にかかる月の電気代は？" hint="対象設備 全体にかかる1ヶ月の電気代の概算（円）。請求書のおおよそでOK。">
          <Field label="月の電気代（円・対象設備の合計）">
            <Input type="number" inputMode="numeric" placeholder="例: 120000"
              value={monthlyBill} onChange={(e) => setMonthlyBill(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <div className="mt-3 max-w-[220px]">
            <Field label="電力単価(円/kWh・変更可)">
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              <p className="text-[9px] text-slate-500 mt-1 leading-tight">※基本料金＋従量で変動。大手電力HPの従量単価が目安</p>
            </Field>
          </div>
          {typeof monthlyBill === "number" && monthlyBill > 0 && (
            <p className="text-[11px] text-slate-400 mt-2">→ 年間 約{yenJP(monthlyBill * 12)}（電力 約{Math.round((monthlyBill * 12) / (price || DEFAULT_PRICE)).toLocaleString("ja-JP")}kWh 相当）</p>
          )}
        </StepWrap>
      )}

      {/* ───────── 提案サマリー ───────── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* ヘッドライン提案 */}
          <div className="bg-gradient-to-br from-ehc-700 via-cobalt-600 to-emerald-500 text-white rounded-2xl p-5 shadow-lift">
            <div className="text-xs text-emerald-50 mb-1">この条件なら、こちらのご提案は——</div>
            <div className="text-lg md:text-xl font-bold leading-snug">
              概算<span className="text-2xl md:text-3xl mx-1 text-white">{Math.round(invest / 10000).toLocaleString("ja-JP")}</span>万円で導入、
              年間<span className="text-2xl md:text-3xl mx-1 text-emerald-100">{Math.round(saveYen / 10000).toLocaleString("ja-JP")}</span>万円削減、
              {paybackYears != null ? <>約<span className="text-2xl md:text-3xl mx-1 text-amber-200">{paybackYears}</span>年で回収できます。</> : "回収試算には電気代の入力が必要です。"}
            </div>
            <div className="text-[11px] text-emerald-50/90 mt-2">
              想定削減率 {Math.round(rate * 100)}%（{INDUSTRY[industry]?.label ?? "—"} × {refriSummary}）／ 機器はそのまま・冷媒だけ交換
            </div>
          </div>

          {/* 設備グループ内訳 */}
          {validGroups.length > 1 && (
            <div className="bg-night-900/60 border border-white/10 rounded-xl p-3">
              <div className="text-[11px] text-slate-300 mb-2 font-semibold">対象設備の内訳（{validGroups.length}グループ・計{sysTotal}系統）</div>
              <div className="space-y-1">
                {validGroups.map((g, i) => (
                  <div key={g.id} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="text-ehc-300 font-semibold">#{i + 1}</span>
                    {RATE[g.refri]?.label} × {g.systems}系統（{KG_PRESETS[g.machineType].label}）
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4指標 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric color="ehc" icon={<Wallet className="w-4 h-4" />} label="概算投資（税込）" value={`${yenJP(invest)}`} sub={`税抜 ${yenJP(investNoTax)}＝ガス${yenJP(costAgg.hcGas)}＋工事${yenJP(costAgg.workTotal)}`} />
            <Metric color="amber" icon={<TrendingDown className="w-4 h-4" />} label="年間 電気代削減" value={`${yenJP(saveYen)}`} sub={`約${saveKwh.toLocaleString("ja-JP")}kWh/年`} />
            <Metric color="violet" icon={<CalendarClock className="w-4 h-4" />} label="投資回収（税込）" value={paybackYears != null ? `${paybackYears}年` : "—"} sub={`10年で約${tenYearGain.toLocaleString("ja-JP")}万円お得`} />
            <Metric color="sky" icon={<Leaf className="w-4 h-4" />} label="CO₂削減" value={`${co2} t/年`} sub="脱炭素経営に貢献" />
          </div>

          {verdict && (
            <div className={`border rounded-xl px-3 py-2 text-xs flex items-center gap-2 flex-wrap ${VERDICT_C[verdict.tone]}`}>
              <span className="font-bold">{verdict.label}</span>
              <span className="text-slate-300">{verdict.advice}</span>
              {(verdict.tone === "warn" || verdict.tone === "weak") && switchTab && (
                <button onClick={() => switchTab("match")}
                  className="underline font-semibold inline-flex items-center gap-0.5 hover:opacity-80">
                  補助金マッチングで診断<ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* 累積ROIグラフ */}
          <div className="bg-night-900/60 border border-white/10 rounded-xl p-3">
            <div className="text-[11px] text-slate-300 mb-2">累積コスト比較（{YEARS}年・万円）— 線が交わる年が「元が取れる」タイミング</div>
            <div className="w-full h-64 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}万`} width={48} />
                  <Tooltip
                    formatter={(v: number) => `¥${(v * 10000).toLocaleString("ja-JP")}`}
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Line type="monotone" dataKey="何もしない" stroke="#f87171" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="ドロップイン導入" stroke="#34d399" strokeWidth={3} dot={false} />
                  {breakEven && <ReferenceDot x={`${breakEven.year}年`} y={breakEven.value} r={5} fill="#fbbf24" stroke="#fff" strokeWidth={1.5} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {breakEven && (
              <div className="text-[11px] text-amber-300 mt-1">★ 約{breakEven.year}年目で「何もしない」より割安に。以降の差額はすべてプラスです。</div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            ※ 概算（目安）です。投資額＝HCガス代金＋工事費用（電力単価¥{price}/kWh・想定削減率・PN見積の系統単価をもとに設備グループごとに自動試算し合算）。実際の効果・費用は機種・稼働・現地条件で±20%程度変動します。正式なお見積りは現地確認のうえご提示します。
          </p>

          <div className="flex flex-wrap gap-2">
            <a href={`mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent("【ドロップイン】ROI診断の正式見積り希望")}&body=${encodeURIComponent([
                "ROI診断の条件で正式見積りを希望します。",
                "",
                `業種（稼働）: ${INDUSTRY[industry]?.label ?? "—"}`,
                "対象設備:",
                ...validGroups.map((g, i) => `  ${i + 1}. ${RATE[g.refri]?.label ?? "—"} × ${g.systems}系統（${KG_PRESETS[g.machineType].label}）`),
                `合計系統数: ${sysTotal}系統`,
                `月の電気代: ${yenJP(bill)}（単価 ¥${price}/kWh）`,
                `概算投資: ${yenJP(invest)}（税込）`,
                `年間削減: ${yenJP(saveYen)} ／ 投資回収: ${paybackYears != null ? `約${paybackYears}年` : "—"}`,
              ].join("\n"))}`}
              className="bg-ehc-500/15 text-ehc-300 border border-ehc-500/40 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-ehc-500/25 transition-colors no-print">
              <Mail className="w-4 h-4" />この内容で正式見積りを依頼<ArrowRight className="w-4 h-4" />
            </a>
            <button onClick={reset} className="text-slate-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:text-slate-200 transition-colors no-print">
              <RotateCcw className="w-4 h-4" />最初からやり直す
            </button>
          </div>
        </div>
      )}

      {/* ───────── ナビゲーション ───────── */}
      {step < 3 && (
        <div className="flex items-center justify-between mt-5">
          <button onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))} disabled={step === 0}
            className="text-slate-400 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-30 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />戻る
          </button>
          <button onClick={() => canNext && setStep((s) => ((s + 1) as Step))} disabled={!canNext}
            className="bg-ehc-500 text-night-900 px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ehc-400 transition-colors">
            {step === 2 ? "結果を見る" : "次へ"}<ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </Card>
  );
}

function StepWrap({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[120px]">
      <div className="text-sm font-bold text-slate-100 mb-1">{title}</div>
      <div className="text-[11px] text-slate-400 mb-3">{hint}</div>
      <div className="max-w-md">{children}</div>
    </div>
  );
}

function Metric({ color, icon, label, value, sub }: { color: string; icon: React.ReactNode; label: string; value: string; sub: string }) {
  const C: Record<string, string> = {
    ehc: "from-ehc-500/10 border-ehc-500/30 text-ehc-300",
    amber: "from-amber-500/10 border-amber-500/30 text-amber-300",
    violet: "from-violet-500/10 border-violet-500/30 text-violet-300",
    sky: "from-sky-500/10 border-sky-500/30 text-sky-300",
  };
  return (
    <div className={`bg-gradient-to-br to-night-900 border rounded-xl p-3 ${C[color]}`}>
      <div className="flex items-center gap-1.5 text-[11px] mb-1">{icon}{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
