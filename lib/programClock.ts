/* ───────── 制度の「今日」を決める唯一の場所 ─────────
   2026-08-24 監査で発見した事故:
     lib/subsidies.ts の STATUS_REFERENCE_DATE = "2026-08-18" と
     components/ProgramMatchBoard.tsx の REFERENCE_NOW = new Date("2026-08-18T12:00:00+09:00")
     がビルド時に凍結されており、締切を過ぎた制度を「受付中」と表示し続けていた。
     時間が経つほど嘘が増える種類のバグなので、時刻の出どころをこのファイル1つに集約する。

   ルール:
     - 制度の受付状態（open / upcoming / closed）は必ず「実行時のJSTの今日」で判定する
     - officialCheckedAt（人が公式ページを確認した日時）は固定リテラルのままでよい。
       あれは「いつ確認したか」の記録であって「今日」ではない。 */

/** JSTの今日を YYYY-MM-DD で返す。en-CA ロケールは YYYY-MM-DD 固定なので書式が崩れない。 */
export function todayJst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** JSTの「今この瞬間」。ProgramMatchBoard の残日数計算などに使う。 */
export function nowJst(): Date {
  return new Date();
}

/** YYYY-MM-DD の日付をJSTの正午として Date にする（日付境界での±1日ズレを避ける）。 */
export function jstDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+09:00`);
}

/** 2つの YYYY-MM-DD の日数差（to − from）。 */
export function daysBetween(from: string, to: string): number {
  return Math.round((jstDate(to).getTime() - jstDate(from).getTime()) / 86_400_000);
}

/** 締切までの残日数。締切未設定なら null、過ぎていれば負の数。 */
export function daysUntilClose(applyClose?: string, now: Date = new Date()): number | null {
  if (!applyClose) return null;
  return daysBetween(todayJst(now), applyClose);
}
