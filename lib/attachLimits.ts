/* v1 / 2026-10-29 / EHC-0102 相談フォームの添付（写真・PDF）の決め事。画面と受け口の両方が読む（ご指示「写真、PDF 送れるように」）。

   ・Vercel の関数が受け取れる大きさは 1回 4.5MB まで。送るときは中身を文字（base64）にするので約1.34倍になる。
   　→ 添付の合計は 3.2MB まで。写真は画面で長い辺 1600px の JPEG に縮めてから送る（1枚 0.3〜0.6MB ほど）。
   ・送れるのは写真（JPEG・PNG・WEBP・HEIC）と PDF だけ。中身の先頭のバイトで確かめる（拡張子だけを信じない）。
   ・添付は担当者宛のメールに付けて届ける。サイトやデータベースには保存しない。 */

export const ATTACH_MAX_FILES = 5;
export const ATTACH_MAX_TOTAL_BYTES = 3_200_000;
export const ATTACH_PHOTO_MAX_EDGE = 1600;
export const ATTACH_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

export function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1000))}KB`;
}
