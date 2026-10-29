/* ───────────────────────────────────────────────────────────
   紹介リンクを端末で覚える（画面側）2026-10-14 PJ-20261013-EHC-0070。決め事は lib/referral.ts。

   ・URL に ?ref= があれば覚え直す（最後に開いた有効な紹介リンクを優先）。
   　表にある紹介リンクは、いつでも上書きする。表に無いコードは、表にある紹介リンクを覚えていないときだけ覚える
   　（紹介元のチラシから来た人が、別の怪しいリンクで帰属を奪われないように）。
   ・保存先は 端末（localStorage・30日）→ このタブ（sessionStorage）→ このページの中（メモリ）の順。
   　保存を断られる端末でも、同じタブの中で送信まで運ぶ。再読み込みしても URL に ?ref= が残っていれば覚え直す。
   ・ここには お名前・連絡先・自由記述を入れない。覚えるのは コード・着いた時刻・着いたページ だけ。
   ─────────────────────────────────────────────────────────── */

import { isFreshClaim, landingOf, referralLinkOf, sanitizeRef, type ReferralClaim } from "./referral";

export const REFERRAL_STORAGE_KEY = "ehc_ref";

let memory: ReferralClaim | null = null;

type StoreName = "localStorage" | "sessionStorage";

function storage(name: StoreName): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window[name];
  } catch {
    return null;
  }
}

function readFrom(name: StoreName, now: number): ReferralClaim | null {
  try {
    const raw = storage(name)?.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ReferralClaim>;
    const claim: ReferralClaim = { ref: sanitizeRef(v.ref) ?? "", landedAt: String(v.landedAt ?? ""), landing: landingOf(v.landing) };
    return isFreshClaim(claim, now) ? claim : null;
  } catch {
    return null;
  }
}

function writeAll(claim: ReferralClaim): void {
  memory = claim;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      storage(name)?.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(claim));
    } catch {
      /* 保存を断られても、このページの中（memory）では運ぶ */
    }
  }
}

/** いま有効な紹介リンク（無ければ null）。メモリ → このタブ → 端末 の順に見る。 */
export function currentReferral(now: number = Date.now()): ReferralClaim | null {
  if (isFreshClaim(memory, now)) return memory;
  for (const name of ["sessionStorage", "localStorage"] as const) {
    const hit = readFrom(name, now);
    if (hit) {
      memory = hit;
      return hit;
    }
  }
  return null;
}

/** ページを開いたときに呼ぶ。URL の ?ref= を見て覚え直し、いま有効な紹介リンクを返す。 */
export function captureReferral(search: string, pathname: string, now: number = Date.now()): ReferralClaim | null {
  let ref: string | null = null;
  try {
    ref = sanitizeRef(new URLSearchParams(search).get("ref"));
  } catch {
    ref = null;
  }
  const existing = currentReferral(now);
  if (ref) {
    const known = !!referralLinkOf(ref);
    const existingKnown = !!(existing && referralLinkOf(existing.ref));
    if (known || !existingKnown) {
      const claim: ReferralClaim = { ref, landedAt: new Date(now).toISOString(), landing: landingOf(pathname) };
      writeAll(claim);
      return claim;
    }
  }
  return existing;
}

/** 試験用：覚えている内容を消す */
export function resetReferralMemoryForTest(): void {
  memory = null;
}
