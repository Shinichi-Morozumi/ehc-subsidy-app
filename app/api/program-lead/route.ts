import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { clientKeyFromHeaders, overSubmitRateLimit } from "@/lib/submitRateLimit";
import { MIN_ELAPSED_MS_SHORT_FORM, spamMessage, spamReasonOf } from "@/lib/spamGuard";
import { appendLeadToNotionOnce, leadExistsInNotion } from "@/lib/notionLead";
import { withSubmitLock } from "@/lib/submitLedger";
import { mailConfig } from "@/lib/mailConfig";
import { kaigoMailPlan } from "@/lib/kaigo";
import { programLead, programStaffMail, readProgramSubmit } from "@/lib/programLead";
import { issueDocumentNumber } from "@/lib/docNumber";
import { todayJst } from "@/lib/programClock";
import { COMPANY } from "@/lib/company";
import { deliverStableLead } from "@/lib/leadDelivery";
import { resolveConsultation } from "@/lib/zoomBookingServer";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 制度カードからの相談の受け口。決め事は lib/programLead.ts。
   作りは介護の事前確認（app/api/kaigo-lead）と同じ：
   ・Notion に「未着手」で1行（提案No＝受付番号）。通知メールの決め方も同じ（kaigoMailPlan）。
   ・どちらかができれば「受け付けました」。どちらもできなければ、電話の案内つきで失敗を返す。
   ・欄が3つだけのフォームなので、送信までの時間の下限は短い方（MIN_ELAPSED_MS_SHORT_FORM）を使う。
   ・写真・PDF の添付（5つ・合計3.2MBまで）は担当者宛メールに付ける。保存はしない（lib/attachLimits.ts）。
   ─────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NG = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NG(400, "リクエスト形式が不正です。");
    body = parsed as Record<string, unknown>;
  } catch {
    return NG(400, "リクエスト形式が不正です。");
  }

  const spam = spamReasonOf({ hp: body.hp, elapsedMs: body.elapsedMs }, MIN_ELAPSED_MS_SHORT_FORM);
  if (spam) {
    console.warn(`[program-lead] 迷惑な送信の疑い（${spam}）のため受け付けません`);
    return NG(400, spamMessage(spam, COMPANY.tel));
  }
  const read = readProgramSubmit(body);
  if (!read.ok) return NG(400, read.error);
  if (overSubmitRateLimit(`program:${clientKeyFromHeaders(req.headers)}`)) {
    return NG(429, `短い時間に送信が続いたため、いったん止めています。お急ぎの場合はお電話（${COMPANY.tel}）でご連絡ください。`);
  }

  const input = read.input;
  try { input.consultation = await resolveConsultation(input.consultation, input.email); if (input.ad && input.consultation) input.ad.consultation = input.consultation; }
  catch (e) { return NG(400, e instanceof Error ? e.message : "Zoom予約を確認できません。"); }
  if (input.requestId) {
    const receiptNo = input.ad ? `EHCAD-${input.requestId}` : `EHC-${input.requestId}`;
    const today = todayJst(new Date());
    const result = await deliverStableLead({ receiptNo, identityData: input, lead: programLead(input, receiptNo, today),
      buildMail: saved => programStaffMail(input, receiptNo, today, { notionSaved: saved }),
      replyTo: input.email, attachments: input.attachments,
      test: !!(input.context?.test || input.ad?.test), hasConsultation: !!input.consultation });
    return NextResponse.json(result.body, { status: result.status });
  }
  // 広告フォームは通信再試行でも同じ受付番号。既存の通常フォームは変更しない。
  const receiptNo = input.ad ? `EHCAD-${input.ad.requestId}` : issueDocumentNumber();
  return withSubmitLock(receiptNo, async () => {
  if (input.ad) {
    const exists = await leadExistsInNotion(receiptNo);
    if (exists === true) return NextResponse.json({ ok: true, receiptNo, duplicate: true, attachmentsDelivered: null });
    // 受付済みか分からない状態では、二重の通知を作らず確認を案内する。
    if (exists === null) return NG(503, `受付の確認ができません。再送せず、お電話（${COMPANY.tel}）で受付番号 ${receiptNo} をお知らせください。`);
  }
  const today = todayJst(new Date());
  const lead = programLead(input, receiptNo, today);

  let saved = false;
  try {
    const notion = await appendLeadToNotionOnce(lead);
    saved = notion.ok;
    if (input.ad && notion.duplicate) return NextResponse.json({ ok: true, receiptNo, duplicate: true, attachmentsDelivered: null });
    if (!notion.ok) console.error("[program-lead] Notion への追加に失敗:", receiptNo, notion.error);
  } catch (e) {
    console.error("[program-lead] Notion への追加で例外:", receiptNo, e instanceof Error ? e.message : String(e));
  }

  if (input.ad && !saved) return NG(502, `受付の保存を確認できません。再送せず、お電話（${COMPANY.tel}）で受付番号 ${receiptNo} をお知らせください。`);
  let mailed = false;
  const cfg = mailConfig();
  const plan = kaigoMailPlan(cfg);
  if (plan.send && cfg.user && cfg.pass) {
    try {
      const mail = programStaffMail(input, receiptNo, today, { notionSaved: saved });
      const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
      await transporter.sendMail({
        from: cfg.from,
        to: plan.to,
        ...(plan.cc.length ? { cc: plan.cc } : {}),
        ...(input.email ? { replyTo: input.email } : {}),
        subject: `${plan.subjectPrefix}${mail.subject}`,
        text: mail.text,
        ...(input.attachments.length ? { attachments: input.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) } : {}),
      });
      mailed = true;
    } catch (e) {
      console.error("[program-lead] 通知メールの送信に失敗:", e instanceof Error ? e.message : String(e));
    }
  } else {
    console.info(`[program-lead] 通知メールを送らない（${plan.reason}）:`, receiptNo);
  }

  if (!saved && !mailed) {
    return NG(502, `ただいま受け付けできませんでした。お手数ですが、お電話（${COMPANY.tel}・${COMPANY.hours}）かメール（${COMPANY.email}）でご連絡ください。`);
  }
  console.info(`[program-lead] 受付 ${receiptNo}（添付 ${input.attachments.length}件・制度 ${input.programIds.length ? input.programIds.join(",") : "指定なし"}・印 ${input.flags.join(",") || "なし"}・紹介 ${input.referral?.ref ?? "なし"}・Notion ${saved ? "○" : "×"}・通知メール ${mailed ? `○ ${plan.to.join(",")}` : "×"}）`);
  /* 添付は担当者宛メールでだけ届く。メールが送れなかったときは、画面で「写真はメールで」と案内する */
  return NextResponse.json({ ok: true, receiptNo, saved, notified: mailed, attachments: input.attachments.length, attachmentsDelivered: input.attachments.length ? mailed : null });
  });
}
