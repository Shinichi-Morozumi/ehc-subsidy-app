import { Card, CardTitle } from "./ui/Card";
import { SUBSIDIES } from "@/lib/subsidies";

export function SubsidyDB() {
  return (
    <Card>
      <CardTitle>2026年度 業務用空調向け 補助金データベース</CardTitle>
      {SUBSIDIES.map((s) => (
        <div key={s.id} className="border border-gray-200 border-l-4 border-l-ehc-accent bg-green-50 rounded-lg p-3.5 mb-3">
          <h3 className="text-sm font-semibold mb-1.5">{s.name}</h3>
          <div className="text-xs text-gray-600 mb-2 flex flex-wrap gap-1">
            <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">主催: {s.org}</span>
            <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">期間: {s.period}</span>
            <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">補助率: {s.rate}</span>
            <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">上限: {s.max}</span>
            <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">
              地域: {s.pref === "all" ? "全国" : s.pref.join("・")}
            </span>
          </div>
          <div className="text-xs text-gray-800">
            <strong>要件:</strong> {s.requirement}<br />
            <strong>必要書類:</strong> {s.docs}<br />
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ehc-accent underline text-[11px]">
              {s.url}
            </a>
          </div>
        </div>
      ))}
    </Card>
  );
}
