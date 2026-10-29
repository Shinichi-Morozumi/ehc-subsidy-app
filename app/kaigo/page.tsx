import type { Metadata } from "next";
import { KaigoChat } from "@/components/kaigo/KaigoChat";
import { KaigoPrograms } from "@/components/programs/KaigoPrograms";
import { todayJst } from "@/lib/programClock";

/* ───────────────────────────────────────────────────────────
   介護施設向け 補助金の事前確認（2026-10-01 EHC-0056）

   紙のパンフ（A4・二つ折り）の QR の飛び先。QR は紹介元ごとに ?ref=コード を付けて配る
   （紹介コードの台帳はパンフの xlsx「1_紹介コード台帳」）。画面と送信の決め事は lib/kaigo.ts。
   検索にも出してよいページ（会社のドメインの一般向けの案内）。正規URLは ?ref なしの /kaigo。
   ─────────────────────────────────────────────────────────── */

const TITLE = "介護施設の補助金 事前確認（空調・給排水・防水などの大規模修繕に国の補助10/10）";
const DESCRIPTION =
  "定員29人以下の介護施設は、空調・照明・電気・給排水・防水・バリアフリーなどの大規模修繕に国の補助10/10（上限まで）の制度があります。7つの質問で、使えそうな補助と次にやることを確認できます。工事も設備も EHC のチームでお受けします。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/kaigo" },
  /* 2026-10-29 ブラッシュアップ6：SNS で共有したときに、トップの説明文ではなくこのページの説明文を出す */
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/kaigo/hero.jpg"] },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "ja_JP",
    url: "/kaigo",
    images: [{ url: "/kaigo/hero.jpg", width: 1600, height: 900, alt: "猛暑の日の介護施設と、涼しい室内のイラスト" }],
  },
};

/* 2026-10-29 EHC-0102: チャットの下に国の交付金の制度カードを足した。残り日数などに今日を使うので1時間ごとに作り直す。 */
export const revalidate = 3600;

export default function KaigoPage() {
  return (
    <KaigoChat>
      <KaigoPrograms initialToday={todayJst()} />
    </KaigoChat>
  );
}
