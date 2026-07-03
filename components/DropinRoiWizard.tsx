"use client";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceDot,
} from "recharts";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import {
  Sparkles, ArrowRight, ArrowLeft, RotateCcw, TrendingDown, Wallet, Leaf, CalendarClock, Mail,
} from "lucide-react";
import { estimateDropinCost, dropinRoiVerdict, DROPIN, yenJP } from "@/lib/pricing";

const PRICE = 27;          // 円/kWh
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
const clamp = (v: number, lo = 0.1, hi = 0.45) => Math.min(hi, Math.max(lo, v));

type Step = 0 | 1 | 2 | 3 | 4;
const STEP_LABELS = ["業種", "冷媒", "電気代", "規模", "ご提案"];

export function DropinRoiWizard() {
  const [step, setStep] = useState<Step>(0);
  const [industry, setIndustry] = useState("");
  const [refri, setRefri] = useState("");
  const [monthlyBill, setMonthlyBill] = useState<number | "">("");  // 対象設備の月の電気代(円)
  const [systems, setSystems] = useState<number | "">("");          // 系統数(台)

  const canNext =
    (step === 0 && industry !== "") ||
    (step === 1 && refri !== "") ||
    (step === 2 && typeof monthlyBill === "number" && monthlyBill > 0) ||
    (step === 3 && typeof systems === "number" && systems > 0);

  const reset = () => { setStep(0); setIndustry(""); setRefri(""); setMonthlyBill(""); setSystems(""); };

  // ───────── 試算 ─────────
  const bill = typeof monthlyBill === "number" ? monthlyBill : 0;
  const sysN = typeof systems === "number" ? systems : 0;
  const annualBill = bill * 12;
  const kwh = annualBill / PRICE;
  const rate =
    industry && refri
      ? Math.round(clamp(RATE[refri].rate * INDUSTRY[industry].factor) * 100) / 100
      : 0.25;
  const saveYen = Math.round(annualBill * rate);
  const saveKwh = Math.round(kwh * rate);
  const co2 = Number((saveKwh * CO2).toFixed(1));

  const est = estimateDropinCost(sysN, DROPIN.defaultKgPerSystem);
  const investNoTax = est.total;
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

  return (
    <Card>
      <CardTitle icon={<Sparkles className="w-5 h-5" />}>ドロップイン かんたんROI診断（お客様向け）</CardTitle>
      <p className="text-xs text-slate-400 mb-4">
        4つの質問に答えるだけ。<strong className="text-ehc-300">「このくらいの投資で、年いくら削減、何年で回収」</strong>を即お見せします。すべて概算（目安）です。
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
        <StepWrap title="② いまの冷媒（ガス）は？" hint="室外機の銘板やメンテ記録に記載。わからなければ「わからない」でOK。">
          <Field label="対象冷媒">
            <Select value={refri} onChange={(e) => setRefri(e.target.value)}>
              <option value="" disabled>選択してください</option>
              {Object.entries(RATE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
        </StepWrap>
      )}

      {step === 2 && (
        <StepWrap title="③ 対象の空調にかかる月の電気代は？" hint="空調設備にかかる1ヶ月の電気代の概算（円）。請求書のおおよそでOK。">
          <Field label="月の電気代（円）">
            <Input type="number" inputMode="numeric" placeholder="例: 120000"
              value={monthlyBill} onChange={(e) => setMonthlyBill(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          {typeof monthlyBill === "number" && monthlyBill > 0 && (
            <p className="text-[11px] text-slate-400 mt-2">→ 年間 約{yenJP(monthlyBill * 12)}（電力 約{Math.round((monthlyBill * 12) / PRICE).toLocaleString("ja-JP")}kWh 相当）</p>
          )}
        </StepWrap>
      )}

      {step === 3 && (
        <StepWrap title="④ 対象の台数（系統数）は？" hint="ドロップイン対象の室外機（系統）のおおよその台数。ガス代金・工事費用の概算に使います。">
          <Field label="系統数（台）">
            <Input type="number" inputMode="numeric" placeholder="例: 10"
              value={systems} onChange={(e) => setSystems(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
        </StepWrap>
      )}

      {/* ───────── 提案サマリー ───────── */}
      {step === 4 && (
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
              想定削減率 {Math.round(rate * 100)}%（{INDUSTRY[industry]?.label ?? "—"} × {RATE[refri]?.label ?? "—"}）／ 機器はそのまま・冷媒だけ交換
            </div>
          </div>

          {/* 4指標 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric color="ehc" icon={<Wallet className="w-4 h-4" />} label="概算投資（税込）" value={`${yenJP(invest)}`} sub={`税抜 ${yenJP(investNoTax)}＝ガス${yenJP(est.hcGas)}＋工事${yenJP(est.workTotal)}`} />
            <Metric color="amber" icon={<TrendingDown className="w-4 h-4" />} label="年間 電気代削減" value={`${yenJP(saveYen)}`} sub={`約${saveKwh.toLocaleString("ja-JP")}kWh/年`} />
            <Metric color="violet" icon={<CalendarClock className="w-4 h-4" />} label="投資回収（税込）" value={paybackYears != null ? `${paybackYears}年` : "—"} sub={`10年で約${tenYearGain.toLocaleString("ja-JP")}万円お得`} />
            <Metric color="sky" icon={<Leaf className="w-4 h-4" />} label="CO₂削減" value={`${co2} t/年`} sub="脱炭素経営に貢献" />
          </div>

          {verdict && (
            <div className={`border rounded-xl px-3 py-2 text-xs flex items-center gap-2 flex-wrap ${VERDICT_C[verdict.tone]}`}>
              <span className="font-bold">{verdict.label}</span>
              <span className="text-slate-300">{verdict.advice}</span>
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
            ※ 概算（目安）です。投資額＝HCガス代金＋工事費用（電力単価¥{PRICE}/kWh・想定削減率・PN見積の系統単価をもとに自動試算）。実際の効果・費用は機種・稼働・現地条件で変動します。正式なお見積りは現地確認のうえご提示します。
          </p>

          <div className="flex flex-wrap gap-2">
            <a href="mailto:info@ehcjpn.com?subject=【ドロップイン】ROI診断の正式見積り希望"
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
      {step < 4 && (
        <div className="flex items-center justify-between mt-5">
          <button onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))} disabled={step === 0}
            className="text-slate-400 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-30 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />戻る
          </button>
          <button onClick={() => canNext && setStep((s) => ((s + 1) as Step))} disabled={!canNext}
            className="bg-ehc-500 text-night-900 px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ehc-400 transition-colors">
            {step === 3 ? "結果を見る" : "次へ"}<ArrowRight className="w-4 h-4" />
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
