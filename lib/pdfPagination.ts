// v1 / 2026-10-23 / EHC-0089: 行・表の途中を切らないページ計画。画像座標は整数。
export interface PdfKeepRange { top: number; bottom: number }
export function planPdfSlices(height: number, capacity: number, ranges: PdfKeepRange[]): Array<{ top: number; height: number }> {
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(capacity) || capacity < 1) throw new Error("PDFの寸法が不正です。");
  const max = Math.floor(capacity);
  const keep = ranges.filter(r => Number.isFinite(r.top) && Number.isFinite(r.bottom) && r.bottom > r.top && r.bottom - r.top < max)
    .map(r => ({ top: Math.max(0, Math.floor(r.top)), bottom: Math.min(height, Math.ceil(r.bottom)) }));
  const pages: Array<{ top: number; height: number }> = [];
  let start = 0;
  while (start < height) {
    if (pages.length >= 60) throw new Error("PDFが60ページを超えます。内容をご確認ください。");
    let end = Math.min(height, start + max);
    if (end < height) {
      let previous;
      do {
        previous = end;
        for (const r of keep) if (r.top < end && r.bottom > end) end = Math.min(end, r.top);
      } while (end !== previous);
    }
    if (end <= start) throw new Error("1ページに収まらない行があります。PDFのレイアウトをご確認ください。");
    pages.push({ top: start, height: end - start });
    start = end;
  }
  return pages;
}
