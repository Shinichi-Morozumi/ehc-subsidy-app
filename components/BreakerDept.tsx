import { Card, CardTitle } from "./ui/Card";
import { Bolt, TrendingDown, Building, Calculator, CheckCircle2, ArrowRight, Mail, Award } from "lucide-react";

const BREAKER_MERITS = [
  {
    icon: TrendingDown,
    title: "基本料金の大幅削減",
    body: "業務用低圧電力（動力）の契約容量を最適化。電気の基本料金を年間30〜50%削減した事例多数",
    highlight: "30〜50%",
  },
  {
    icon: Award,
    title: "経済産業省 認可済み",
    body: "電子ブレーカーは経産省認可の電気使用合理化機器。施工は電気工事士が行います",
  },
  {
    icon: Building,
    title: "設備投資 短期回収",
    body: "通常1.5〜3年で投資回収。設置後は契約期間中（最大15年）ずっとコスト削減効果が継続",
    highlight: "1.5-3年",
  },
  {
    icon: Calculator,
    title: "電気使用量はそのまま",
    body: "使用電力量（kWh）には影響なし。基本料金（契約容量に応じた固定費）のみを最適化します",
  },
];

const TARGETS = [
  { biz: "オフィスビル", icon: "🏢", typical: "10-50kW", reduce: "30-40%" },
  { biz: "小売店舗・スーパー", icon: "🛒", typical: "15-100kW", reduce: "35-50%" },
  { biz: "飲食店", icon: "🍴", typical: "10-30kW", reduce: "30-45%" },
  { biz: "ホテル・宿泊", icon: "🏨", typical: "50-200kW", reduce: "25-40%" },
  { biz: "工場・倉庫", icon: "🏭", typical: "30-300kW", reduce: "30-50%" },
  { biz: "医療・福祉", icon: "🏥", typical: "20-100kW", reduce: "30-40%" },
];

export function BreakerDept() {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-amber-700 via-amber-600 to-yellow-500 text-white rounded-2xl p-6 md:p-8 shadow-lift relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-medium mb-3">
            <Bolt className="w-3.5 h-3.5" />
            電子ブレーカー部門
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
            電気使用量はそのままで、<br />
            <span className="text-yellow-100">基本料金を最大50%削減</span>
          </h2>
          <p className="text-sm text-amber-50">
            株式会社プロジェクトネオ（PN）の電子ブレーカー導入で、契約容量を適正化
          </p>
        </div>
      </div>

      <Card>
        <CardTitle icon={<CheckCircle2 className="w-5 h-5" />}>4つのメリット</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BREAKER_MERITS.map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={i} className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Icon className="w-6 h-6 text-amber-700 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-sm mb-1 text-amber-900 flex items-center gap-2">
                      {m.title}
                      {m.highlight && (
                        <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">
                          {m.highlight}
                        </span>
                      )}
                    </div>
                    <div className="text-xs leading-relaxed text-slate-700">{m.body}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Calculator className="w-5 h-5" />}>仕組み — なぜ基本料金が下がるのか</CardTitle>
        <div className="space-y-3 text-sm text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="font-semibold mb-2 text-slate-900">業務用低圧電力（動力）の基本料金 = 契約容量 × 基本料金単価</div>
            <p className="text-xs text-slate-600">
              多くの中小企業は <strong>「念のため大きめ」の契約容量</strong> で契約しています。
              実際の最大使用電力（瞬時値）に対して契約容量が過大になっているケースが大半です。
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="font-semibold mb-2 text-amber-900">電子ブレーカー導入後</div>
            <p className="text-xs text-slate-700">
              通常の機械式ブレーカーは「瞬時電流」に反応してすぐ落ちますが、
              <strong>電子ブレーカーは「実効電流（短時間の平均）」に反応</strong>するため、
              起動時の一時的な突入電流では落ちず、<strong>契約容量を小さく設定可能</strong>になります。
            </p>
            <p className="text-xs text-slate-700 mt-2">
              契約容量を下げる → 基本料金が下がる → <strong>毎月の電気代が削減される</strong>
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Building className="w-5 h-5" />}>導入効果が出やすい業種</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TARGETS.map((t, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300 hover:bg-amber-50/40 transition-colors">
              <div className="text-2xl mb-1.5">{t.icon}</div>
              <div className="text-sm font-bold text-slate-900 mb-0.5">{t.biz}</div>
              <div className="text-[11px] text-slate-500">契約容量目安: {t.typical}</div>
              <div className="mt-1.5 text-xs font-bold text-amber-700">基本料金 {t.reduce} 削減</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Bolt className="w-5 h-5" />}>株式会社プロジェクトネオ（PN）</CardTitle>
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500">代表取締役</div>
              <div className="font-bold text-slate-900">碓井 涼太</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">事業</div>
              <div className="font-bold text-slate-900">電子ブレーカー販売・電力削減コンサル</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">資格</div>
              <div className="text-slate-800 text-xs">建設業許可（管工事）/ 第一種フロン類回収登録</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">グループ連携</div>
              <div className="text-slate-800 text-xs">EHCソリューションズ取締役兼任 / 空調更新と組合せ提案可</div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs mt-3">
            <strong className="text-amber-900">💡 グループ連携メリット:</strong>
            EHCの炭化水素冷媒ドロップイン（使用電力 -15〜40%）と組み合わせれば、
            <strong>「使用電力量」と「基本料金」のダブル削減</strong>が可能。
            電気代総額で <strong>40〜60%</strong> 削減も視野。
          </div>
        </div>
      </Card>

      <div className="bg-gradient-to-r from-amber-700 to-amber-600 text-white rounded-2xl p-6 shadow-lift">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-lg font-bold mb-1">電子ブレーカー導入のご相談</div>
            <div className="text-sm text-amber-100">電気料金明細を拝見し、削減ポテンシャルを無料診断します</div>
          </div>
          <a
            href="mailto:info@ehcjpn.com?subject=【電子ブレーカー部門】導入相談"
            className="bg-white text-amber-800 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-amber-50 transition-colors no-print"
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
