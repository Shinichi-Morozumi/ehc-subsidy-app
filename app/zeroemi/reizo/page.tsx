import type { Metadata } from "next";
import { todayJst } from "@/lib/programClock";
import { ZeroemiPage } from "@/components/zeroemi/ZeroemiPage";

/* v2 / 2026-11-06 / EHC-0150 ゼロエミ専用ページを冷凍冷蔵庫・ショーケースの表示で開く入口（中身は /zeroemi と同じ1ページ。上で切り替えられる）。
   広告で冷凍冷蔵だけに飛ばしたいときに使う。【1】ゼロエミと【2】ノンフロン機器。 */
export const revalidate = 3600;

const TITLE = "冷凍冷蔵庫・ショーケースの入れ替えに東京都の助成 最大3/4｜使えるか1分で確認";
const DESCRIPTION =
  "都内のお店・工場・倉庫の冷凍冷蔵庫・ショーケースの入れ替えに使える東京都の2つの制度（ゼロエミ 最大3/4・ノンフロン機器 1台最大6,700万円）。締切はゼロエミ第6回 2027年1月29日（金）17時、ノンフロン 2027年3月31日（水）17時（予算に達したら終了）。5つの質問で、使えるか・ほかの補助と併用できるかを確かめて、そのまま相談・Zoom面談の予約ができます。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/zeroemi/reizo" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/zeroemi/reizo-hero.webp"] },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ja_JP", url: "/zeroemi/reizo", images: [{ url: "/zeroemi/reizo-hero.webp", width: 1536, height: 1024, alt: "冷蔵ショーケースが並ぶお店の通路（イメージ）" }] },
};

export default function ZeroemiReizoPage() {
  return <ZeroemiPage kind="reizo" today={todayJst()} />;
}
