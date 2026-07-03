import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EHC 補助金マッチング & ROI 即答ツール",
  description: "業務用空調（パッケージ・マルチ）／ドロップイン更新工事 専用の補助金マッチング & ROI シミュレーター。EHCソリューションズ提供。",
  keywords: ["業務用エアコン", "補助金", "省エネ", "R32", "SII", "ドロップイン", "EHC"],
  robots: { index: false, follow: false }, // 営業同行ツール（URL限定共有）のため検索エンジン非掲載
  openGraph: {
    title: "EHC 補助金マッチング & ROI 即答ツール",
    description: "業務用空調の補助金マッチングとROIをその場で即答。EHCソリューションズ。",
    type: "website",
    locale: "ja_JP",
    siteName: "EHC Solutions",
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
      <body>{children}</body>
    </html>
  );
}
