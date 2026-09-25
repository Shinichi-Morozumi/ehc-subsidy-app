/* ───────────────────────────────────────────────────────────
   お客様宛（自動送付）の書類に載せる名前・会社名の下ごしらえ（2026-09-25）

   お客様宛の自動送付（DIAGNOSIS_MAIL_MODE=send）は「入力されたメールアドレスへ、
   EHC のメールで送る」。名前欄や会社名欄に URL やメールアドレスを書かれると、
   EHC の名義で第三者へリンクを送る踏み台になり得る。
   そこで、お客様宛の本文と診断書PDFに載せる名前・会社名からだけ、
   リンクになり得る部分（URL・www.〜・ドメインらしい語・メールアドレス）と山括弧を除く。

   担当者宛（社内）には入力のまま載せる（何が入力されたかを担当者が見られるように）。
   ─────────────────────────────────────────────────────────── */

import type { DiagnosisContact } from "./diagnosisSnapshot";

const URL_RE = /(?:https?|ftp):\/\/\S+/gi;
const WWW_RE = /\bwww\.\S+/gi;
const MAIL_RE = /[^\s@<>()（）]+@[^\s@<>()（）]+/g;
/* 「example.com」「foo.co.jp」のような語。社名の「Co.,Ltd.」「Inc.」は2文字以上のラベルが続かないので残る */
const DOMAIN_RE = /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.(?:[a-z]{2,24})(?:\/\S*)?\b/gi;

/** リンクになり得る部分を除いた文字列（前後の空白は詰める） */
export function stripLinks(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(URL_RE, "")
    .replace(WWW_RE, "")
    .replace(MAIL_RE, "")
    .replace(DOMAIN_RE, (m) => (/\.(?:co|inc|ltd|corp|llc)\.?$/i.test(m) ? m : ""))
    .replace(/[<>]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** お客様宛の書類に載せる連絡先。名前が空になったら「お客様」にする */
export function customerSafeContact(c: DiagnosisContact): DiagnosisContact {
  const name = stripLinks(c.name) || "お客様";
  const company = stripLinks(c.company) || null;
  return { ...c, name, company };
}
