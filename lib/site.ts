/* ───────────────────────────────────────────────────────────
   サイトの正式なURL（2026-09-26）

   ehcjpn.com は株式会社EHCソリューションズの会社のドメインで、2026-09-17 ごろから
   このアプリ（空調更新と補助金の候補診断）をそのまま配信している。
   検索エンジンへの掲載・共有用の画像・サイトの地図（sitemap.xml）・構造化データは
   すべてこのURLを正とする。

   ehc-subsidy-app.vercel.app（営業同行ツールだったころのURL）は、
   営業先に送ったリンクを壊さないため残し、検索には出さない（next.config.mjs の headers）。
   ─────────────────────────────────────────────────────────── */

export const SITE_URL = "https://ehcjpn.com";

/** 検索に出さない旧URLのホスト名（本番の別名）。プレビューのURLは Vercel が自動で検索対象外にする。 */
export const LEGACY_APP_HOST = "ehc-subsidy-app.vercel.app";
