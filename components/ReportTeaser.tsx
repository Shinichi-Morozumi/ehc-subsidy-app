import { FileText, ArrowDown, CheckCircle2 } from "lucide-react";

export function ReportTeaser() {
  return (
    <div className="bg-gradient-to-br from-ehc-700 via-ehc-600 to-emerald-500 rounded-2xl p-6 md:p-8 text-white shadow-lift no-print mb-5">
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-3">
            <FileText className="w-3.5 h-3.5" />
            お客様向け提案書 自動生成
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">
            入力 30秒で、<br />
            <span className="text-emerald-100">本格的な補助金提案書</span>が出ます
          </h2>
          <ul className="space-y-2 text-sm text-emerald-50">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              適用可能な補助金を即マッチング（最大4制度）
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ROI・投資回収期間・15年累計削減額を算出
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              お客様名入りでそのまま印刷／PDF保存可
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              更新を検討すべき理由を5つ、根拠付きで提示
            </li>
          </ul>
          <div className="mt-5 flex items-center gap-2 text-sm font-semibold animate-bounce">
            <ArrowDown className="w-4 h-4" />
            下記フォームに入力してください
          </div>
        </div>
        <div className="bg-white/95 rounded-xl p-4 text-slate-900 shadow-2xl rotate-1 hover:rotate-0 transition-transform">
          <div className="border-b border-slate-200 pb-2 mb-3">
            <div className="text-[10px] text-slate-500">【ご提案書】サンプル</div>
            <div className="text-sm font-bold text-ehc-800">XX商事 御中</div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-ehc-50 px-2 py-1.5 rounded flex justify-between">
              <span className="text-ehc-700 font-medium">想定補助金</span>
              <span className="font-bold text-ehc-900">¥3,300,000</span>
            </div>
            <div className="bg-amber-50 px-2 py-1.5 rounded flex justify-between">
              <span className="text-amber-700 font-medium">投資回収</span>
              <span className="font-bold text-amber-900">2.3 年</span>
            </div>
            <div className="bg-sky-50 px-2 py-1.5 rounded flex justify-between">
              <span className="text-sky-700 font-medium">年間削減</span>
              <span className="font-bold text-sky-900">¥648,000</span>
            </div>
            <div className="bg-violet-50 px-2 py-1.5 rounded flex justify-between">
              <span className="text-violet-700 font-medium">15年累計</span>
              <span className="font-bold text-violet-900">¥9,720,000</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
            株式会社EHCソリューションズ
          </div>
        </div>
      </div>
    </div>
  );
}
