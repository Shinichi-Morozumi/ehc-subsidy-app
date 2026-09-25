# lib/fonts（サーバで作る診断書PDFの日本語フォント）

- BIZUDPGothic-Regular.ttf / BIZUDPGothic-Bold.ttf
  - 書体: BIZ UDPゴシック（モリサワ BIZ UD Gothic Project）
  - 取得元: https://github.com/google/fonts/tree/main/ofl/bizudpgothic （2026-09-25 取得）
  - ライセンス: SIL Open Font License 1.1（同じフォルダの OFL.txt）。予約フォント名（Reserved Font Name）の指定なし。
    PDFに埋め込んで配布すること、アプリに同梱することはライセンスの範囲内。フォント単体を販売しないこと。
- 使っている場所: lib/serverPdf.ts（app/api/diagnosis-submit から呼ぶ）
- Vercel の関数に同梱する設定: next.config.mjs の experimental.outputFileTracingIncludes
