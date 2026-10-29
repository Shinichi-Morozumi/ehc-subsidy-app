import type { Metadata } from "next";
import Image from "next/image";
import { ACHIEVEMENTS, ACHIEVEMENT_STATS } from "@/lib/achievements";
import { BUILD_RECORDS, BUILD_RECORDS_NOTE, DROPIN_CASES, PN_SHOWCASE, TEAM, TEAM_SOURCES, TEAM_VERIFIED_AT, WHY, WORKS_WE_DO } from "@/lib/team";
import { ConsultForm } from "@/components/programs/ConsultForm";
import { SiteFooterSimple, SiteHeader } from "@/components/programs/SiteShell";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 メンバーと実績（「工事も設備も、EHC のチームで全部」の「なぜ？」の飛び先）
   決め事と出どころは lib/team.ts。
   ─────────────────────────────────────────────────────────── */

const TITLE = "メンバーと実績｜工事も設備も、EHC のチームで";
const DESCRIPTION =
  "設計・施工の Leap、空調・給排水・電気の施工のプロジェクトネオ、実測と補助金の段取りの EHC。工事も設備もひとつのご相談先でお受けする理由と、施工・冷媒の入れ替えの実績。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/team" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ja_JP", url: "/team", images: [{ url: "/og.jpg" }] },
};

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader page="team" />
      <main className="mx-auto max-w-6xl px-4 pb-6 pt-5">
        <section className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-block rounded-xl bg-paper-tint px-3 py-1 text-[14px] font-bold text-brand-deep">メンバーと実績</p>
            <h1 className="mt-3 text-[28px] font-bold leading-[1.4] sm:text-[36px]">
              工事も設備も、<span className="whitespace-nowrap">EHC のチームで</span><span className="whitespace-nowrap">全部お受けします</span>
            </h1>
            <p className="mt-3 text-[16px] leading-[1.9] text-ink-soft">
              補助金の確認、現地調査、見積・図面・省エネの資料づくり、そして工事まで。空調だけでなく、照明・電気・給排水・防水・内装まで、ご相談先は EHC ひとつです。
            </p>
          </div>
          <Image src="/v17/hero-scene.webp" alt="事務所と店舗の天井の空調と、室外機の前で確かめる作業員のイラスト" width={1536} height={1024} priority sizes="(max-width: 1024px) 100vw, 520px" className="h-auto w-full rounded-3xl" />
        </section>

        <section aria-labelledby="why" className="mt-10">
          <h2 id="why" className="text-[24px] font-bold">なぜ、全部受けられるのか</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {WHY.map((w, i) => (
              <div key={w.head} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-deep text-[16px] font-bold text-white">{i + 1}</span>
                <p className="mt-3 text-[18px] font-bold leading-[1.5]">{w.head}</p>
                <p className="mt-2 text-[15px] leading-[1.8]">{w.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-3xl bg-white p-5 shadow-card">
            <p className="text-[16px] font-bold">お受けできる工事</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {WORKS_WE_DO.map((w) => <li key={w} className="rounded-full bg-paper-tint px-3 py-1.5 text-[14px] font-bold text-brand-deep">{w}</li>)}
            </ul>
            <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">ご契約の相手（EHC か、チームの施工会社か）は、工事の内容で決まります。建設業の許可が要る工事にも対応でき、必要な書類はその都度お出しします。工事は全国でお受けします（一都三県のほか、山梨県・福岡県などでも施工しています）。介護施設の空調・設備の工事も、ふだんから行っています（施設名は載せていません）。</p>
          </div>
        </section>

        <section aria-labelledby="members" className="mt-10">
          <h2 id="members" className="text-[24px] font-bold">メンバー</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {TEAM.map((m) => (
              <article key={m.name} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card">
                <p className="text-[13px] font-bold text-brand">{m.ehcRole}</p>
                <h3 className="mt-0.5 text-[22px] font-bold">{m.name}</h3>
                <p className="mt-1 text-[15px] font-bold text-ink">担当：{m.handles}</p>
                <dl className="mt-3 space-y-1.5 text-[14px] leading-[1.7]">
                  <div className="grid grid-cols-[7em_1fr] gap-2"><dt className="font-bold text-ink-soft">{m.companyLabel}</dt><dd>{m.company}<span className="block text-ink-soft">{m.companyNote}</span></dd></div>
                  {m.licenses.length > 0 && (
                    <div className="grid grid-cols-[7em_1fr] gap-2"><dt className="font-bold text-ink-soft">許可など</dt><dd><ul className="space-y-0.5">{m.licenses.map((l) => <li key={l}>{l}</li>)}</ul></dd></div>
                  )}
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="records" className="mt-10">
          <h2 id="records" className="text-[24px] font-bold">実績</h2>

          <h3 className="mt-5 text-[18px] font-bold">空調・設備の施工</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {BUILD_RECORDS.map((r) => (
              <article key={r.name} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card">
                <p className="text-[13px] font-bold text-brand">{r.tag}</p>
                <p className="mt-1 text-[19px] font-bold">{r.name}</p>
                <p className="mt-1 text-[15px]">{r.what}</p>
              </article>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">{BUILD_RECORDS_NOTE}</p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {PN_SHOWCASE.map((s) => (
              <li key={s.what} className="rounded-2xl bg-white px-4 py-3 text-[15px] leading-[1.7] shadow-soft"><b className="mr-2 text-brand">{s.tag}</b>{s.what}</li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink-soft">プロジェクトネオの公式サイトの施工事例から。内装・建物の施工は、Leap の公式サイトにも飲食店・美容室・サロン・物販店・住宅リフォームなどの事例があります。</p>

          <h3 className="mt-8 text-[18px] font-bold">冷媒の入れ替え（ドロップイン）の実測</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {DROPIN_CASES.map((d) => (
              <article key={d.name} className="rounded-3xl border border-ink-line bg-white p-5 shadow-card">
                <p className="text-[13px] font-bold text-brand">{d.tag}</p>
                <p className="mt-1 text-[17px] font-bold leading-[1.5]">{d.name}</p>
                <p className="mt-1 text-[14px] text-ink-soft">{d.what}</p>
                <p className="mt-3 leading-none"><b className="text-[40px] text-brand-deep">{d.num}</b><span className="ml-2 text-[14px] font-bold">{d.numLabel}</span></p>
                <p className="mt-3 text-[13px] leading-[1.75] text-ink-soft">{d.note}</p>
              </article>
            ))}
          </div>

          <h3 className="mt-8 text-[18px] font-bold">炭化水素冷媒の導入事例（{ACHIEVEMENT_STATS.totalCases}件）</h3>
          <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">出典：EHC「炭化水素冷媒 導入事例集」。数値は各施設の条件での結果で、ほかの施設での効果を約束するものではありません。</p>
          <div className="mt-3 overflow-x-auto rounded-3xl border border-ink-line bg-white shadow-card">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="bg-paper-sub text-[13px] text-ink-soft">
                <tr><th className="px-4 py-2">業種</th><th className="px-4 py-2">機器</th><th className="px-4 py-2 text-right">台数</th><th className="px-4 py-2 text-right">CO2削減（t/年）</th><th className="px-4 py-2 text-right">電力削減</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {ACHIEVEMENTS.map((a) => (
                  <tr key={a.id}><td className="px-4 py-2 font-bold">{a.industry}</td><td className="px-4 py-2">{a.equipment}</td><td className="px-4 py-2 text-right">{a.units}台</td><td className="px-4 py-2 text-right">{a.co2ReductionTon}</td><td className="px-4 py-2 text-right">{a.powerReductionRate}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <ConsultForm source="team" options={["tokyoZeroemi", "tokyoKaishu", "tokyoChiiki", "kokuKaigo", "kokuKaigo30", "sii"]} />
        </section>

        <section aria-label="出典" className="mt-8 text-[13px] leading-[1.8] text-ink-soft">
          <p className="font-bold text-ink">出典（{TEAM_VERIFIED_AT.replace(/-/g, "/")} に確認）</p>
          <ul className="mt-1 list-disc pl-5">
            {TEAM_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{s.label}</a></li>)}
            <li>役職・担当：EHC 提供情報</li>
          </ul>
        </section>
      </main>
      <SiteFooterSimple />
    </div>
  );
}
