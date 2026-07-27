import { Card, CardTitle } from "./ui/Card";
import { HYCHILL_PRODUCTS, GWP_COMPARISON, JAPAN_MARKET_SIZE } from "@/lib/hychill";
import { DROPIN_REDUCTION_LABEL } from "@/lib/pricing";
import { Droplet, Zap, ShieldCheck, Wrench, Leaf, CheckCircle2, ArrowRight, Mail } from "lucide-react";
import { DropinRoiWizard } from "./DropinRoiWizard";
import { DropinSimulator } from "./DropinSimulator";

const HC_GWP = GWP_COMPARISON.find((g) => g.gas === "Hychill GAS")?.gwp ?? 3;

const MERITS = [
  // 削減率は lib/pricing.ts の DROPIN_REDUCTION（消費電力ベース25〜30%）と必ず一致させる
  { icon: Zap, title: `消費電力 ${DROPIN_REDUCTION_LABEL} 削減`, body: "少ない充填量で高い冷却能力 → 圧縮機の負荷が下がり消費電力を削減（電気「料金」の削減率は契約条件により変動します）", color: "amber" },
  { icon: Wrench, title: "機器の長寿命化", body: "コンプレッサー圧力が低く、機器負担軽減で利用継続が長期化", color: "blue" },
  { icon: ShieldCheck, title: "改正フロン法 対象外", body: "フロン類に該当しないため、算定漏えい量の報告・定期点検の対象外", color: "purple" },
  { icon: Leaf, title: "温室効果ガス削減", body: `GWP ${HC_GWP}（CO2=1基準）とほぼゼロ。脱炭素経営に直接貢献`, color: "green" },
];

const COLOR_BG: Record<string, string> = {
  amber: "from-amber-500/10 to-amber-500/10 text-amber-300 border-amber-500/30",
  blue: "from-sky-500/10 to-sky-500/10 text-sky-300 border-sky-500/30",
  purple: "from-violet-500/10 to-violet-500/10 text-violet-300 border-violet-500/30",
  green: "from-ehc-500/10 to-ehc-500/10 text-ehc-300 border-ehc-500/30",
};

export function DropinDept() {
  const maxGwp = Math.max(...GWP_COMPARISON.map(g => g.gwp));

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-ehc-800 via-cobalt-600 to-emerald-500 text-white rounded-2xl p-6 md:p-8 shadow-lift relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Droplet className="w-3.5 h-3.5" />
            炭化水素冷媒ドロップイン部門
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
            既存空調そのままで、<br />
            <span className="text-emerald-100">冷媒だけ交換</span> = 電気代と環境負荷を大幅削減
          </h2>
          <p className="text-sm text-emerald-50">
            豪州 HyChill 社製 自然冷媒を業務用空調にドロップイン（対象は業務用空調のみ・ルームエアコン/冷凍冷蔵機器は対象外）
          </p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-200">
        <strong className="text-amber-300">※補助金について:</strong> ドロップイン（冷媒置換のみ）で使える補助金は<strong className="text-amber-300">現状ありません</strong>。省エネ補助金は高効率機の新規導入が要件で、既存機を残すドロップインは<strong className="text-amber-300">対象外</strong>です（補助金で更新した機器にはドロップインを施工できません）。補助金を使う<strong className="text-amber-300">機器更新</strong>は「補助金マッチング」タブで診断・見積もりできます。
      </div>

      <DropinRoiWizard />
      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[11px] text-slate-400">
        下の「簡易シミュレーター」は<strong className="text-slate-200">社内向け</strong>の詳細版です。上のROI診断と<strong className="text-slate-200">同じ単価・同じ税込基準</strong>で計算しているため、同条件を入れれば金額・回収年数は一致します（簡易シミュレーターは追加充填量の入力・金額の手動上書き・見積の印刷が可能）。
      </div>
      <DropinSimulator />

      <Card>
        <CardTitle icon={<CheckCircle2 className="w-5 h-5" />}>4つのメリット</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MERITS.map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={i} className={`bg-gradient-to-br ${COLOR_BG[m.color]} border rounded-xl p-4`}>
                <div className="flex items-start gap-3">
                  <Icon className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-sm mb-1">{m.title}</div>
                    <div className="text-xs leading-relaxed">{m.body}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Leaf className="w-5 h-5" />}>GWP（地球温暖化係数）比較</CardTitle>
        <p className="text-xs text-slate-400 mb-3">数値が小さいほど環境負荷が低い（CO2=1基準）</p>
        <div className="space-y-2">
          {GWP_COMPARISON.map((g) => (
            <div key={g.gas} className="flex items-center gap-3">
              <div className="w-24 text-xs font-semibold text-slate-300">{g.gas}</div>
              <div className="flex-1 bg-white/10 rounded-full h-6 overflow-hidden relative">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2 text-[10px] font-bold text-white"
                  style={{ width: `${(g.gwp / maxGwp) * 100}%`, background: g.color }}
                >
                  {g.gwp >= 200 && `GWP ${g.gwp}`}
                </div>
                {g.gwp < 200 && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: g.color }}>
                    GWP {g.gwp}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-ehc-500/10 border border-ehc-500/30 rounded-lg p-3 text-xs">
          <strong className="text-ehc-300">Hychill GAS の GWP は CO2 とほぼ同等。</strong>
          R410A（GWP 2090）の空調をHychillに置換すれば、冷媒1kgあたり約2トンのCO2換算削減になります。
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Droplet className="w-5 h-5" />}>HyChill 製品ライン（6種類）</CardTitle>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-gradient-to-r from-ehc-700 to-ehc-600 text-white">
              <tr>
                <th className="p-3 text-left font-semibold">製品名</th>
                <th className="p-3 text-left font-semibold">タイプ</th>
                <th className="p-3 text-left font-semibold">対応フロン</th>
                <th className="p-3 text-left font-semibold">用途</th>
              </tr>
            </thead>
            <tbody>
              {HYCHILL_PRODUCTS.map((p, i) => (
                <tr key={p.id} className={`${i % 2 ? "bg-white/5" : "bg-night-900"} hover:bg-ehc-500/10 transition-colors`}>
                  <td className="p-3 border-t border-white/10 font-semibold text-ehc-300">{p.name}</td>
                  <td className="p-3 border-t border-white/10 text-slate-300">{p.type}</td>
                  <td className="p-3 border-t border-white/10">
                    <div className="flex flex-wrap gap-1">
                      {p.targetRefri.map(r => (
                        <span key={r} className="bg-ehc-500/15 text-ehc-300 px-1.5 py-0.5 rounded text-[10px] font-medium">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 border-t border-white/10 text-slate-400 text-[11px]">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Zap className="w-5 h-5" />}>国内市場規模 & ポテンシャル</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-ehc-500/10 to-ehc-500/10 border border-ehc-500/30 rounded-xl p-4">
            <div className="text-xs text-ehc-300 mb-1">業務用空調 国内稼動台数</div>
            <div className="text-3xl font-bold text-ehc-300">
              {JAPAN_MARKET_SIZE.totalBusinessAcUnits.toLocaleString("ja-JP")}
              <span className="text-base ml-1">{JAPAN_MARKET_SIZE.unit}</span>
            </div>
            <div className="text-[10px] text-ehc-300 mt-1">{JAPAN_MARKET_SIZE.source}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="text-xs text-amber-300 mb-1">
              {JAPAN_MARKET_SIZE.breakdown[0].category} 約{JAPAN_MARKET_SIZE.breakdown[0].units}{JAPAN_MARKET_SIZE.unit}
            </div>
            <div className="text-3xl font-bold text-amber-300">{JAPAN_MARKET_SIZE.breakdown[0].refri}</div>
            <div className="text-[10px] text-amber-300 mt-1">→ Minus 60 / HC32 で対応</div>
          </div>
          <div className="bg-gradient-to-br from-sky-500/10 to-sky-500/10 border border-sky-500/30 rounded-xl p-4">
            <div className="text-xs text-sky-300 mb-1">
              {JAPAN_MARKET_SIZE.breakdown[1].category} 約{JAPAN_MARKET_SIZE.breakdown[1].units}{JAPAN_MARKET_SIZE.unit}
            </div>
            <div className="text-3xl font-bold text-sky-300">{JAPAN_MARKET_SIZE.breakdown[1].refri}</div>
            <div className="text-[10px] text-sky-300 mt-1">→ Minus 50 / 60 で対応</div>
          </div>
        </div>
      </Card>

      <div className="bg-gradient-to-r from-ehc-700 to-ehc-600 text-white rounded-2xl p-6 shadow-lift">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-lg font-bold mb-1">ドロップイン導入のご相談</div>
            <div className="text-sm text-emerald-100">既存設備を確認させていただき、最適な提案をいたします</div>
          </div>
          <a
            href={`mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent("【ドロップイン部門】導入相談")}`}
            className="bg-night-900 text-ehc-300 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-500/10 transition-colors no-print"
          >
            <Mail className="w-4 h-4" />
            お問い合わせ
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
