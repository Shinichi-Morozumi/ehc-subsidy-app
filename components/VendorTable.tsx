import { Card, CardTitle } from "./ui/Card";
import { VENDORS } from "@/lib/vendors";
import { Wind } from "lucide-react";

export function VendorTable() {
  return (
    <Card>
      <CardTitle icon={<Wind className="w-5 h-5" />}>業務用空調メーカー ラインナップ（2026）</CardTitle>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-ehc-700 to-ehc-600 text-white">
              <th className="p-3 text-left font-semibold">メーカー</th>
              <th className="p-3 text-left font-semibold">シリーズ／代表機種</th>
              <th className="p-3 text-left font-semibold">冷媒</th>
              <th className="p-3 text-left font-semibold">主な用途</th>
              <th className="p-3 text-left font-semibold">備考</th>
            </tr>
          </thead>
          <tbody className="bg-night-900">
            {VENDORS.map((v, i) => (
              <tr
                key={i}
                className={`${i % 2 ? "bg-white/5" : "bg-night-900"} hover:bg-ehc-500/10 transition-colors`}
              >
                <td className="p-3 border-t border-white/10 font-semibold text-white">{v.maker}</td>
                <td className="p-3 border-t border-white/10 text-slate-300">{v.series}</td>
                <td className="p-3 border-t border-white/10">
                  <span className="bg-ehc-500/15 text-ehc-300 px-2 py-0.5 rounded-md font-medium text-[11px]">
                    {v.refri}
                  </span>
                </td>
                <td className="p-3 border-t border-white/10 text-slate-300">{v.use}</td>
                <td className="p-3 border-t border-white/10 text-slate-400">{v.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
