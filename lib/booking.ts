/* ───────────────────────────────────────────────────────────
   v2 / 2026-10-23 / EHC-0089: 旧予約URLの互換口。
   旧環境変数が残っていても自動予約へ誘導しない。
   現行画面・メールはconsultation.ts（Zoom・候補3件・折り返し）を使う。
   ─────────────────────────────────────────────────────────── */

export function bookingUrlFrom(raw: string | undefined | null): string | null {
  // v2 / 2026-10-23 / EHC-0089: 旧環境変数が残っていても自動予約へ誘導しない。
  void raw;
  return null;
}

/** メール本文に足す行（URL が無ければ空） */
export function bookingMailLines(url: string | null): string[] {
  void url;
  return [];
}
