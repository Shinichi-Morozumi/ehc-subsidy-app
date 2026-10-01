import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { clientKeyFromHeaders, overSubmitRateLimit } from "@/lib/submitRateLimit";
import { spamMessage, spamReasonOf } from "@/lib/spamGuard";
import { appendLeadToNotionOnce } from "@/lib/notionLead";
import { mailConfig } from "@/lib/mailConfig";
import { kaigoLead, kaigoMailPlan, kaigoStaffMail, readKaigoSubmit } from "@/lib/kaigo";
import { issueDocumentNumber } from "@/lib/docNumber";
import { todayJst } from "@/lib/programClock";
import { COMPANY } from "@/lib/company";

/* ───────────────────────────────────────────────────────────
   介護施設向け 補助金の事前確認の受け口（2026-10-01 EHC-0056）。決め事は lib/kaigo.ts。

   ・Notion「EHC見込み顧客アタックリスト」に「未着手」で1行（提案No＝受付番号 EHC-YYYYMMDD-…）。
   　受付番号は診断と同じ形なので、未着手の通知（lib/leadReminder.ts・平日9時）の対象にも入る。
   ・通知メール：宛先に必ず info@ehcjpn.com（＋診断の担当者宛の宛先）。決め方は lib/kaigo.ts の kaigoMailPlan。
   ・お客様宛の自動メールは送らない（画面に受付番号と電話を出す）。
   ・どちらかができれば「受け付けました」。どちらもできなければ、電話の案内つきで失敗を返す（受け付けたつもりにさせない）。
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

  const spam = spamReasonOf({ hp: body.hp, elapsedMs: body.elapsedMs });
  if (spam) {
    console.warn(`[kaigo-lead] 迷惑な送信の疑い（${spam}）のため受け付けません`);
    return NG(400, spamMessage(spam, COMPANY.tel));
  }
  const read = readKaigoSubmit(body);
  if (!read.ok) return NG(400, read.error);
  if (overSubmitRateLimit(`kaigo:${clientKeyFromHeaders(req.headers)}`)) {
    return NG(429, `短い時間に送信が続いたため、いったん止めています。お急ぎの場合はお電話（${COMPANY.tel}）でご連絡ください。`);
  }

  const input = read.input;
  const receiptNo = issueDocumentNumber();
  const lead = kaigoLead(input, receiptNo, todayJst(new Date()));

  let saved = false;
  try {
    const notion = await appendLeadToNotionOnce(lead);
    saved = notion.ok;
    if (!notion.ok) console.error("[kaigo-lead] Notion への追加に失敗:", notion.error, JSON.stringify(lead));
  } catch (e) {
    console.error("[kaigo-lead] Notion への追加で例外:", e instanceof Error ? e.message : String(e), JSON.stringify(lead));
  }

  let mailed = false;
  const cfg = mailConfig();
  const plan = kaigoMailPlan(cfg);
  if (plan.send && cfg.user && cfg.pass) {
    try {
      const mail = kaigoStaffMail(input, receiptNo, { notionSaved: saved });
      const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
      await transporter.sendMail({
        from: cfg.from,
        to: plan.to,
        ...(plan.cc.length ? { cc: plan.cc } : {}),
        ...(input.contact.email ? { replyTo: input.contact.email } : {}),
        subject: `${plan.subjectPrefix}${mail.subject}`,
        text: mail.text,
      });
      mailed = true;
    } catch (e) {
      console.error("[kaigo-lead] 通知メールの送信に失敗:", e instanceof Error ? e.message : String(e));
    }
  } else {
    console.info(`[kaigo-lead] 通知メールを送らない（${plan.reason}）:`, receiptNo);
  }

  if (!saved && !mailed) {
    return NG(502, `ただいま受け付けできませんでした。お手数ですが、お電話（${COMPANY.tel}・${COMPANY.hours}）かメール（${COMPANY.email}）でご連絡ください。`);
  }
  console.info(`[kaigo-lead] 受付 ${receiptNo}（紹介コード ${input.ref ?? "なし"}・Notion ${saved ? "○" : "×"}・通知メール ${mailed ? `○ ${plan.to.join(",")}` : "×"}）`);
  return NextResponse.json({ ok: true, receiptNo });
}
