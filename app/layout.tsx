import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "EHC 空調更新 補助金・助成金マッチング",
  description: "業務用空調の更新時に、申請可能性のある補助金・助成金と受付期限、次に必要な準備を確認する診断ツール。",
  keywords: ["業務用エアコン", "補助金", "省エネ", "R32", "SII", "ドロップイン", "EHC"],
  robots: { index: false, follow: false }, // 営業同行ツール（URL限定共有）のため検索エンジン非掲載
  openGraph: {
    title: "EHC 空調更新 補助金・助成金マッチング",
    description: "業務用空調の更新時に、候補制度と期限、次に必要な準備を確認。",
    type: "website",
    locale: "ja_JP",
    siteName: "EHC Solutions",
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00a651",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
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
