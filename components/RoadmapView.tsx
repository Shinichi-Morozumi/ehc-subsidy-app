"use client";
import { Card, CardTitle } from "./ui/Card";
import { MatchInput } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { buildSubsidyTimeline, buildConstructionTimeline, buildMultiYearRoadmap, DatedStep } from "@/lib/timeline";
import { CalendarClock, Wrench, Map, AlertTriangle, Banknote, Leaf, Receipt } from "lucide-react";
import { estimateUpdateCost, estimateMachineCost, PRICING_SOURCE } from "@/lib/pricing";

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

function Stepper({ steps }: { steps: { label: string; month: number; note?: string; star?: boolean }[] }) {
  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/15" />
      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="relative">
            <span
              className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 ${
                s.star ? "bg-amber-400 border-amber-300" : "bg-ehc-400 border-ehc-300"
              }`}
            />
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400 tabular-nums w-12">+{s.month}か月</span>
              <span className={`text-sm font-semibold ${s.star ? "text-amber-300" : "text-slate-100"}`}>{s.label}</span>
            </div>
            {s.note && <p className="text-[11px] text-slate-400 ml-14 mt-0.5">{s.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DatedStepper({ steps }: { steps: DatedStep[] }) {
  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/15" />
      <div className="space-y-3">
        {steps.map((s, i) => {
          const dot =
            s.status === "done"
              ? "bg-ehc-400 border-ehc-300"
              : s.status === "current"
              ? "bg-amber-400 border-amber-300 ring-2 ring-amber-400/40"
              : "bg-night-900 border-white/30";
          return (
            <div key={i} className="relative">
              <span className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 ${dot}`} />
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] text-slate-400 tabular-nums w-20">{s.dateLabel}</span>
                <span className={`text-sm font-semibold ${s.status === "done" ? "text-slate-400 line-through decoration-slate-600" : s.status === "current" ? "text-amber-300" : "text-slate-100"}`}>{s.label}</span>
                {s.status === "current" && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">← 現在地</span>}
                {s.status === "done" && <span className="text-[10px] text-ehc-400">✓ 完了</span>}
                {s.star && s.status !== "done" && <span className="text-[10px] text-amber-300">★重要</span>}
              </div>
              {s.note && <span className="block text-[11px] text-slate-400 mt-0.5">{s.note}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RoadmapView({ input, result, compact = false }: { input: MatchInput; result: MatchResult; compact?: boolean }) {
  const today = new Date();
  const candidates = result.matched.filter((s) => !s.infoOnly);
  const openOnes = candidates
    .filter((s) => s.applyClose && new Date(s.applyClose + "T00:00:00") >= today)
    .sort((a, b) => new Date(a.applyClose!).getTime() - new Date(b.applyClose!).getTime());
  const bestSubsidy = openOnes[0] || candidates[0];
  const subsidyTL = buildSubsidyTimeline(bestSubsidy, today);
  const constructionTL = buildConstructionTimeline();
  const roadmap = buildMultiYearRoadmap(input, 3);

  // 実勢工事費レンジ（PN見積基準）：設備群の台数×馬力から機器費+工事費を積算
  const costStd = input.equipGroups.reduce(
    (a, g) => {
      const e = estimateUpdateCost({ units: g.units, hp: g.hp ?? 0, grade: "standard" });
      return { machine: a.machine + e.machine, work: a.work + e.work, total: a.total + e.total };
    },
    { machine: 0, work: 0, total: 0 }
  );
  const costSub = input.equipGroups.reduce((a, g) => a + estimateUpdateCost({ units: g.units, hp: g.hp ?? 0, grade: "subsidy" }).total, 0);
  const totalUnits = input.equipGroups.reduce((a, g) => a + g.units, 0);
  const investYen = (input.invest || 0) * 10000;
  const inRange = investYen > 0 && investYen >= costStd.total * 0.7 && investYen <= costSub * 1.3;

  const RoadmapYears = (
    <Card>
      <CardTitle icon={<Map className="w-5 h-5" />}>翌年以降の段階更新プラン</CardTitle>
      <p className="text-xs text-slate-400 mb-3">
        古い設備・R22群から優先し、年次に分けて更新。各年をその年度の補助金に紐付け、毎年「更新→翌年さらに提案」のサイクルを回します。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {roadmap.map((r) => (
          <div key={r.year} className="border border-ehc-500/30 bg-gradient-to-br from-ehc-500/10 to-night-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-ehc-300">{r.phaseLabel}</span>
              <span className="text-[10px] bg-night-900 border border-white/10 px-2 py-0.5 rounded-md text-slate-300">{r.year}年</span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-0.5 mb-2">
              {r.groupLabels.map((g, i) => (
                <div key={i}>・{g}</div>
              ))}
            </div>
            <div className="text-[11px] space-y-1 border-t border-white/10 pt-2">
              <div className="flex justify-between"><span className="text-slate-400">想定補助金</span><span className="text-slate-200">{r.subsidyName.length > 16 ? r.subsidyName.slice(0, 16) + "…" : r.subsidyName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">年間削減(計)</span><span className="text-ehc-300 font-semibold">{yen(r.saveYenPerYear)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">CO₂削減(計)</span><span className="text-slate-200">{r.co2ReductionTon} t/年</span></div>
              <div className="flex justify-between"><span className="text-slate-400">投資(計)</span><span className="text-slate-200">¥{(r.investManYen * 10000).toLocaleString("ja-JP")}</span></div>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="text-[10px] text-slate-400 mb-1.5">カテゴリ別 投資・ROI・損益分岐</div>
              <div className="space-y-1.5">
                {r.categories.map((c, ci) => (
                  <div key={ci} className="bg-night-900/60 border border-white/5 rounded-lg px-2 py-1.5">
                    <div className="text-[11px] font-semibold text-slate-200 mb-1">{c.label}</div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <div><div className="text-slate-500">投資</div><div className="text-slate-200">¥{(c.investManYen * 10000).toLocaleString("ja-JP")}</div></div>
                      <div><div className="text-slate-500">年間削減</div><div className="text-ehc-300">{yen(c.saveYenPerYear)}</div></div>
                      <div><div className="text-slate-500">損益分岐/ROI</div><div className="text-amber-300 font-semibold">{c.paybackYears != null ? `${c.paybackYears}年` : "—"}<span className="text-slate-400 font-normal"> ・利回り{c.roiPct}%</span></div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-[11px] text-amber-200 flex gap-2">
        <Leaf className="w-4 h-4 flex-shrink-0 mt-0.5" />
        まず今期にドロップイン（即効・低コスト）で電気代を下げ、翌年以降に補助金を活用した本更新へ——という二段構えも提案可能です。
      </div>
    </Card>
  );

  const CostRef = (
    <Card>
      <CardTitle icon={<Receipt className="w-5 h-5" />}>更新工事の実勢費用レンジ（{PRICING_SOURCE}）</CardTitle>
      <p className="text-xs text-slate-400 mb-3">
        入力された設備（{totalUnits}台）を全更新した場合の機器費＋工事費の目安。機種グレード・高所/搬入条件・配管長で変動するため<strong className="text-slate-200">参考値</strong>です。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-white/10 bg-night-900 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 mb-1">標準グレード機（補助金なし想定）</div>
          <div className="text-xl font-bold text-slate-100">{yen(costStd.total)}</div>
          <div className="text-[10px] text-slate-500 mt-1">機器 {yen(costStd.machine)} ／ 工事 {yen(costStd.work)}</div>
        </div>
        <div className="border border-ehc-500/30 bg-gradient-to-br from-ehc-500/10 to-night-900 rounded-xl p-3">
          <div className="text-[11px] text-ehc-300 mb-1">高効率(補助金グレード)機</div>
          <div className="text-xl font-bold text-ehc-300">{yen(costSub)}</div>
          <div className="text-[10px] text-slate-500 mt-1">上位機は機器費が約4〜5割高。補助金で差額を相殺する設計に。</div>
        </div>
        <div className="border border-white/10 bg-night-900 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 mb-1">入力した投資額との照合</div>
          <div className={`text-xl font-bold ${input.invest ? (inRange ? "text-ehc-300" : "text-amber-300") : "text-slate-500"}`}>
            {input.invest ? yen(investYen) : "未入力"}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {input.invest ? (inRange ? "実勢レンジ内。妥当な水準です。" : "実勢レンジ外。機種グレード・台数・条件を要確認。") : "投資額を入力すると実勢レンジと自動照合します。"}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-400">
        <div className="bg-night-900/60 rounded-lg px-2 py-1.5">機器費目安 4HP: 標準{yen(estimateMachineCost(4,"standard"))} / 上位{yen(estimateMachineCost(4,"subsidy"))}</div>
        <div className="bg-night-900/60 rounded-lg px-2 py-1.5">機器費目安 6HP: 標準{yen(estimateMachineCost(6,"standard"))} / 上位{yen(estimateMachineCost(6,"subsidy"))}</div>
        <div className="bg-night-900/60 rounded-lg px-2 py-1.5">撤去+据付: 約¥113,000/台</div>
        <div className="bg-night-900/60 rounded-lg px-2 py-1.5">フロン回収¥20,000/系統・破壊¥1,800/kg</div>
      </div>
    </Card>
  );

  if (compact) {
    return (
      <Card>
        <CardTitle icon={<Map className="w-5 h-5" />}>導入ロードマップ（要約）</CardTitle>
        <p className="text-xs text-slate-400 mb-3">「導入ロードマップ」タブで、申請〜入金／工事のタイムラインと年次プランの詳細を表示します。</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {roadmap.map((r) => (
            <div key={r.year} className="border border-white/10 bg-night-900 rounded-lg p-3 text-[11px]">
              <div className="font-bold text-ehc-300 mb-1">{r.phaseLabel} / {r.year}</div>
              <div className="text-slate-300">{r.units}台更新 ・ 年{yen(r.saveYenPerYear)}削減</div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardTitle icon={<CalendarClock className="w-5 h-5" />}>補助金タイムライン（申請〜入金）</CardTitle>
          {bestSubsidy && <p className="text-xs text-ehc-300 mb-2">対象例: {bestSubsidy.name}（{bestSubsidy.period}）</p>}
          <div className={`mb-3 text-xs font-semibold ${subsidyTL.estimated ? "text-slate-300" : "text-cobalt-200"}`}>{subsidyTL.headline}</div>
          <DatedStepper steps={subsidyTL.steps} />
          {subsidyTL.estimated && <p className="mt-2 text-[10px] text-slate-500">※ 日程は次回公募基準の概算です。公募回確定後は実日付で自動表示されます。</p>}
          <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-[11px] text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {subsidyTL.caution}
          </div>
        </Card>
        <Card>
          <CardTitle icon={<Wrench className="w-5 h-5" />}>工事タイムライン（EHC施工）</CardTitle>
          <Stepper steps={constructionTL} />
          <div className="mt-3 bg-ehc-500/10 border border-ehc-500/30 rounded-lg p-3 text-[11px] text-ehc-200 flex gap-2">
            <Banknote className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ビフォー/アフターのENIMAS実測で削減実績を数値化し、次年度提案のエビデンスにします。
          </div>
        </Card>
      </div>
      {CostRef}
      {RoadmapYears}
    </div>
  );
}
