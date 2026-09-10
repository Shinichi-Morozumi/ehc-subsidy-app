import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ブランドキーカラー #00A651（EHC緑）基準のスケール
        ehc: {
          50: "#e8f8ef",
          100: "#c8eed9",
          200: "#94deb4",
          300: "#5ccb8d",
          400: "#2bba6c",
          500: "#00a651",
          600: "#009148",
          700: "#00773b",
          800: "#005d2f",
          900: "#004423",
        },
        // リファレンス(ISC)準拠: ほぼ黒の背景
        night: {
          950: "#0a0a0a",
          900: "#131313",
          850: "#181818",
          800: "#1f1f1f",
          700: "#2a2a2a",
          600: "#3a3a3a",
          500: "#4a4a4a",
        },
        /* ───────────────────────────────────────────────────────
           2026-09-10 EHC-0032 LIGHT-01
           メインページ（HomeV17 / app/home-v17.css）の紙テーマを
           ツール側でも使えるようにトークン化したもの。
           値は home-v17.css を読んで写したもので、目分量ではない。
           2画面で微妙に違う白・違う緑になるのを防ぐため、ここを唯一の出所にする。

           注意1: home-v17.css は前半に初期案（2pxインク枠＋押し出し影）が残り、
           後半（357行以降・576行以降）でそれを上書きして今の見た目になっている。
           採ったのは**後半＝実際に表示されている方**である。
           すなわち「1pxの薄い罫線・大きめの角丸・影なし・セージ寄りの淡い面」。

           注意2: 変数 :root 自体が3回再定義されている（8行 → 307行 → 412行）。
           実際に効くのは**最後の412行**であり、8行目の値は死んでいる。
           ここに写したのは412行の値である。8行目を写すと、同じ「緑」でも
           #007d4c（鮮やかな緑）と #286644（くすんだ森の緑）で別物になる。

             --ink   #193e33 → ink        本文（真っ黒は使わない。濃い緑黒）
             --muted #57685e → ink-soft   補足文
             --line  #d4ddd4 → ink-line   罫線・枠線
             --paper #f6f6ed → paper      ページの地（純白でなく温かい紙色）
             #ffffff         → paper-card カードの面
             #f9faf3         → paper-sub  一段沈めた面（注記・畳んだ領域）
             #e8f0d9         → paper-tint 結論・要約の淡いセージ（.result-summary）
             #f1edce         → paper-pill バッジ・ラベルの面（.pill）
             --green  #286644 → brand        小見出し・強調の緑（.section-label と同じ）
             #254d39          → brand-deep   主ボタンの地（.question-foot .primary）
             --bright #78a747 → brand-bright 図・アイコンのオリーブ
             #7b9c4a          → brand-olive  進捗・達成（.progress span.done）
             --yellow #d6ee86 → brand-lime   CTA の地（.primary はライム＋インク文字）

           コントラスト（白地）: brand #286644 は 6.6、ink #193e33 は 12.6 で本文可。
           brand-olive/bright/lime は 3 前後なので**面にだけ使い、文字色には使わない**。
           ehc-* スケールは今までどおり残すが、画面の緑は原則この brand を使う。
           ehc-500(#00a651) はロゴのキーカラーであり、紙面の地に置くと浮くため
           ロゴ・アイコンのグラデーション以外には広げない。
           ─────────────────────────────────────────────────────── */
        ink: {
          DEFAULT: "#193e33",
          soft: "#57685e",
          line: "#d4ddd4",
        },
        paper: {
          DEFAULT: "#f6f6ed",
          card: "#ffffff",
          sub: "#f9faf3",
          tint: "#e8f0d9",
          pill: "#f1edce",
        },
        brand: {
          DEFAULT: "#286644",
          deep: "#254d39",
          bright: "#78a747",
          olive: "#7b9c4a",
          lime: "#d6ee86",
        },
        // アクセント: 深いコバルトブルー(#2D4295)
        cobalt: {
          50: "#eef1fb",
          100: "#d7def4",
          200: "#aebde9",
          300: "#7f95d9",
          400: "#5a72c5",
          500: "#3d54aa",
          600: "#2d4295",
          700: "#243578",
          800: "#1c285c",
          900: "#141d42",
        },
      },
      /* 2026-09-10 EHC-0032 LIGHT-01
         影はダークテーマ用に黒を 0.3〜0.7 の濃さで敷いていた。白い紙の上で
         同じ濃さを使うと、影ではなく灰色の帯として見えて紙面が濁る。
         HomeV17 と同じ「ほとんど影を使わない・使うときは広く薄く」に置き換える。
         クラス名は 600 箇所以上で参照されているので変えない（値だけ差し替える）。
         glow はダーク前提の発光なので、白地では下に落ちる緑の淡い影に読み替える。 */
      boxShadow: {
        soft: "0 1px 2px 0 rgb(25 62 51 / 0.05)",
        card: "0 6px 18px -8px rgb(25 62 51 / 0.14)",
        lift: "0 14px 45px -14px rgb(7 28 21 / 0.22)",
        glow: "0 10px 30px -12px rgb(40 102 68 / 0.35)",
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Hiragino Sans', 'Yu Gothic', 'sans-serif'],
        display: ['Archivo', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
export default config;
