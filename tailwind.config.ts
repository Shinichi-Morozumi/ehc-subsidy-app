import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ehc: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
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
        glow: "0 0 40px -8px rgb(45 66 149 / 0.45)",
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
