// EHC-0124: 全相談で安定した受付IDを使用。状態不明のメールを自動再送しない。
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { DEFAULT_DB_ID, notionHeaders, appendLeadToNotion, leadRichText, type LeadPayload } from "./notionLead";
import { withSubmitLock } from "./submitLedger";
import { mailConfig } from "./mailConfig";
import { kaigoMailPlan } from "./kaigo";

type ReceiptRecord = { pageId: string; memo: string };
type Mail = { subject: string; text: string };
type Attachment = { filename: string; content: Buffer; contentType: string };
const marker = (fingerprint: string, state: string) => `[EHC受付照合:${fingerprint}:${state}]`;

export async function findLeadReceipt(receiptNo: string): Promise<ReceiptRecord | false | null> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID || DEFAULT_DB_ID}/query`, {
      method: "POST", headers: notionHeaders(token), signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ filter: { property: "提案No", rich_text: { equals: receiptNo } }, page_size: 2 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.results) || data.results.length > 1) return null;
    if (!data.results.length) return false;
    const page = data.results[0];
    if (typeof page.id !== "string") return null;
    return { pageId: page.id, memo: (page.properties?.["メモ"]?.rich_text ?? []).map((t: { plain_text?: string; text?: { content?: string } }) => t.plain_text ?? t.text?.content ?? "").join("") };
  } catch { return null; }
}

async function saveDeliveryState(pageId: string, memo: string): Promise<boolean> {
  const url = `https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`;
  try {
    const r = await fetch(url, {
      method: "PATCH", headers: notionHeaders(process.env.NOTION_TOKEN!), signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ properties: { メモ: { rich_text: leadRichText(memo) } } }),
    });
    if (r.ok) return true;
  } catch { /* 応答が途切れても書込み済みの場合がある。メールは再送しない。 */ }
  try {
    const r = await fetch(url, { headers: notionHeaders(process.env.NOTION_TOKEN!), signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!r.ok) return false;
    const page = await r.json();
    const actual = (page.properties?.["メモ"]?.rich_text ?? []).map((t: { plain_text?: string; text?: { content?: string } }) => t.plain_text ?? t.text?.content ?? "").join("");
    return actual === memo;
  } catch { return false; }
}

export async function deliverStableLead(opts: {
  receiptNo: string; lead: LeadPayload; buildMail: (saved: boolean) => Mail;
  replyTo?: string | null; attachments?: Attachment[]; test: boolean; hasConsultation: boolean; identityData: unknown;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { receiptNo, lead } = opts;
  const cfg = mailConfig(); const plan = kaigoMailPlan(cfg);
  const mail = opts.buildMail(true);
  const fingerprint = createHash("sha256").update(JSON.stringify({ input: opts.identityData, to: plan.to, cc: plan.cc,
    attachments: (opts.attachments ?? []).map(a => ({ name: a.filename, hash: createHash("sha256").update(a.content).digest("hex") })) })).digest("hex");
  return withSubmitLock(receiptNo, async () => {
    const existing = await findLeadReceipt(receiptNo);
    if (existing === null) return { status: 503, body: { ok: false, receiptNo, error: `受付の確認ができません。再送せず、受付番号 ${receiptNo} を担当へお知らせください。` } };
    if (existing) {
      const m = existing.memo.match(/\[EHC受付照合:([a-f0-9]{64}):(pending|sent|failed|unknown)\]/);
      if (!m || m[1] !== fingerprint) return { status: 409, body: { ok: false, receiptNo, error: "同じ受付番号で内容が変わっています。前の受付結果を担当へご確認ください。" } };
      const notified = m[2] === "sent";
      return { status: 200, body: { ok: true, receiptNo, duplicate: true, saved: true, notified,
        cvEligible: notified && opts.hasConsultation && !opts.test, qaCvEligible: notified && opts.hasConsultation && opts.test, test: opts.test,
        attachmentsDelivered: (opts.attachments?.length ?? 0) > 0 ? notified : null,
        ...(!notified ? { warning: "相談は記録済みですが、担当者への通知を確認できません。自動で再送せず、受付番号をお知らせください。" } : {}) } };
    }
    const originalMemo = lead.memo || "";
    const saved = await appendLeadToNotion({ ...lead, memo: `${marker(fingerprint, "pending")}\n${originalMemo}` });
    if (!saved.ok || !saved.pageId) return { status: 502, body: { ok: false, receiptNo, error: `受付保存の結果を確認できません。再送せず、受付番号 ${receiptNo} をお知らせください。` } };
    let notified = false;
    if (plan.send && cfg.user && cfg.pass) {
      try {
        const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
        const sent = await transport.sendMail({ from: cfg.from, to: plan.to, ...(plan.cc.length ? { cc: plan.cc } : {}),
          ...(opts.replyTo ? { replyTo: opts.replyTo } : {}), subject: `${plan.subjectPrefix}${mail.subject}`, text: mail.text,
          ...(opts.attachments?.length ? { attachments: opts.attachments } : {}) });
        notified = !sent.rejected?.some((address: string | { address: string }) => plan.to.includes(typeof address === "string" ? address : address.address));
      } catch { console.error("[lead-delivery] 通知結果を確認できません:", receiptNo); }
    }
    const persisted = await saveDeliveryState(saved.pageId, `${marker(fingerprint, notified ? "sent" : "unknown")}\n${originalMemo}`);
    if (!persisted) console.error("[lead-delivery] 通知状態の記録に失敗:", receiptNo);
    return { status: 200, body: { ok: true, receiptNo, saved: true, notified,
      cvEligible: notified && persisted && opts.hasConsultation && !opts.test, qaCvEligible: notified && persisted && opts.hasConsultation && opts.test, test: opts.test,
      attachments: opts.attachments?.length ?? 0, attachmentsDelivered: (opts.attachments?.length ?? 0) > 0 ? notified : null,
      ...(!notified ? { warning: "相談は記録しましたが、担当者への通知を確認できません。受付番号を電話でお知らせください。" } : !persisted ? { warning: "担当者へ通知しましたが、通知状態の記録を確認できません。再送せず受付番号をお知らせください。" } : {}) } };
  });
}
