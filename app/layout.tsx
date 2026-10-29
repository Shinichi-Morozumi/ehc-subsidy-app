import type { Metadata } from "next";
import "./globals.css";
/* v17 ホームの見た目。全セレクタが .ehc17 配下にスコープされているため、
   既存のダークテーマ（globals.css）と診断ツール側の表示には影響しない。 */
import "./home-v17.css";
import { PwaRegister } from "@/components/PwaRegister";
import { COMPANY } from "@/lib/company";
import { SITE_URL } from "@/lib/site";

/* ───────────────────────────────────────────────────────────
   2026-09-26 改善1・3: 会社のドメイン（ehcjpn.com）で公開しているので、検索に出す。
   以前は「営業同行ツール（URL限定共有）」として robots に index:false を入れていた。
   その設定のまま ehcjpn.com で配信していたため、会社名で検索しても会社のサイトが出なくなるところだった。
   ・検索に出す：このサイトの全ページ（既定）。
   ・出さない：担当者用の画面（/kanri・/unlock はページ側で noindex）、旧URL（ehc-subsidy-app.vercel.app。
     next.config.mjs の headers で X-Robots-Tag を付ける）、プレビュー（Vercel が自動で付ける）。
   ・題名は会社名が分かる形に、共有したときの画像（/og.jpg・1200×630）を付ける。
   ─────────────────────────────────────────────────────────── */
/* 2026-10-29 EHC-0102 直し2回目：「無料」は書かない（景品表示法の決め）・質問の数は書かない（何の数か分からない） */
const SITE_TITLE = "空調の入れ替えに使える補助金を、締切の近い順に｜株式会社EHCソリューションズ";
const SITE_DESCRIPTION =
  "事務所・店舗・工場・病院・介護施設の、空調と設備の入れ替えに使える国・東京都・介護施設の補助金。何に使えるか・いつまでか・結局いくらを1枚のカードで。かんたんな質問に答えると、使えそうな制度を締切の近い順に出します。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s｜${COMPANY.name}` },
  description: SITE_DESCRIPTION,
  keywords: ["業務用エアコン", "空調更新", "補助金", "省エネ補助金", "SII", "ドロップイン", "冷媒", "EHCソリューションズ"],
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "ja_JP",
    siteName: COMPANY.name,
    url: SITE_URL,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "空調を発注する前に、補助金の確認を。株式会社EHCソリューションズ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.jpg"],
  },
  appleWebApp: {
    capable: true,
    title: "EHC補助金",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

/* 検索結果に会社の情報（名前・所在地・電話）を正しく出すための構造化データ。値は lib/company.ts の1か所から作る。
   郵便番号は確かな出典が無いので入れない（lib/company.ts のコメント参照）。 */
const ORGANIZATION_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: COMPANY.name,
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  email: COMPANY.email,
  telephone: "+81-3-5937-4340",
  address: {
    "@type": "PostalAddress",
    addressCountry: "JP",
    addressRegion: "東京都",
    addressLocality: "中野区",
    streetAddress: "弥生町1丁目9-8 トーソービル4F",
  },
});

/* Vercel Web Analytics のカスタムイベント（lib/track.ts）用。計測スクリプトが読み込まれるまで、
   window.va に渡された記録を window.vaq に貯めておく（@vercel/analytics の inject() と同じ形）。 */
const VA_QUEUE = "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(Array.prototype.slice.call(arguments))};";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00a651",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <script dangerouslySetInnerHTML={{ __html: VA_QUEUE }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORGANIZATION_JSON_LD }} />
        {children}
        <PwaRegister />
        {/* Vercel Web Analytics（Hobby枠）。@vercel/analytics を入れると package-lock.json と
            ズレて Vercel の npm ci が落ちるため、パッケージが注入するのと同じ計測スクリプトを直接読む。
            /_vercel/insights/ は Vercel のエッジが配信するので、ローカル開発では404になるが実害はない。 */}
        <script defer src="/_vercel/insights/script.js" />
      </body>
    </html>
  );
}
