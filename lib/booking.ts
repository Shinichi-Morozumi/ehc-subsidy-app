/* ───────────────────────────────────────────────────────────
   打ち合わせの予約ページ（2026-09-26 改善7）

   Google カレンダーの「予約スケジュール」の公開ページのURLを、Vercel の環境変数
   NEXT_PUBLIC_BOOKING_URL に入れると、次の3か所に「日時を選ぶ」が出る。
   　・相談を送ったあとの画面（このあとの流れ）
   　・担当者宛メールの「転送用の文面」
   　・お客様宛の自動メール（DIAGNOSIS_MAIL_MODE=send のとき）
   入れていない間は、どこにも出ない。NEXT_PUBLIC_ はビルドのときに焼き込まれるので、変えたら再デプロイする。
   https:// で始まらない値は使わない（書き間違いで変なリンクを出さないため）。
   ─────────────────────────────────────────────────────────── */

export function bookingUrlFrom(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  if (!/^https:\/\/[^\s<>"']+$/.test(v)) return null;
  return v;
}

/** メール本文に足す行（URL が無ければ空） */
export function bookingMailLines(url: string | null): string[] {
  if (!url) return [];
  return ["", "■ ご相談の日時のご予約", "担当者との打ち合わせ（お電話・オンライン）の日時を、空いている時間から選べます。", url];
}
