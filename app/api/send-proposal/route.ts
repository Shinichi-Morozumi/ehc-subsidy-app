import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 提案書PDFを添付して EHC（＋PN cc）へ自動送信する。
// 宛先はサーバー側で固定（クライアントからは指定不可＝悪用防止）。
// 全ページが EHC_PASSCODE の cookie ゲート配下にあるため、実質ログイン済みのみ到達可能。
//
// 送信は Gmail / Google Workspace の SMTP（アプリパスワード）経由。
// 必要な環境変数（Vercel）:
//   SMTP_USER … 送信元Googleアカウント（例: info@neneweb.com）
//   SMTP_PASS … Googleアプリパスワード（16桁・スペース無し）
//   SMTP_HOST … 省略可（既定 smtp.gmail.com）
//   SMTP_PORT … 省略可（既定 465＝SSL）
//   PROPOSAL_FROM_EMAIL … 省略可（既定は表示名付きの SMTP_USER）
//   PROPOSAL_TO_EMAIL   … 省略可（既定 info@ehcjpn.com）
//   PROPOSAL_CC_EMAIL   … 省略可（既定 info@project-neo.co.jp）
export async function POST(req: Request) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || "465");

  const from = process.env.PROPOSAL_FROM_EMAIL || (smtpUser ? `EHC提案書 <${smtpUser}>` : "");
  const to = (process.env.PROPOSAL_TO_EMAIL || "info@ehcjpn.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cc = (process.env.PROPOSAL_CC_EMAIL || "info@project-neo.co.jp")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      { ok: false, error: "メール送信が未設定です（管理者向け: Vercelに SMTP_USER と SMTP_PASS を設定してください）。" },
      { status: 503 }
    );
  }

  let body: {
    pdfBase64?: string;
    filename?: string;
    subject?: string;
    text?: string;
    replyTo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です。" }, { status: 400 });
  }

  const { pdfBase64, filename, subject, text, replyTo } = body || {};
  if (!pdfBase64 || !subject) {
    return NextResponse.json({ ok: false, error: "PDFまたは件名がありません。" }, { status: 400 });
  }

  // data URI（data:application/pdf;...;base64,XXXX）でも生base64でも受け付ける
  const raw = String(pdfBase64);
  const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465=SSL, 587=STARTTLS
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      cc,
      replyTo: replyTo && /.+@.+\..+/.test(replyTo) ? replyTo : undefined,
      subject,
      text: text || "提案書PDFを添付します。",
      attachments: [
        {
          filename: filename || "proposal.pdf",
          content: Buffer.from(base64, "base64"),
          contentType: "application/pdf",
        },
      ],
    });
    return NextResponse.json({ ok: true, id: info.messageId ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
