"use client";

import { Card, CardTitle } from "./ui/Card";
import { MatchInput } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { RoiChart } from "./RoiChart";
import { NextSteps } from "./NextSteps";
import { AchievementsSection } from "./AchievementsSection";
import { Printer, FileText, Handshake, Calendar, LineChart, Award, ClipboardList } from "lucide-react";
import { INDUSTRY_PROFILES } from "@/lib/industries";

// ── 提案書の送付フロー（将来実装メモ）─────────────────────────
// 現状: 画面で「印刷 / PDF保存」して手動共有。
// 次段階: お問い合わせ受信 → お客様の会社情報（社名・担当・住所等）取得 →
//         本テンプレートに自動差し込み → PDF生成 → 自動メール送信。
//   ※メール自動送信は別途バックエンド/連携（要権限）。本コンポーネントは出力体裁のみ担当。
// ───────────────────────────────────────────────

const BUILDING_LABELS: Record<string, string> = {
  office: "オフィス・事務所", retail: "小売店舗", restaurant: "飲食店",
  hotel: "ホテル・宿泊", medical: "医療・福祉", school: "学校・教育", other: "その他事業所",
};
const REFRI_LABELS: Record<string, string> = {
  r22: "R22（HCFC・製造禁止）", r410a: "R410A（HFC・廃止進行中）", r32: "R32（GWP675）", unknown: "不明",
};

export function CustomerReport({ input, result }: { input: MatchInput; result: MatchResult }) {
  const now = new Date();
  const today = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const proposalNo = `EHC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const rewardYen = Math.round(result.bestSubsidyManYen * 10000 * 0.1);
  const industryLabel = (INDUSTRY_PROFILES[input.building] ?? INDUSTRY_PROFILES.other).label;

  const handlePrint = () => window.print();

  return (
    <Card className="border-2 border-ehc-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
        <CardTitle icon={<FileText className="w-5 h-5" />} className="border-b-0 pb-0 mb-0">
          お客様向け提案書
        </CardTitle>
        <button
          onClick={handlePrint}
          className="bg-gradient-to-r from-ehc-700 to-ehc-600 hover:from-ehc-800 hover:to-ehc-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-card hover:shadow-lift transition-all"
        >
          <Printer className="w-4 h-4" />
          印刷 / PDF保存
        </button>
      </div>

      <div className="border-2 border-slate-200 rounded-xl p-6 bg-white">
        <div className="text-center border-b-2 border-ehc-700 pb-4 mb-5">
          <div className="text-xs text-slate-500 mb-1">業務用空調 更新工事 ご提案書</div>
          <h1 className="text-2xl font-bold text-ehc-900 mb-2">
            {input.customerCompany || "お客様"} 御中
          </h1>
          <div className="flex items-center justify-center gap-3 text-xs text-slate-600 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {today}
            </span>
            {input.customerContact && <span>ご担当: {input.customerContact} 様</span>}
            <span className="text-slate-400">提案書番号: {proposalNo}</span>
          </div>
        </div>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            1. ご確認条件（ヒアリング内容）
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50">
            <CondCell label="業種・用途" value={`${BUILDING_LABELS[input.building] ?? "—"}（${industryLabel}）`} />
            <CondCell label="設備種別" value={input.equip === "multi" ? "マルチエアコン（ビル用）" : "パッケージエアコン"} />
            <CondCell label="設置からの年数" value={`${input.years}年`} />
            <CondCell label="現在の冷媒" value={REFRI_LABELS[input.refri] ?? "—"} />
            <CondCell label="年間電力使用量" value={`${input.kwh.toLocaleString("ja-JP")} kWh`} />
            <CondCell label="設備投資概算" value={`${input.invest.toLocaleString("ja-JP")} 万円`} />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            ※ 上記は御社からのヒアリング値に基づく試算条件です。正式見積は現地調査後にご提示します。
          </p>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            2. ご提案サマリー
          </h2>
          <p className="text-[11px] text-slate-600 mb-2">
            {industryLabel}は冷媒設備が電力の多くを占めるため、想定削減率
            <strong className="text-ehc-700">{(result.industryReductionRate * 100).toFixed(0)}%</strong>
            （出典: 資源エネルギー庁／EHC施工実績平均）で試算しています。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCell label="想定補助金額" value={`¥${(result.bestSubsidyManYen * 10000).toLocaleString("ja-JP")}`} color="green" />
            <SummaryCell label="投資回収期間" value={result.yearsToRecover !== null ? `${result.yearsToRecover} 年` : "—"} color="amber" />
            <SummaryCell label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} color="blue" />
            <SummaryCell label="15年累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} color="purple" />
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            3. 15年累計コスト 比較シミュレーション
          </h2>
          <div className="bg-slate-50 rounded-xl p-3 mb-2">
            <RoiChart
              invest={input.invest}
              bestSubsidyManYen={result.bestSubsidyManYen}
              saveYenPerYear={result.saveYenPerYear}
              kwhPerYear={input.kwh}
              reductionRate={result.industryReductionRate}
            />
          </div>
          <div className="text-[11px] text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-2">
            <div className="bg-red-50 border border-red-100 rounded-md px-2 py-1.5">
              <strong className="text-red-700">赤線:</strong> 何もしない（旧機器維持・効率低下＆修理費）
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
              <strong className="text-amber-700">橙線:</strong> 更新（補助金なし）
            </div>
            <div className="bg-ehc-50 border border-ehc-200 rounded-md px-2 py-1.5">
              <strong className="text-ehc-700">緑線:</strong> 更新（補助金あり）← ベスト
            </div>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            4. 適用可能な補助金制度
          </h2>
          {result.matched.length ? (
            <ul className="space-y-2">
              {result.matched.map((s) => (
                <li key={s.id} className="text-xs border border-slate-200 rounded-lg p-3 bg-ehc-50/40">
                  <div className="font-semibold text-ehc-900 mb-1">◆ {s.name}</div>
                  <div className="text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-1">
                    <span>主催: {s.org}</span>
                    <span>補助率: {s.rate}</span>
                    <span>上限: {s.max}</span>
                  </div>
                  <div className="text-slate-600 mt-1">公募期間: {s.period}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">条件に該当する補助金が現在見当たりません。個別ヒアリングにてご相談ください。</p>
          )}
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            5. 今、更新をご検討いただきたい理由
          </h2>
          <ol className="space-y-1.5 text-xs text-slate-700 list-decimal list-inside">
            {result.reasons.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            6. EHC 推奨プラン
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed">{result.ehcPlan}</p>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" />
            7. EHC 導入実績（御社業種マッチ）
          </h2>
          <AchievementsSection building={input.building} equip={input.equip} />
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <Handshake className="w-4 h-4" />
            8. 補助金獲得サポートと報酬体系
          </h2>
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-xs space-y-2">
            <p className="text-slate-800 leading-relaxed">
              EHCソリューションズは、補助金の<strong>適用判定・申請書類作成・実績報告まで一気通貫</strong>でサポートいたします。
            </p>
            <div className="bg-white border border-amber-300 rounded-md p-3 mt-2">
              <div className="text-amber-900 font-bold mb-1">■ 成功報酬</div>
              <div className="text-slate-800">
                獲得補助金額の <span className="text-2xl font-bold text-amber-700">10%</span>
              </div>
              {result.bestSubsidyManYen > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200 text-slate-700">
                  本ケース想定: 補助金 ¥{(result.bestSubsidyManYen * 10000).toLocaleString("ja-JP")} → サポート報酬{" "}
                  <strong className="text-amber-800">¥{rewardYen.toLocaleString("ja-JP")}</strong>
                </div>
              )}
            </div>
            <p className="text-slate-600 text-[11px]">
              ※ 不採択の場合、サポート報酬は発生しません（完全成功報酬制）。
              <br />
              ※ 設備費・工事費は別途お見積りいたします。
            </p>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            9. 次のステップ（より詳細なシミュレーションへ）
          </h2>
          <NextSteps />
        </section>

        <footer className="border-t-2 border-slate-200 pt-4 mt-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-bold text-ehc-900 mb-1">株式会社EHCソリューションズ</div>
              <div className="text-slate-600">業務用空調・GX・補助金 専門</div>
              {input.ehcStaff && <div className="text-slate-700 mt-1">担当: {input.ehcStaff}</div>}
            </div>
            <div className="text-right text-slate-500 text-[11px]">
              本提案書は試算値に基づくものであり、実際の補助金採択・補助額・電気代削減効果を保証するものではありません。
            </div>
          </div>
        </footer>
      </div>
    </Card>
  );
}

const SUMMARY_COLORS = {
  green: "bg-ehc-50 border-ehc-200 text-ehc-900",
  amber: "bg-amber-50 border-amber-200 text-amber-900",
  blue: "bg-sky-50 border-sky-200 text-sky-900",
  purple: "bg-violet-50 border-violet-200 text-violet-900",
};

function CondCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "amber" | "blue" | "purple";
}) {
  return (
    <div className={`border rounded-lg p-3 ${SUMMARY_COLORS[color]}`}>
      <div className="text-[10px] opacity-80 mb-1">{label}</div>
      <div className="text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}
