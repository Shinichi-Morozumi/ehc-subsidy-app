"use client";

import { Card, CardTitle } from "./ui/Card";
import { MatchInput } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { Printer, FileText, Handshake, Calendar } from "lucide-react";

export function CustomerReport({ input, result }: { input: MatchInput; result: MatchResult }) {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const rewardYen = Math.round(result.bestSubsidyManYen * 10000 * 0.1);

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
          <div className="flex items-center justify-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {today}
            </span>
            {input.customerContact && <span>ご担当: {input.customerContact} 様</span>}
          </div>
        </div>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            1. ご提案サマリー
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCell label="想定補助金額" value={`¥${(result.bestSubsidyManYen * 10000).toLocaleString("ja-JP")}`} color="green" />
            <SummaryCell label="投資回収期間" value={result.yearsToRecover !== null ? `${result.yearsToRecover} 年` : "—"} color="amber" />
            <SummaryCell label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} color="blue" />
            <SummaryCell label="15年累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} color="purple" />
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            2. 適用可能な補助金制度
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
            3. 今、更新をご検討いただきたい理由
          </h2>
          <ol className="space-y-1.5 text-xs text-slate-700 list-decimal list-inside">
            {result.reasons.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            4. EHC 推奨プラン
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed">{result.ehcPlan}</p>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <Handshake className="w-4 h-4" />
            5. 補助金獲得サポートと報酬体系
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
