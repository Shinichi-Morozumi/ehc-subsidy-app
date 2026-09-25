/* ───────────────────────────────────────────────────────────
   用語の説明（2026-09-25 UXレビュー No.28）
   制度名や結果の画面に、設備単位型・GX・非化石転換・交付決定などが説明なしで出ていた。
   設備の担当者以外にも読めるよう、初めて出る画面に短い説明を置く。
   制度の要件そのものは書かない（要件は公募要領と各制度のカードが持つ）。
   ─────────────────────────────────────────────────────────── */

const TERMS: { term: string; desc: string }[] = [
  { term: "公募", desc: "補助金の申請を受け付ける期間のことです。期間内に申請書類を提出します。" },
  {
    term: "交付決定",
    desc: "補助金を出すことが正式に決まることです。多くの制度では、交付決定の前に発注・契約・着工すると補助の対象外になります。",
  },
  { term: "補助率", desc: "対象になる経費のうち、補助金で出る割合です。例：1/3 なら、対象経費300万円に対して最大100万円。" },
  { term: "SII", desc: "一般社団法人 環境共創イニシアチブ。国（経済産業省）の省エネ補助金の窓口です。" },
  {
    term: "設備単位型",
    desc: "省エネ補助金の申請区分の1つです。SII が定めた省エネ性能の基準を満たす設備（型番ごとに登録）へ更新するときに使います。",
  },
  { term: "GX", desc: "グリーン・トランスフォーメーション。脱炭素と経済成長の両立をめざす国の取り組みです。" },
  {
    term: "非化石転換",
    desc: "ガス・重油などの化石燃料から、電気や水素など化石燃料以外のエネルギーへ切り替えることです。",
  },
];

export function GlossaryDetails({ className = "" }: { className?: string }) {
  return (
    <details className={`ehc-glossary ${className}`.trim()}>
      <summary className="min-h-[48px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
        用語の説明
      </summary>
      <dl className="mt-2 space-y-3">
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt className="text-[14px] font-bold leading-[1.8] text-ink">{t.term}</dt>
            <dd className="mt-0.5 text-[14px] leading-[1.8] text-ink-soft">{t.desc}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
