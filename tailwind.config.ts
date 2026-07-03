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
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.3)",
        card: "0 4px 16px -2px rgb(0 0 0 / 0.5)",
        lift: "0 18px 40px -12px rgb(0 0 0 / 0.7)",
        glow: "0 0 40px -8px rgb(0 166 81 / 0.45)",
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
