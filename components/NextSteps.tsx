import { FileSearch, Building, FileText, ClipboardCheck, Wrench } from "lucide-react";

const STEPS = [
  {
    icon: FileSearch,
    title: "STEP 1 — 電気料金 & 設備情報の確認",
    body: "直近12ヶ月の電力会社請求書（kWh / 金額）と、既存空調機器の型番・台数をご提供ください。本シミュレーションの精度を上げます。",
    deliverable: "電気料金明細 / 設備リスト",
  },
  {
    icon: Building,
    title: "STEP 2 — 現地調査（無料）",
    body: "EHC担当者がご訪問し、建物図面の確認、既存設備の状態診断、配管流用可否（ドロップイン適合判定）を実施します。",
    deliverable: "現地調査レポート",
  },
  {
    icon: FileText,
    title: "STEP 3 — 詳細見積書 & 補助金併用最適化",
    body: "機器選定（ダイキン / 三菱 等）、工事計画、複数補助金の最適併用パターンを設計。最大効果のプランをご提案。",
    deliverable: "詳細見積書 / 補助金活用プラン",
  },
  {
    icon: ClipboardCheck,
    title: "STEP 4 — 補助金申請業務 完全代行",
    body: "事業計画書・省エネ計算書の作成、SII補助事業ポータル登録、自治体への申請まで一気通貫で代行します。",
    deliverable: "申請書類一式（採択率改善のための事前精査含む）",
  },
  {
    icon: Wrench,
    title: "STEP 5 — 採択後の工事 & 実績報告",
    body: "交付決定後の機器発注、施工、引渡し、補助金事務局への実績報告（補助金入金まで）を一括対応します。",
    deliverable: "新機器稼働 + 補助金入金",
  },
];

export function NextSteps() {
  return (
    <div className="border-2 border-ehc-200 rounded-2xl p-5 md:p-6 bg-gradient-to-br from-white to-ehc-50">
      <h3 className="text-base font-bold text-ehc-900 mb-1.5">
        より詳細なシミュレーションのための次のステップ
      </h3>
      <p className="text-xs text-slate-600 mb-5">
        本シミュレーションは概算値です。実際の補助金獲得額・電気代削減効果を確定するため、以下のフローで進めます。
      </p>
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className="flex gap-3 bg-white border border-slate-200 rounded-xl p-3.5 hover:shadow-card transition-shadow"
            >
              <div className="bg-ehc-100 text-ehc-700 rounded-lg w-10 h-10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 mb-1">{step.title}</div>
                <p className="text-xs text-slate-700 leading-relaxed mb-1.5">{step.body}</p>
                <div className="text-[11px] text-ehc-700 font-medium">
                  ✓ 成果物: {step.deliverable}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 bg-ehc-700 text-white rounded-xl p-4 text-sm flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-bold mb-0.5">まずは無料の現地調査から</div>
          <div className="text-xs text-emerald-100">EHC担当者がご訪問し、最適プランをご提案します</div>
        </div>
        <a
          href="mailto:info@ehc-sol.co.jp?subject=【補助金マッチング】現地調査のご依頼"
          className="bg-white text-ehc-800 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors no-print"
        >
          現地調査を依頼する →
        </a>
      </div>
    </div>
  );
}
