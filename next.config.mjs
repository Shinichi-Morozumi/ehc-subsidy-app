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
    /* 2026-09-26 改善11: 写真の読み取り（app/api/read-photo）。API キーがあるときだけ画面にボタンを出す。
       キーの値そのものは画面に渡さない（有無だけ）。キーを入れた・消したら再デプロイする。 */
    NEXT_PUBLIC_PHOTO_READ: process.env.ANTHROPIC_API_KEY ? "on" : "off",
  },
  /* 2026-09-25: サーバで作る診断書PDF（lib/serverPdf.ts）の日本語フォントを、
     診断の送信 API の関数に同梱する。fs で読むだけなので、指定しないと Vercel の関数に入らない。 */
  experimental: {
    outputFileTracingIncludes: {
      "/api/diagnosis-submit": ["./lib/fonts/**/*"],
    },
  },
  /* 2026-09-26 改善2: 以前のホームページ（Wix）のURLで、検索結果に残っているものを新しいページへ転送する。
     確認できたのは www.ehcjpn.com/privacy-policy（検索結果に残っていた）。www は Vercel が ehcjpn.com へ 308 で送るので、
     ここでは ehcjpn.com/privacy-policy → /privacy だけを書けばよい。見つかったら足す。
     それ以外の古いURLは、日本語の「ページが見つかりません」（app/not-found.tsx）からトップ・会社概要へ案内する。 */
  async redirects() {
    return [
      { source: "/privacy-policy", destination: "/privacy", permanent: true },
      { source: "/privacy-policy/", destination: "/privacy", permanent: true },
      /* 2026-10-29 EHC-0102: ドロップインのチラシの QR（/?ref=krh01-dropin）は、刷り直さずに専用ページへ送る。?ref= はそのまま付いていく */
      { source: "/", has: [{ type: "query", key: "ref", value: "krh01-dropin" }], destination: "/dropin", permanent: false },
    ];
  },
  /* 2026-09-26 改善1: 旧URL（ehc-subsidy-app.vercel.app）は検索に出さない。
     転送（リダイレクト）にしないのは、ehcjpn.com の DNS 切替の途中でも営業先に送ったリンクが開けるようにするため。
     担当者用の画面と API は、どのホストでも検索に出さない（ページ側の noindex と二重）。 */
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", has: [{ type: "host", value: "ehc-subsidy-app.vercel.app" }], headers: noindex },
      { source: "/kanri/:path*", headers: noindex },
      { source: "/unlock", headers: noindex },
      { source: "/api/:path*", headers: noindex },
    ];
  },
  ...(process.env.EHC_DIST_DIR ? { distDir: process.env.EHC_DIST_DIR } : {}),
};

export default nextConfig;
