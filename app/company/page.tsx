import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY } from "@/lib/company";

/* ───────────────────────────────────────────────────────────
   会社概要（2026-09-26 改善3）

   ehcjpn.com は会社のドメインなので、法人のお客様が「どんな会社か」を確かめられるページを置く。
   以前はフッターの住所と電話だけだった。

   ■ 載せる値の出どころ（推測で埋めない）
   　　会社名・代表者・所在地・電話・メール・受付時間 … lib/company.ts（出典はそのファイルのコメント）
   　　事業内容 … このサイトのトップ・診断の画面で既にお客様に示している内容の言い換え
   　　施工の連携先 … プライバシーポリシー（2026-09-25 制定）に書いている連携先と同じ
   　　設立年月日・資本金は、確かめられる資料（EHC の登記事項証明書）が手元に無いので載せていない。
   　　分かったら lib/company.ts に足してから、ここに行を足す。
   ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "会社概要",
  description:
    "株式会社EHCソリューションズの会社概要。業務用空調の冷媒の入れ替え（ドロップイン）、空調更新工事のご相談、省エネ補助金・助成金を使った更新のご相談。",
  alternates: { canonical: "/company" },
  /* 2026-10-29 ブラッシュアップ6：共有したときにこのページの説明文を出す */
  openGraph: { title: "会社概要｜株式会社EHCソリューションズ", description: "株式会社EHCソリューションズの会社概要。業務用空調の冷媒の入れ替え（ドロップイン）、空調更新工事、補助金を使った更新のご相談。", type: "website", locale: "ja_JP", url: "/company", images: [{ url: "/og.jpg" }] },
  twitter: { card: "summary_large_image", title: "会社概要｜株式会社EHCソリューションズ", description: "株式会社EHCソリューションズの会社概要。業務用空調の冷媒の入れ替え（ドロップイン）、空調更新工事、補助金を使った更新のご相談。", images: ["/og.jpg"] },
};

const ROWS: { label: string; value: React.ReactNode }[] = [
  { label: "会社名", value: COMPANY.name },
  { label: "代表者", value: COMPANY.representative },
  { label: "所在地", value: COMPANY.address },
  {
    label: "電話",
    value: (
      <>
        <a className="font-bold text-brand-deep underline underline-offset-4" href={COMPANY.telHref}>{COMPANY.tel}</a>
        （受付 {COMPANY.hours}）
      </>
    ),
  },
  {
    label: "メール",
    value: <a className="font-bold text-brand-deep underline underline-offset-4" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>,
  },
  {
    label: "事業内容",
    value: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>業務用空調の冷媒の入れ替え（ドロップイン）：いまの空調機を活かしたまま、冷媒を炭化水素系の冷媒へ入れ替えます</li>
        <li>空調・照明・電気・給排水・防水・内装などの工事（EHC のチームで、相談から施工までお受けします）</li>
        <li>省エネ補助金・助成金を使った更新のご相談：候補の制度と受付状況の確認、申請の準備のご支援</li>
      </ul>
    ),
  },
  /* 2026-10-29 EHC-0102 ご指示「EHC のチームとして書く」。代表者・許可は各社の公式サイト（lib/team.ts） */
  {
    label: "施工の体制",
    value: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>空調・給排水・電気設備：株式会社プロジェクトネオ（神奈川県川崎市・代表取締役 碓井涼太＝EHC 取締役）</li>
        <li>建物の設計・施工・内装：株式会社Leap（東京都中野区・代表取締役 相澤圭太＝EHC 代表取締役社長）</li>
        <li><Link href="/team" className="font-bold text-brand-deep underline underline-offset-4">メンバーと実績</Link></li>
      </ul>
    ),
  },
];

export default function CompanyPage() {
  return (
    <main id="company-main" className="mx-auto max-w-3xl px-5 pb-20 pt-8 text-ink sm:px-8">
      <p>
        <Link href="/" className="inline-flex min-h-[44px] items-center text-[16px] font-bold text-brand-deep underline underline-offset-4">
          ← EHC のトップへ
        </Link>
      </p>
      <h1 className="mt-4 text-[28px] font-bold leading-[1.5]">会社概要</h1>

      <dl className="mt-6 divide-y divide-ink-line rounded-2xl border border-ink-line bg-paper-card">
        {ROWS.map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-1 px-4 py-4 sm:grid-cols-[9em_minmax(0,1fr)] sm:gap-4 sm:px-5">
            <dt className="text-[14px] font-bold leading-[1.8] text-ink-soft">{row.label}</dt>
            <dd className="text-[16px] leading-[1.9] text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="company-start" className="mt-10 rounded-2xl border border-brand/35 bg-[#f3f8ea] p-5">
        <h2 id="company-start" className="text-[20px] font-bold leading-[1.6]">空調を発注する前に、補助金の確認を</h2>
        <p className="mt-2 text-[16px] leading-[1.9]">
          かんたんな質問に答えると、使えそうな制度・締切・「結局いくら」の目安が分かります。お名前やメールアドレスは要りません。
        </p>
        <p className="mt-4">
          <Link
            href="/shindan?from=company"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-deep px-6 text-[16px] font-bold text-white hover:bg-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            使える補助金を調べる →
          </Link>
        </p>
      </section>

      <p className="mt-8 text-[14px] leading-[1.8] text-ink-soft">
        個人情報の取扱いは<Link href="/privacy" className="mx-1 font-bold text-brand-deep underline underline-offset-4">プライバシーポリシー</Link>をご覧ください。
      </p>
    </main>
  );
}
