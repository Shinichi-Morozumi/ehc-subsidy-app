import { FileSearch, Building, FileText, ClipboardCheck, Wrench, CalendarCheck, ArrowRight } from "lucide-react";

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

// mailto は件名・本文を必ずURLエンコードする（【】や空白を生のまま入れると一部ブラウザ/メールクライアントで
// リンクが解釈できず「押しても何も起きない」状態になるため）。宛先EHC＋cc PN。
const SURVEY_SUBJECT = "【補助金マッチング】現地調査のご依頼";
const SURVEY_BODY = `EHC ご担当者様

補助金シミュレーションを拝見し、無料の現地調査を希望します。
下記の連絡先までご連絡ください。

会社名：
ご担当者名：
電話番号：
ご住所（設置場所）：
ご希望日程：`;
const SURVEY_MAILTO = `mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent(
  SURVEY_SUBJECT
)}&body=${encodeURIComponent(SURVEY_BODY)}`;

export function NextSteps() {
  return (
    <div className="border-2 border-ehc-500/30 rounded-2xl p-5 md:p-6 bg-gradient-to-br from-white to-ehc-500/10">
      <h3 className="text-base font-bold text-ehc-300 mb-1.5">
        より詳細なシミュレーションのための次のステップ
      </h3>
      <p className="text-xs text-slate-400 mb-5">
        本シミュレーションは概算値です。実際の補助金獲得額・電気代削減効果を確定するため、以下のフローで進めます。
      </p>
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className="flex gap-3 bg-night-900 border border-white/10 rounded-xl p-3.5 hover:shadow-card transition-shadow"
            >
              <div className="bg-ehc-500/15 text-ehc-300 rounded-lg w-10 h-10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white mb-1">{step.title}</div>
                <p className="text-xs text-slate-300 leading-relaxed mb-1.5">{step.body}</p>
                <div className="text-[11px] text-ehc-300 font-medium">
                  ✓ 成果物: {step.deliverable}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4 bg-gradient-to-br from-ehc-600 to-ehc-800 ring-1 ring-ehc-400/40 shadow-[0_18px_50px_-12px_rgba(0,166,81,0.55)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-night-900 text-[10px] font-black tracking-wide">無料</span>
            <span className="text-base font-black text-white">まずは無料の現地調査から</span>
          </div>
          <div className="text-xs text-emerald-100">EHC担当者がご訪問し、最適プランをご提案します（費用・キャンセル料はかかりません）</div>
        </div>
        <a
          href={SURVEY_MAILTO}
          className="no-print group flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 text-night-900 text-base font-black shadow-lg shadow-amber-500/30 hover:bg-amber-300 hover:shadow-amber-400/50 hover:-translate-y-0.5 active:translate-y-0 transition-all whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <CalendarCheck className="w-5 h-5" />
          現地調査を依頼する
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
}
