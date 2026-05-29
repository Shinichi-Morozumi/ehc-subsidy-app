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
          primary: "#0a5d3f",
          accent: "#1a8a5a",
          light: "#e6f0eb",
          warm: "#fff5e6",
          warning: "#b8650a",
          danger: "#d9534f",
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Hiragino Sans', 'Yu Gothic', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
