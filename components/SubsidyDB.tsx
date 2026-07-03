import { Card, CardTitle } from "./ui/Card";
import { SUBSIDIES, SUBSIDY_DATA_ASOF } from "@/lib/subsidies";
import { Database, ExternalLink } from "lucide-react";
import { SubsidyDisclaimer } from "./SubsidyDisclaimer";

export function SubsidyDB() {
  return (
    <div className="space-y-4">
      <SubsidyDisclaimer />
    <Card>
      <CardTitle icon={<Database className="w-5 h-5" />}>
        2026年度 業務用空調向け 補助金データベース
      </CardTitle>
      <p className="text-[11px] text-slate-500 mb-3">データ確認日: {SUBSIDY_DATA_ASOF}（公募状況は変動します。申請前に必ず公式サイトでご確認ください）</p>
      <div className="space-y-3">
        {SUBSIDIES.map((s) => (
          <div
            key={s.id}
            className={`border border-white/10 rounded-xl p-4 hover:shadow-card transition-shadow ${s.closed ? "bg-night-900 opacity-70" : "bg-gradient-to-br from-ehc-500/10 to-night-900"}`}
          >
            <h3 className={`text-sm font-semibold mb-2 ${s.closed ? "text-slate-400" : "text-ehc-300"}`}>{s.name}</h3>
            <div className="text-xs text-slate-400 mb-2.5 flex flex-wrap gap-1.5">
              {s.closed && (
                <span className="bg-red-500/15 text-red-300 px-2 py-0.5 rounded-md font-semibold">今年度 受付終了</span>
              )}
              <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">主催: {s.org}</span>
              <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">期間: {s.period}</span>
              <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">補助率: {s.rate}</span>
              <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">上限: {s.max}</span>
              <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">
                地域: {s.pref === "all" ? "全国" : s.pref.join("・")}
              </span>
              {s.infoOnly && (
                <span className="bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-md">情報提供（小規模のみ・要事業計画）</span>
              )}
            </div>
            <div className="text-xs text-slate-300 space-y-1">
              <p><strong className="text-white">要件:</strong> {s.requirement}</p>
              <p><strong className="text-white">必要書類:</strong> {s.docs}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ehc-400 hover:text-ehc-300 inline-flex items-center gap-1 text-[11px] underline-offset-2 hover:underline"
              >
                {s.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </Card>
    </div>
  );
}
