"use client";

import { Card, CardTitle } from "./ui/Card";
import { MatchInput } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { RoiChart } from "./RoiChart";
import { NextSteps } from "./NextSteps";
import { AchievementsSection } from "./AchievementsSection";
import { Printer, FileText, Handshake, Calendar, LineChart, Award, ClipboardList, Mail } from "lucide-react";
import { INDUSTRY_PROFILES } from "@/lib/industries";
import { QRCodeSVG } from "qrcode.react";

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

  // 保存(PDF)後もお問い合わせが届くよう、宛先・件名（提案書番号入り）を仕込んだmailtoリンク
  const inquiryMailto = `mailto:info@ehcjpn.com?subject=${encodeURIComponent(
    `【提案書 ${proposalNo}】現地調査・お見積りのご依頼（${input.customerCompany || "御社名"}）`
  )}`;

  return (
    <Card className="border-2 border-ehc-200 customer-report">
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

      <div className="report-sheet relative overflow-hidden border-2 border-slate-200 rounded-xl p-6 bg-white select-none">
        {/* 透かし（画面＋全印刷ページ）: コピー・スクショ・無断転載の抑止 */}
        <div className="watermark-layer" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i}>EHC SOLUTIONS ｜ 社外秘 ｜ 無断複製・転載禁止 ｜ {proposalNo}</div>
          ))}
        </div>
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
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 mb-3">
              <CondCell label="業種・用途" value={`${BUILDING_LABELS[input.building] ?? "—"}（${industryLabel}）`} />
              <CondCell label="年間電力使用量" value={`${result.totalKwh.toLocaleString("ja-JP")} kWh${input.kwhMode === "measured" ? "（実測）" : "（自動按分）"}`} />
              <CondCell label="設備投資概算" value={`${input.invest.toLocaleString("ja-JP")} 万円`} />
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left py-1">冷媒</th>
                  <th className="text-left py-1">種別</th>
                  <th className="text-right py-1">設置年</th>
                  <th className="text-right py-1">築年</th>
                  <th className="text-right py-1">台数</th>
                  <th className="text-right py-1">年間kWh</th>
                </tr>
              </thead>
              <tbody>
                {result.groups.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100">
                    <td className="py-1 font-semibold text-slate-800">{g.refri.toUpperCase()}</td>
                    <td className="py-1 text-slate-700">{g.equip === "multi" ? "マルチ" : "パッケージ"}</td>
                    <td className="py-1 text-right text-slate-700">{g.installYear}</td>
                    <td className="py-1 text-right text-slate-700">築{g.age}年</td>
                    <td className="py-1 text-right text-slate-700">{g.units}台</td>
                    <td className="py-1 text-right text-slate-700">{g.kwh.toLocaleString("ja-JP")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            {industryLabel}は冷媒設備が電力の多くを占め、設置年・冷媒世代に応じた経年劣化（年約2%）も加味すると、
            高効率化＋経年回復で<strong className="text-ehc-700">全体の実効削減率 {(result.effectiveReductionRate * 100).toFixed(0)}%</strong>
            （出典: 資源エネルギー庁／業界資料／EHC施工実績）で試算しています。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCell label="想定補助金額" value={`¥${(result.bestSubsidyManYen * 10000).toLocaleString("ja-JP")}`} color="green" />
            <SummaryCell label="損益分岐(回収)" value={result.yearsToRecover !== null ? `${result.yearsToRecover} 年` : "—"} color="amber" />
            <SummaryCell label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} color="blue" />
            <SummaryCell label="15年累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} color="purple" />
            <SummaryCell label="CO₂削減/年" value={`${result.co2ReductionTon} t`} color="green" />
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
              kwhPerYear={result.totalKwh || input.kwh}
              reductionRate={result.effectiveReductionRate}
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
          <AchievementsSection building={input.building} equip={result.representativeEquip} />
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

        {/* お問い合わせ導線（印刷/PDF保存後も残る・QRから件名入りメールが起動） */}
        <div className="mt-6 border-2 border-ehc-600 rounded-lg p-4 bg-ehc-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-bold text-ehc-900 text-sm mb-1 flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              お見積り・現地調査（無料）のお申し込み
            </div>
            <div className="text-slate-700 text-xs">
              メール:{" "}
              <a href={inquiryMailto} className="font-semibold text-ehc-800 underline">
                info@ehcjpn.com
              </a>
              （件名に提案書番号 <strong>{proposalNo}</strong> をご記載ください）
            </div>
            <div className="text-slate-500 text-[10px] mt-1">
              右のQRコードをスマホのカメラで読み取ると、宛先・件名入りのお問い合わせメールがそのまま開きます。
            </div>
          </div>
          <div className="bg-white p-2 rounded-md border border-slate-200 flex-shrink-0">
            <QRCodeSVG value={inquiryMailto} size={84} level="M" fgColor="#0a0a0a" bgColor="#ffffff" />
          </div>
        </div>

        <footer className="border-t-2 border-slate-200 pt-4 mt-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-bold text-ehc-900 mb-1">株式会社EHCソリューションズ</div>
              <div className="text-slate-600">業務用空調・GX・補助金 専門</div>
              {input.ehcStaff && <div className="text-slate-700 mt-1">担当: {input.ehcStaff}</div>}
            </div>
            <div className="text-right text-slate-500 text-[11px]">
              本提案書は試算値に基づくものであり、実際の補助金採択・補助額・電気代削減効果を保証するものではありません。
              <br />
              本提案書の無断複製・第三者への転載を禁じます。© 株式会社EHCソリューションズ
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
