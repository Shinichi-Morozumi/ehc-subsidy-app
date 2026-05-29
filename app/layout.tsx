import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EHC 補助金マッチング & ROI 即答ツール",
  description: "業務用空調（パッケージ・マルチ）／ドロップイン更新工事 専用の補助金マッチング & ROI シミュレーター。EHCソリューションズ提供。",
  keywords: ["業務用エアコン", "補助金", "省エネ", "R32", "SII", "ドロップイン", "EHC"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
