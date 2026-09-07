import { FileText, ArrowDown, CheckCircle2 } from "lucide-react";

export function ReportTeaser() {
  return (
    <div className="bg-gradient-to-br from-ehc-700 via-ehc-600 to-emerald-500 rounded-2xl p-6 md:p-8 text-white shadow-lift no-print mb-5">
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-3">
            <FileText className="w-3.5 h-3.5" />
            お客様向け診断書 自動生成
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">
            ガイド入力 約2分で、<br />
            <span className="text-emerald-100">判断できる補助金診断書</span>が出ます
          </h2>
          <ul className="space-y-2 text-sm text-emerald-50">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              補助金候補を照合し、期限・使い道・準備量を表示
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
              次に確認することまで9項目で整理
            </li>
          </ul>
          <div className="mt-4 bg-white/15 backdrop-blur rounded-lg p-3 text-xs">
            <div className="font-semibold text-emerald-100 mb-1">📊 国内市場規模</div>
            <div>業務用空調 <strong className="text-white">約1,050万台</strong>がドロップイン対象（経産省推計）</div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold animate-bounce">
            <ArrowDown className="w-4 h-4" />
            1画面1問のガイド、または下のフォームから入力してください
          </div>
        </div>
        <div className="bg-white/95 rounded-xl p-4 text-white shadow-2xl rotate-1 hover:rotate-0 transition-transform">
          <div className="border-b border-white/10 pb-2 mb-3">
            <div className="text-xs text-slate-500">【補助金・省エネ診断書】サンプル</div>
            <div className="text-sm font-bold text-ehc-300">XX商事 御中</div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="bg-ehc-500/10 px-2 py-1.5 rounded flex justify-between">
              <span className="text-ehc-300 font-medium">候補額（要確認）</span>
              <span className="font-bold text-ehc-300">¥3,300,000</span>
            </div>
            <div className="bg-amber-500/10 px-2 py-1.5 rounded flex justify-between">
              <span className="text-amber-300 font-medium">投資回収</span>
              <span className="font-bold text-amber-300">2.3 年</span>
            </div>
            <div className="bg-sky-500/10 px-2 py-1.5 rounded flex justify-between">
              <span className="text-sky-700 font-medium">年間削減</span>
              <span className="font-bold text-sky-300">¥648,000</span>
            </div>
            <div className="bg-violet-500/10 px-2 py-1.5 rounded flex justify-between">
              <span className="text-violet-700 font-medium">15年累計</span>
              <span className="font-bold text-violet-300">¥9,720,000</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-white/10 text-xs text-slate-500">
            株式会社EHCソリューションズ
          </div>
        </div>
      </div>
    </div>
  );
}
