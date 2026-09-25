/* ───────────────────────────────────────────────────────────
   診断の送信口の連続送信制限（EHC-0043 / 2026-09-25 v1）

   ■ 何を防ぐか
   　　診断の送信口は、実送信の設定（DIAGNOSIS_MAIL_MODE=staff / send）にすると
   　　EHC の Gmail から実際にメールを出す。機械的に連打されると、
   　　担当者の受信箱が埋まり、Gmail の1日の送信上限に触れて
   　　ほかの送信（提案書の送付）まで止まる。

   ■ 決めたこと
   　　1つの接続元（IP）から1時間に5件まで。人の再送はこれで足りる。
   　　上限に触れた要求は送らずに 429 で返す（台帳にも触れない）。

   ■ 限界（黙らない）
   　　記録はプロセス内のメモリにある。サーバが複数に分かれたり
   　　入れ替わったりすると、上限は実質的に緩くなる。
   　　ここで止めたいのは単純な連打であり、分散した攻撃は防げない。
   ─────────────────────────────────────────────────────────── */

export const SUBMIT_RATE_WINDOW_MS = 60 * 60 * 1000;
export const SUBMIT_RATE_MAX = 5;

const hits = new Map<string, number[]>();

/** 接続元の目印。Vercel では x-forwarded-for の先頭がお客様側のIP。 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = (headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const key = forwarded || (headers.get("x-real-ip") || "").trim() || "unknown";
  return key.slice(0, 64);
}

/** 上限を超えていれば true（このときは記録を増やさない）。超えていなければ1件記録して false。 */
export function overSubmitRateLimit(key: string, now: number = Date.now()): boolean {
  const recent = (hits.get(key) || []).filter((t) => now - t < SUBMIT_RATE_WINDOW_MS);
  if (recent.length >= SUBMIT_RATE_MAX) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  /* 放っておくと接続元の数だけ増え続けるので、古い記録を時々掃除する。 */
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < SUBMIT_RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

/** テスト用。記録を空にする。 */
export function resetSubmitRateLimit(): void {
  hits.clear();
}
