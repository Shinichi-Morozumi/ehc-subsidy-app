import type { MetadataRoute } from "next";

// PWAマニフェスト（営業担当がスマホのホーム画面に追加して使う想定）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EHC 補助金マッチング & ROI 即答ツール",
    short_name: "EHC補助金",
    description:
      "業務用空調の補助金マッチングとROIをその場で即答。EHCソリューションズ営業支援ツール。",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#00a651",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
