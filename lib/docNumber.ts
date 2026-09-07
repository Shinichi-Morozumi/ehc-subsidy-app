/* ───────── 診断書番号の発行 ─────────
   2026-08-24 監査で発見した事故:
     components/CustomerReport.tsx が
       `EHC-${年}${月}${日}`
     という日付だけの番号を使っていた。同じ日に発行した診断書は、
     顧客が違っても番号が完全に同一で、添付PDFのファイル名まで同名だった。
     「EHC-20260824 の診断書」と言われても、どの案件か特定できない。

   形式: EHC-YYYYMMDD-HHMMSS-XXXX
     XXXX は crypto 由来の4桁乱数（同一秒に発行しても衝突確率 1/923,521）
   例: EHC-20260824-114233-7K2Q */

/** 紛らわしい文字（I / O / 0 / 1 / U）を除いた集合。口頭・手書きで取り違えない。 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTVWXYZ";

function randomSuffix(len: number): string {
  const g = typeof globalThis !== "undefined"
    ? (globalThis as { crypto?: Crypto }).crypto
    : undefined;
  const bytes = new Uint8Array(len);
  if (g && typeof g.getRandomValues === "function") {
    g.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** 診断書番号を発行する。日付部分はJSTで固定する（海外からの閲覧でもズレない）。 */
export function issueDocumentNumber(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const ymd = `${get("year")}${get("month")}${get("day")}`;
  const hms = `${get("hour")}${get("minute")}${get("second")}`;
  return `EHC-${ymd}-${hms}-${randomSuffix(4)}`;
}

/** PDFのファイル名。番号をそのまま含めるので、メール添付時に同名衝突しない。 */
export function documentFileName(docNumber: string): string {
  return `補助金省エネ診断書_${docNumber}.pdf`;
}
