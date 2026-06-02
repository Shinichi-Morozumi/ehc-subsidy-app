"use client";

import { useState } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input, Button } from "./ui/Field";
import { MatchInput, BizType, SizeType, EquipType, RefriType } from "@/lib/types";
import { matchSubsidies, MatchResult } from "@/lib/match";
import { ReportTeaser } from "./ReportTeaser";
import { CustomerReport } from "./CustomerReport";
import { SampleCases } from "./SampleCases";
import { SampleCase } from "@/lib/samples";
import { Sparkles, BarChart3, Target, Lightbulb, Building2, User, AlertTriangle, CheckCircle2, LineChart as LineChartIcon, PieChart } from "lucide-react";
import { RoiChart } from "./RoiChart";
import { INDUSTRY_PROFILES } from "@/lib/industries";

const PREFS = ["東京都", "神奈川県", "大阪府", "埼玉県", "千葉県", "愛知県", "北海道", "福岡県", "その他"];

const HELP = {
  customerCompany: "提案書のヘッダーに表示されるお客様の会社名（例: 株式会社○○）",
  customerContact: "提案書ヘッダーに表示されるご担当者様のお名前（任意）",
  ehcStaff: "提案書のフッターに表示されるEHC担当者名（桝口、伊藤など）",
  bizType: "EHCソリューションズは業務用（法人・事業主）専用です。個人・家庭用の空調は対象外となります。",
  size: "中小企業 = 資本金3億円以下 もしくは 従業員300人以下。多くの補助金で中小企業が優遇されます。",
  pref: "都道府県別補助金（神奈川県・大阪府・東京都等）の適用判定に使用します。",
  building: "補助金の対象用途を判定。オフィス、店舗、飲食店、ホテル、医療施設など。",
  equip: "パッケージエアコン＝屋内機1台＋屋外機1台のセット。マルチエアコン＝1台の屋外機で複数室を冷暖房するビル用システム。",
  years: "業務用空調の法定耐用年数は15年。10年を超えると効率が20〜40%低下し、補助金活用の絶好のタイミングです。",
  refri: "R22は既に製造禁止（修理部品入手困難）。R410Aは2025年で製造規制完了（修理コスト2-3倍）。R32が現行最有力。",
  kwh: "直近1年間の電力会社請求書の合計kWh。複数事業所がある場合は、空調を更新する事業所分のみで結構です。",
  invest: "新空調機器の本体価格＋設置工事費の合計見積額。参考：業務用パッケージ50〜150万円/台、ビル用マルチ500〜3,000万円。",
  co2: "年間電力削減量(kWh) × 0.000434 で概算可能。神奈川県補助金は3t/年以上が必須条件です。",
};

export function SubsidyMatcher() {
  const [input, setInput] = useState<MatchInput>({
    bizType: "business",
    size: "sme",
    pref: "東京都",
    building: "office",
    equip: "ac",
    years: 15,
    refri: "r410a",
    kwh: 80000,
    invest: 500,
    co2: 5,
    customerCompany: "",
    customerContact: "",
    ehcStaff: "",
  });
  const [result, setResult] = useState<MatchResult | null>(null);

  const set = <K extends keyof MatchInput>(key: K, val: MatchInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: val }));

  const applySample = (sample: SampleCase) => {
    setInput((prev) => ({ ...prev, ...sample.data }));
    setResult(null);
  };

  const run = () => {
    if (input.bizType === "personal") {
      alert("EHCは業務用専門です。法人・事業者としてご検討ください。");
      return;
    }
    setResult(matchSubsidies(input));
    setTimeout(() => {
      document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-5">
      <ReportTeaser />

      <SampleCases onPick={applySample} />

      <Card>
        <CardTitle icon={<User className="w-5 h-5" />}>お客様情報（提案書ヘッダー用）</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="お客様会社名" help={HELP.customerCompany}>
            <Input
              value={input.customerCompany}
              onChange={(e) => set("customerCompany", e.target.value)}
              placeholder="例: 株式会社○○"
            />
          </Field>
          <Field label="ご担当者名" help={HELP.customerContact}>
            <Input
              value={input.customerContact}
              onChange={(e) => set("customerContact", e.target.value)}
              placeholder="例: 田中"
            />
          </Field>
          <Field label="EHC担当" help={HELP.ehcStaff}>
            <Input
              value={input.ehcStaff}
              onChange={(e) => set("ehcStaff", e.target.value)}
              placeholder="例: 桝口"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Building2 className="w-5 h-5" />}>案件情報入力</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="事業者区分" help={HELP.bizType}>
            <Select value={input.bizType} onChange={(e) => set("bizType", e.target.value as BizType)}>
              <option value="business">法人・事業主（業務用）</option>
              <option value="personal">個人・家庭用</option>
            </Select>
          </Field>
          <Field label="企業規模" help={HELP.size}>
            <Select value={input.size} onChange={(e) => set("size", e.target.value as SizeType)}>
              <option value="sme">中小企業（資本3億円以下 or 従業員300人以下）</option>
              <option value="middle">中堅企業</option>
              <option value="large">大企業</option>
            </Select>
          </Field>
          <Field label="所在地（都道府県）" help={HELP.pref}>
            <Select value={input.pref} onChange={(e) => set("pref", e.target.value)}>
              {PREFS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="建物用途" help={HELP.building}>
            <Select value={input.building} onChange={(e) => set("building", e.target.value)}>
              <option value="office">オフィス・事務所</option>
              <option value="retail">小売店舗</option>
              <option value="restaurant">飲食店</option>
              <option value="hotel">ホテル・宿泊</option>
              <option value="medical">医療・福祉</option>
              <option value="school">学校・教育</option>
              <option value="other">その他事業所</option>
            </Select>
          </Field>
          <Field label="既存設備" help={HELP.equip}>
            <Select value={input.equip} onChange={(e) => set("equip", e.target.value as EquipType)}>
              <option value="ac">業務用エアコン（パッケージ）</option>
              <option value="multi">マルチエアコン（ビル用）</option>
            </Select>
          </Field>
          <Field label="設置からの年数" help={HELP.years}>
            <Select value={input.years} onChange={(e) => set("years", Number(e.target.value))}>
              <option value={5}>5年未満</option>
              <option value={10}>5〜10年</option>
              <option value={15}>10〜15年（更新推奨ゾーン）</option>
              <option value={20}>15〜20年（要更新）</option>
              <option value={25}>20年以上（緊急更新）</option>
            </Select>
          </Field>
          <Field label="現在の冷媒" help={HELP.refri}>
            <Select value={input.refri} onChange={(e) => set("refri", e.target.value as RefriType)}>
              <option value="r22">R22（HCFC・既に製造禁止）</option>
              <option value="r410a">R410A（HFC・段階的廃止中）</option>
              <option value="r32">R32（現行HFC・GWP675）</option>
              <option value="unknown">不明</option>
            </Select>
          </Field>
          <Field label="年間電力使用量 (kWh)" help={HELP.kwh}>
            <Input type="number" value={input.kwh} onChange={(e) => set("kwh", Number(e.target.value))} />
          </Field>
          <Field label="設備投資概算 (万円)" help={HELP.invest}>
            <Input type="number" value={input.invest} onChange={(e) => set("invest", Number(e.target.value))} />
          </Field>
          <Field label="CO2削減量 (t/年・想定)" help={HELP.co2}>
            <Input type="number" value={input.co2} onChange={(e) => set("co2", Number(e.target.value))} />
          </Field>
        </div>
        {input.bizType === "personal" && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-xl text-sm mt-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              EHCソリューションズは <strong>業務用専用</strong> です。個人・家庭用空調は対象外となります。
            </div>
          </div>
        )}
        <Button onClick={run} className="mt-5">
          <Sparkles className="w-5 h-5" />
          即答（マッチング & 提案書生成）
        </Button>
      </Card>

      {result && (
        <div id="result-section" className="space-y-5">
          <ResultView result={result} input={input} />
          <CustomerReport input={input} result={result} />
        </div>
      )}
    </div>
  );
}

function ResultView({ result, input }: { result: MatchResult; input: MatchInput }) {
  return (
    <div className="space-y-5 no-print">
      <Card>
        <CardTitle icon={<BarChart3 className="w-5 h-5" />}>ROI シミュレーション</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RoiBox label="想定補助金" value={`¥${(result.bestSubsidyManYen * 10000).toLocaleString("ja-JP")}`} accent="green" />
          <RoiBox label="投資回収期間" value={result.yearsToRecover !== null ? `${result.yearsToRecover} 年` : "計算不能"} accent="amber" />
          <RoiBox label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} accent="blue" />
          <RoiBox label="15年間累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} accent="purple" />
        </div>
        <IndustryBasis building={input.building} reductionRate={result.industryReductionRate} />
      </Card>

      <Card>
        <CardTitle icon={<LineChartIcon className="w-5 h-5" />}>15年累計コスト 比較</CardTitle>
        <RoiChart
          invest={input.invest}
          bestSubsidyManYen={result.bestSubsidyManYen}
          saveYenPerYear={result.saveYenPerYear}
          kwhPerYear={input.kwh}
          reductionRate={result.industryReductionRate}
        />
        <div className="text-[11px] text-slate-400 grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1.5">
            <strong className="text-red-300">赤線:</strong> 何もしない（旧機器維持）
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
            <strong className="text-amber-300">橙線:</strong> 更新（補助金なし）
          </div>
          <div className="bg-ehc-500/10 border border-ehc-500/30 rounded-md px-2 py-1.5">
            <strong className="text-ehc-300">緑線:</strong> 更新（補助金あり）← ベスト
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Target className="w-5 h-5" />}>適用可能な補助金</CardTitle>
        {result.matched.length ? (
          <div className="space-y-3">
            {result.matched.map((s) => (
              <div key={s.id} className="border border-ehc-500/30 bg-gradient-to-br from-ehc-500/10 to-night-900 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-ehc-300">
                  <CheckCircle2 className="w-4 h-4 text-ehc-400 flex-shrink-0" />
                  {s.name}
                </h3>
                <div className="text-xs text-slate-400 mb-2.5 flex flex-wrap gap-1.5">
                  <span className="bg-ehc-500/15 text-ehc-300 px-2 py-0.5 rounded-md font-medium">適用可能</span>
                  <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">期間: {s.period}</span>
                  <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">補助率: {s.rate}</span>
                  <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">上限: {s.max}</span>
                </div>
                <div className="text-xs text-slate-300">
                  <p><strong className="text-white">要件:</strong> {s.requirement}</p>
                  <p className="mt-1"><strong className="text-white">必要書類:</strong> {s.docs}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">条件に合致する補助金が見つかりません。条件を変更してください。</p>
        )}
      </Card>

      <Card>
        <CardTitle icon={<Lightbulb className="w-5 h-5" />}>今やるべき5つの理由</CardTitle>
        <ul className="space-y-2.5">
          {result.reasons.map((r, i) => (
            <li key={i} className="bg-gradient-to-r from-amber-500/10 to-night-900 border border-amber-500/20 px-4 py-3 rounded-xl text-sm text-slate-100 flex items-start gap-3">
              <span className="bg-amber-500/20 text-amber-300 font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
                {i + 1}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const ACCENT_COLORS = {
  green: "from-ehc-500/10 to-ehc-500/10 text-ehc-300",
  amber: "from-amber-500/10 to-amber-500/10 text-amber-300",
  blue: "from-sky-500/10 to-sky-500/10 text-sky-300",
  purple: "from-violet-500/10 to-violet-500/10 text-violet-300",
};

function RoiBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "green" | "amber" | "blue" | "purple";
}) {
  return (
    <div className={`bg-gradient-to-br ${ACCENT_COLORS[accent]} p-4 rounded-xl shadow-soft`}>
      <div className="text-[11px] text-slate-400 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

// 業種別の電力消費内訳と想定削減率の根拠（出典: 資源エネルギー庁）を表示
function IndustryBasis({ building, reductionRate }: { building: string; reductionRate: number }) {
  const profile = INDUSTRY_PROFILES[building] ?? INDUSTRY_PROFILES.other;
  const ac = profile.electricBreakdown.find((b) => b.category === "空調");
  const fridge = profile.electricBreakdown.find((b) => b.category === "冷凍冷蔵");
  const refrigerantPct = (ac?.pct ?? 0) + (fridge?.pct ?? 0);
  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
        <PieChart className="w-3.5 h-3.5 text-ehc-400" />
        想定削減率 {(reductionRate * 100).toFixed(0)}% の根拠 — {profile.label}の電力消費内訳
      </div>
      <div className="flex w-full h-5 rounded-md overflow-hidden mb-2">
        {profile.electricBreakdown.map((b) => (
          <div
            key={b.category}
            style={{ width: `${b.pct}%`, backgroundColor: b.color }}
            title={`${b.category} ${b.pct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 mb-2.5">
        {profile.electricBreakdown.map((b) => (
          <span key={b.category} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: b.color }} />
            {b.category} {b.pct}%
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        {profile.label}では冷媒を使う設備（空調{ac ? `${ac.pct}%` : ""}
        {fridge ? `＋冷凍冷蔵${fridge.pct}%` : ""}）が電力の<strong className="text-ehc-300">約{refrigerantPct}%</strong>を占めます。
        高効率機への更新・炭化水素冷媒ドロップインでこの部分を中心に削減できるため、
        当業種の想定削減率を<strong className="text-ehc-300">{(reductionRate * 100).toFixed(0)}%</strong>として試算しています
        （出典: 資源エネルギー庁／EHC施工実績平均）。
      </p>
    </div>
  );
}
