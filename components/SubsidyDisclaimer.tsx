import { SUBSIDY_DATA_ASOF } from "@/lib/subsidies";
import { AlertTriangle } from "lucide-react";

export function SubsidyDisclaimer() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>
        <strong className="text-amber-100">補助金情報は {SUBSIDY_DATA_ASOF} 時点の目安です。</strong>{" "}
        公募内容・補助率・上限・締切は予告なく変更され、予算到達で即日終了する場合があります。申請可否・最新条件は必ず公募要領／当社へご確認ください。本ツールの試算は概算であり、補助金の採択・交付を保証するものではありません。
      </div>
    </div>
  );
}
