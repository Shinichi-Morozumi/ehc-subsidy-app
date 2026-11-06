import type { Metadata } from "next";
import { todayJst } from "@/lib/programClock";
import { ZeroemiPage } from "@/components/zeroemi/ZeroemiPage";

/* v2 / 2026-11-06 / EHC-0150 ゼロエミ専用ページ（1ページ＋切り替え。ここは空調・照明などの表示で開く）。広告の遷移先・東京都内の事業者向け。
   締切の表示は今日の日付で決まるので、1時間ごとに作り直す。 */
export const revalidate = 3600;

const TITLE = "空調の入れ替えに東京都の補助金「ゼロエミ」最大3/4｜使えるか1分で確認";
const DESCRIPTION =
  "都内の事業所の空調・換気・LED照明・給湯、冷凍冷蔵庫・ショーケースの入れ替えに使える東京都のゼロエミ（冷凍冷蔵はノンフロン機器の助成も）。助成は最大3/4・上限4,500万円。第6回（今年度の最終回）の締切は2027年1月29日（金）17時。5つの質問で、使えるか・ほかの補助と併用できるかを確かめて、そのまま相談・Zoom面談の予約ができます。株式会社EHCソリューションズ。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/zeroemi" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/zeroemi/kucho-hero.webp"] },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ja_JP", url: "/zeroemi", images: [{ url: "/zeroemi/kucho-hero.webp", width: 1536, height: 1024, alt: "天井に業務用エアコンが並ぶ明るいオフィス（イメージ）" }] },
};

export default function ZeroemiKuchoPage() {
  return <ZeroemiPage kind="kucho" today={todayJst()} />;
}
