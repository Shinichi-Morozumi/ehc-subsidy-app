import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

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
        {/* サイト全体の斜め透かし（スクショ・無断共有の抑止・画面のみ） */}
        <div className="site-watermark" aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>{"EHC SOLUTIONS ｜ 社外秘 ｜ 無断複製・転載禁止　".repeat(4)}</div>
          ))}
        </div>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
