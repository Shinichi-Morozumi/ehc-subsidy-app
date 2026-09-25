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
  /* 2026-09-25 EHC-0043: 画面の説明文を、実際の送り方と同じ値から作る。
     サーバの DIAGNOSIS_MAIL_MODE が "send" のときだけ "on"（お客様宛にもお送りします）。
     staff / dry_run / 未設定は "off"（お客様宛のメールは送らない前提の文言）。
     どちらもビルド時の値で動くので、DIAGNOSIS_MAIL_MODE を変えたら再デプロイする。 */
  env: {
    NEXT_PUBLIC_DIAGNOSIS_CUSTOMER_MAIL:
      (process.env.DIAGNOSIS_MAIL_MODE || "").toLowerCase() === "send" ? "on" : "off",
  },
  /* 2026-09-25: サーバで作る診断書PDF（lib/serverPdf.ts）の日本語フォントを、
     診断の送信 API の関数に同梱する。fs で読むだけなので、指定しないと Vercel の関数に入らない。 */
  experimental: {
    outputFileTracingIncludes: {
      "/api/diagnosis-submit": ["./lib/fonts/**/*"],
    },
  },
  ...(process.env.EHC_DIST_DIR ? { distDir: process.env.EHC_DIST_DIR } : {}),
};

export default nextConfig;
