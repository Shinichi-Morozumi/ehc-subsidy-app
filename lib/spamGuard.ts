/* ───────────────────────────────────────────────────────────
   迷惑な送信の見分け（2026-09-26 改善13）

   これまで相談フォームの守りは「1つの接続元から1時間に5件まで」（lib/submitRateLimit.ts）だけだった。
   検索に出すと、フォームを機械的に埋めて送るプログラム（ボット）も来る。
   お客様の手間を増やさない、次の2つだけを足す。

   1. 人には見えない欄（ハニーポット）
   　　画面の外に置いた入力欄。人は見えないので触らない。機械は全部の欄を埋めがちなので、
   　　ここに何か入っていたら人の送信ではない。
   2. 開いてから送るまでの時間
   　　お名前・メール・同意を入れるには、人なら数秒かかる。3秒未満の送信は機械的とみなす。
   　　時間が付いていない送信（古い画面から）は、この確認をしない（止めない）。

   どちらも「黙って捨てる」ことはしない。万一お客様の送信を取り違えたときに、
   受け付けたつもりのまま相談が消えるのを避けるため、画面に理由を返す（電話の案内つき）。
   ─────────────────────────────────────────────────────────── */

export const MIN_ELAPSED_MS = 3000;
/** 欄が少ないフォーム（公募のお知らせ：メールと同意だけ）の下限。入力の自動補完で速く済む人を止めないよう短くする */
export const MIN_ELAPSED_MS_SHORT_FORM = 1500;

export type SpamReason = "honeypot" | "too_fast";

export function spamReasonOf(
  input: { hp?: unknown; elapsedMs?: unknown },
  minElapsedMs: number = MIN_ELAPSED_MS
): SpamReason | null {
  if (typeof input.hp === "string" && input.hp.trim() !== "") return "honeypot";
  const ms = input.elapsedMs;
  if (typeof ms === "number" && Number.isFinite(ms) && ms >= 0 && ms < minElapsedMs) return "too_fast";
  return null;
}

/** 画面に返す文。too_fast は押し直せば通る。honeypot は電話へ案内する。 */
export function spamMessage(reason: SpamReason, tel: string): string {
  return reason === "too_fast"
    ? "送信までの時間が短すぎたため、受け付けできませんでした。お手数ですが、もう一度送信ボタンを押してください。"
    : `送信を受け付けできませんでした。お手数ですが、お電話（${tel}）でご連絡ください。`;
}
