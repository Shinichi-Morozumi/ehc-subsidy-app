import { Card, CardTitle } from "./ui/Card";
import { VENDORS } from "@/lib/vendors";

export function VendorTable() {
  return (
    <Card>
      <CardTitle>業務用空調メーカー ラインナップ（2026）</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="bg-ehc-primary text-white p-2 text-left">メーカー</th>
              <th className="bg-ehc-primary text-white p-2 text-left">シリーズ／代表機種</th>
              <th className="bg-ehc-primary text-white p-2 text-left">冷媒</th>
              <th className="bg-ehc-primary text-white p-2 text-left">主な用途</th>
              <th className="bg-ehc-primary text-white p-2 text-left">備考</th>
            </tr>
          </thead>
          <tbody>
            {VENDORS.map((v, i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="p-2 border-b border-gray-100 font-semibold">{v.maker}</td>
                <td className="p-2 border-b border-gray-100">{v.series}</td>
                <td className="p-2 border-b border-gray-100">{v.refri}</td>
                <td className="p-2 border-b border-gray-100">{v.use}</td>
                <td className="p-2 border-b border-gray-100">{v.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
