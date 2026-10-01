import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { clientKeyFromHeaders, overSubmitRateLimit } from "@/lib/submitRateLimit";
import { MIN_ELAPSED_MS_SHORT_FORM, spamMessage, spamReasonOf } from "@/lib/spamGuard";
import { appendLeadToNotion } from "@/lib/notionLead";
import { mailConfig } from "@/lib/mailConfig";
import { notifyLead, notifyReceiptNo, notifyStaffMail, readNotifySignup } from "@/lib/notifySignup";
import { todayJst } from "@/lib/programClock";
import { COMPANY } from "@/lib/company";

/* ───────────────────────────────────────────────────────────
   次の公募のお知らせの登録口（2026-09-26 改善6）。決め事は lib/notifySignup.ts。
   Notion への追加か担当者宛メールのどちらかができれば「登録しました」と返す（片方が落ちても担当者が拾える）。
   どちらもできなければ、電話の案内つきで失敗を返す（登録できたつもりにさせない）。
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
  /* 欄がメールと同意だけなので、時間の下限は短め（lib/spamGuard.ts の MIN_ELAPSED_MS_SHORT_FORM） */
  const spam = spamReasonOf({ hp: body.hp, elapsedMs: body.elapsedMs }, MIN_ELAPSED_MS_SHORT_FORM);
  if (spam) {
    console.warn(`[notify-signup] 迷惑な送信の疑い（${spam}）のため受け付けません`);
    return NG(400, spamMessage(spam, COMPANY.tel));
  }
  const input = readNotifySignup(body);
  if (!input) return NG(400, "メールアドレスと、同意の欄をご確認ください。");
  if (overSubmitRateLimit(`notify:${clientKeyFromHeaders(req.headers)}`)) {
    return NG(429, `短い時間に登録が続いたため、いったん止めています。お急ぎの場合はお電話（${COMPANY.tel}）でご連絡ください。`);
  }

  const receiptNo = notifyReceiptNo();
  const lead = notifyLead(input, receiptNo, todayJst(new Date()));
  let saved = false;
  try {
    const notion = await appendLeadToNotion(lead);
    saved = notion.ok;
    if (!notion.ok) console.error("[notify-signup] Notion への追加に失敗:", notion.error, JSON.stringify(lead));
  } catch (e) {
    console.error("[notify-signup] Notion への追加で例外:", e instanceof Error ? e.message : String(e), JSON.stringify(lead));
  }

  let mailed = false;
  const cfg = mailConfig();
  if (cfg.liveStaff && cfg.user && cfg.pass) {
    try {
      const mail = notifyStaffMail(input, receiptNo);
      const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
      await transporter.sendMail({ from: cfg.from, to: cfg.staffTo, cc: cfg.staffCc, replyTo: input.email, subject: mail.subject, text: mail.text });
      mailed = true;
    } catch (e) {
      console.error("[notify-signup] 担当者宛の送信に失敗:", e instanceof Error ? e.message : String(e));
    }
  } else {
    console.info(`[notify-signup] 担当者宛は送らない設定（DIAGNOSIS_MAIL_MODE）:`, receiptNo);
  }

  if (!saved && !mailed) {
    return NG(502, `ただいま登録できませんでした。お手数ですが、お電話（${COMPANY.tel}）かメール（${COMPANY.email}）でご連絡ください。`);
  }
  console.info(`[notify-signup] 登録 ${receiptNo}（Notion ${saved ? "○" : "×"}・担当者宛 ${mailed ? "○" : "×"}）`);
  return NextResponse.json({ ok: true, receiptNo });
}
