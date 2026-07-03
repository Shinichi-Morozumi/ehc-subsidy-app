import { Card, CardTitle } from "./ui/Card";
import { HYCHILL_PRODUCTS, GWP_COMPARISON, JAPAN_MARKET_SIZE } from "@/lib/hychill";
import { Droplet, Zap, ShieldCheck, Wrench, Leaf, CheckCircle2, ArrowRight, Mail } from "lucide-react";
import { DropinRoiWizard } from "./DropinRoiWizard";
import { DropinSimulator } from "./DropinSimulator";
import { UpdateEstimator } from "./UpdateEstimator";

const MERITS = [
  { icon: Zap, title: "電気代 15〜40%削減", body: "分子が少ない量で高エネルギー → 消費電力大幅削減", color: "amber" },
  { icon: Wrench, title: "機器の長寿命化", body: "コンプレッサー圧力が低く、機器負担軽減で利用継続が長期化", color: "blue" },
  { icon: ShieldCheck, title: "改正フロン法 対象外", body: "点検報告義務が免除。法的負担ゼロ", color: "purple" },
  { icon: Leaf, title: "温室効果ガス削減", body: "GWP 0.072〜3 のほぼゼロ。脱炭素経営に直接貢献", color: "green" },
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
            豪州 HyChill 社製 自然冷媒を業務用空調にドロップイン（対象は空調機器のみ）
          </p>
        </div>
      </div>

      <DropinRoiWizard />
      <DropinSimulator />
      <UpdateEstimator />

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
            <div className="text-3xl font-bold text-ehc-300">1,050<span className="text-base ml-1">万台</span></div>
            <div className="text-[10px] text-ehc-300 mt-1">経産省推計</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="text-xs text-amber-300 mb-1">業務用空調 約950万台</div>
            <div className="text-3xl font-bold text-amber-300">R410A/R32</div>
            <div className="text-[10px] text-amber-300 mt-1">→ Minus 60 / HC32 で対応</div>
          </div>
          <div className="bg-gradient-to-br from-sky-500/10 to-sky-500/10 border border-sky-500/30 rounded-xl p-4">
            <div className="text-xs text-sky-700 mb-1">ビル用マルチ 約100万台</div>
            <div className="text-3xl font-bold text-sky-300">R410A/R407C</div>
            <div className="text-[10px] text-sky-700 mt-1">→ Minus 50 / 60 で対応</div>
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
            href="mailto:info@ehcjpn.com?subject=【ドロップイン部門】導入相談"
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
