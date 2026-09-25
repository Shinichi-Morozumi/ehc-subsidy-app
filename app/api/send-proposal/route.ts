import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { appendLeadToNotion, type LeadPayload } from "@/lib/notionLead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 提案書PDFを添付して EHC（＋PN cc）へ自動送信する。
// 宛先はサーバー側で固定（クライアントからは指定不可＝悪用防止）。
//
// ⚠️ 2026-08-24 監査での指摘（未対応・要判断）:
//   このエンドポイントを守っているのは middleware.ts の cookie ゲートだけで、
//   そのゲートは **環境変数 EHC_PASSCODE が設定されているときしか働かない**。
//   EHC_PASSCODE 未設定の環境では誰でも POST でき、
//   info@ehcjpn.com に任意のPDFを送りつけられる（メール爆撃・なりすまし提案書）。
//   本番で EHC_PASSCODE を必ず設定するか、この route 単体にレート制限を入れること。
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
/* 2026-09-25: LeadPayload と appendLeadToNotion は lib/notionLead.ts へ移した（診断フローと共用）。
   この経路の振る舞いは同じ（ステータス「提案送付済み」・失敗はログと leadPersisted:false）。 */

/* 添付PDFの上限。base64は元データの約4/3に膨らむので、10MB相当を上限にする。
   上限が無いと、巨大なbase64がそのままメモリに載って lambda が落ちる。 */
const MAX_PDF_BASE64_CHARS = 14_000_000; // ≒ 10.5MB のPDF

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
    lead?: LeadPayload;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です。" }, { status: 400 });
  }

  const { pdfBase64, filename, subject, text, replyTo, lead } = body || {};
  if (!pdfBase64 || !subject) {
    return NextResponse.json({ ok: false, error: "PDFまたは件名がありません。" }, { status: 400 });
  }

  // data URI（data:application/pdf;...;base64,XXXX）でも生base64でも受け付ける
  const raw = String(pdfBase64);
  if (raw.length > MAX_PDF_BASE64_CHARS) {
    return NextResponse.json(
      { ok: false, error: "PDFのサイズが大きすぎます（約10MBまで）。ページ数を減らして再度お試しください。" },
      { status: 413 }
    );
  }
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
    /* メール送信成功後、Notionへ1行追記。
       メール送信の成否には影響させないが、失敗は必ずログに残し、
       レスポンスの leadPersisted で呼び出し側に伝える（黙って消さない）。 */
    let leadPersisted: boolean | null = null;
    if (lead) {
      const notion = await appendLeadToNotion(lead);
      leadPersisted = notion.ok;
      if (!notion.ok) {
        // lead本体ごと出す。Notionが復旧したら、このログから手で復元できる。
        console.error(
          "[send-proposal] Notion追記に失敗しました。手動での復元が必要です:",
          JSON.stringify({ error: notion.error, skipped: notion.skipped ?? false, lead })
        );
      }
    }
    return NextResponse.json({ ok: true, id: info.messageId ?? null, leadPersisted });
  } catch (e) {
    /* 2026-08-24 監査での修正:
       以前は SMTP の例外メッセージをそのままクライアントへ返していた。
       nodemailer の例外文には host / port / 認証失敗の詳細が含まれるため、
       画面に出す文言は一般化し、詳細はサーバログにだけ残す。 */
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-proposal] メール送信に失敗しました:", msg);
    return NextResponse.json(
      { ok: false, error: "メールの送信に失敗しました。時間をおいて再度お試しいただくか、EHCへ直接ご連絡ください。" },
      { status: 500 }
    );
  }
}
