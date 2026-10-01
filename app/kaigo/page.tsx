import type { Metadata } from "next";
import { KaigoChat } from "@/components/kaigo/KaigoChat";

/* ───────────────────────────────────────────────────────────
   介護施設向け 補助金の事前確認（2026-10-01 EHC-0056）

   紙のパンフ（A4・二つ折り）の QR の飛び先。QR は紹介元ごとに ?ref=コード を付けて配る
   （紹介コードの台帳はパンフの xlsx「1_紹介コード台帳」）。画面と送信の決め事は lib/kaigo.ts。
   検索にも出してよいページ（会社のドメインの一般向けの案内）。正規URLは ?ref なしの /kaigo。
   ─────────────────────────────────────────────────────────── */

const TITLE = "介護施設の補助金 事前確認（空調の入れ替え・国の補助10/10）";
const DESCRIPTION =
  "定員29人以下の介護施設は、空調の入れ替えなどの改修に国の補助10/10（上限まで）の制度があります。7つの質問で、使えそうな補助と次にやることを確認できます。株式会社EHCソリューションズ。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/kaigo" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "ja_JP",
    url: "/kaigo",
    images: [{ url: "/kaigo/hero.jpg", width: 1600, height: 900, alt: "猛暑の日の介護施設と、涼しい室内のイラスト" }],
  },
};

export default function KaigoPage() {
  return <KaigoChat />;
}
