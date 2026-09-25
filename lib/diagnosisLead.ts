/* ───────────────────────────────────────────────────────────
   Web診断（5段）の相談を、Notion「EHC見込み顧客アタックリスト」の1行にする（2026-09-25）

   旧提案書（app/api/send-proposal）は「提案送付済み」で入れていた。
   診断からの相談はまだ誰も対応していないので「未着手」で入れ、
   次アクションに「5営業日以内に連絡（目安の日付）」を書く（フォロー漏れを防ぐため）。

   値はサーバが組み直したスナップショット（lib/diagnosisSnapshot.ts）から取る。
   補助金の候補と適合チェックはお客様の画面に出た内容（サーバで判定し直していない）なので、
   メモにもそう書く。
   ─────────────────────────────────────────────────────────── */

import type { DiagnosisSnapshot } from "./diagnosisSnapshot";
import { TIMING_LABEL_JA, pricedGroupsOf, EQUIP_LABEL_JA, energyBillLine } from "./diagnosisSnapshot";
import { yenJP } from "./pricing";
import { todayJst } from "./programClock";
import { COMPANY } from "./company";
import type { LeadPayload, LeadWish } from "./notionLead";

/** 「最大 約166.3万円」→ 1,663,000（円）。読めなければ null */
export function parseManYenToYen(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)\s*万円/);
  if (!m) return null;
  const v = Math.round(Number(m[1]) * 10000);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** 制度名から、DB の「希望制度」の選択肢へ寄せる（無い選択肢は作らない） */
export function wishOf(programName: string | null | undefined): LeadWish {
  const n = (programName ?? "").trim();
  if (!n) return "未定";
  /* 自治体の制度は名前が都道府県名で始まる（東京都・神奈川県・大阪府…）。先に見る。
     「省エネ」を含む自治体の制度（東京都ゼロエミ等）を「省エネ補助金」に入れないため。 */
  if (/^(東京都|北海道|京都府|大阪府|\S{2,3}県)/.test(n)) return "自治体";
  if (/SII|省エネ/.test(n)) return "省エネ補助金";
  if (/持続化/.test(n)) return "持続化";
  if (/ものづくり/.test(n)) return "ものづくり";
  return "未定";
}

/** 今日（JST）から数えて n 営業日後（土日を除く。祝日は数えていない） */
export function addBusinessDaysJst(n: number, now: Date = new Date()): string {
  const [y, m, d] = todayJst(now).split("-").map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d, 12));
  let added = 0;
  while (added < n) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const wd = cur.getUTCDay();
    if (wd !== 0 && wd !== 6) added += 1;
  }
  return cur.toISOString().slice(0, 10);
}

export type DiagnosisLeadOptions = {
  now?: Date;
  /** 担当者宛メールの結果。"unknown"（届いたか分からない）のときはメモの先頭に書く */
  staffMail?: "sent" | "unknown";
};

export function buildDiagnosisLead(s: DiagnosisSnapshot, opts: DiagnosisLeadOptions = {}): LeadPayload {
  const now = opts.now ?? new Date();
  const programs = s.subsidyCheck?.programs ?? [];
  const current = programs.filter((p) => p.group === "今回の公募で進められる");
  const top = current[0] ?? programs[0] ?? null;
  const subsidyYen = current.map((p) => parseManYenToYen(p.amount)).find((v) => v != null) ?? undefined;
  const due = addBusinessDaysJst(COMPANY.replyDays, now);

  const priced = pricedGroupsOf(s.equipGroups);
  const equip = priced.length
    ? priced.map((g) => `${EQUIP_LABEL_JA[g.equip]} ${g.hp}馬力×${g.units}台（${g.installYear}年）`).join("、")
    : s.equipGroups.length
      ? `${s.equipGroups.length}群（馬力未入力）`
      : "未入力";
  const memo = [
    opts.staffMail === "unknown"
      ? "【要確認】担当者宛メールの送信結果が不明です（届いていない可能性）。受信箱に無ければ、この行から対応してください。"
      : "",
    `Web診断（5段）から。受付番号 ${s.receiptNo}（${s.issuedAtJst}）`,
    `お名前: ${s.contact.name}${s.contact.company ? `／会社: ${s.contact.company}` : ""}`,
    `設備: ${equip}`,
    `概算（税込）: ${s.estimate ? yenJP(s.estimate.total) : "未算定"}`,
    programs.length
      ? `候補（お客様の画面の表示）: ${programs.map((p) => `${p.name}［${p.group}／${p.fit}${p.selfCheck ? `／適合チェック: ${p.selfCheck}` : ""}］`).join("、")}`
      : "候補: この送信には含まれていません",
    s.subsidyCheck?.answers.length ? `適合チェックの回答: ${s.subsidyCheck.answers.map((a) => `${a.question}→${a.answer}`).join("／")}` : "",
    `希望時期: ${s.desiredTiming ? TIMING_LABEL_JA[s.desiredTiming] : "未回答"}／予算: ${s.customerBudgetYen != null ? yenJP(s.customerBudgetYen) : "未回答"}`,
    s.energyBill ? `電気料金の明細: ${energyBillLine(s.energyBill)}` : "",
    "診断書PDFは担当者宛メールに添付（お客様へ転送可）。",
    "個人情報の取扱い: 送信画面の同意欄で同意を得てから送信（同意しないと送れない画面）。",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    company: s.contact.company || s.contact.name,
    contact: s.contact.name,
    email: s.contact.email,
    phone: s.contact.phone ?? undefined,
    subsidyYen,
    wishSubsidy: wishOf(top?.name),
    proposalNo: s.receiptNo,
    sentDate: todayJst(now),
    memo,
    status: "未着手",
    nextAction: `${COMPANY.replyDays}営業日以内にご連絡（目安 ${due}）。現地確認の日程調整・診断書PDFの転送`,
  };
}
