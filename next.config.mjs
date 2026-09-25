/** @type {import('next').NextConfig} */
/* EHC_DIST_DIR を渡したときだけ出力先を差し替える（2026-09-16 EHC-0039）。

   理由。検証用に next build を走らせると既定の .next を作り直すが、
   同じ .next を next dev / next start が読んでいる最中に作り直すと、
   動作中の画面が壊れる（チャンクが消えた状態で配信される）。
   検証のたびに動いている画面を落とすのは避けたいので、
   ランチャー側から EHC_DIST_DIR=/tmp/… を渡して別の場所へ吐かせる。

   環境変数が無いときは従来どおり .next。既定の挙動は変えていない。

   渡す値はプロジェクト直下からの相対パスにすること。
   v27 で "/tmp/ehc0039_dist_v27" を渡したところ、Next.js が
   プロジェクト直下と結合して <app>/tmp/ehc0039_dist_v27 へ吐いた。
   .next は壊れなかったが、アプリの中に検証用のフォルダが残る。
   ".next-verify" のように相対で渡し、使い終わったら消す。 */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.EHC_DIST_DIR ? { distDir: process.env.EHC_DIST_DIR } : {}),
};

export default nextConfig;
