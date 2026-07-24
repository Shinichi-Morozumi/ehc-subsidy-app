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
type LeadPayload = {
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  subsidyYen?: number;
  yearsToRecover?: number | null;
  wishSubsidy?: string | null;
  proposalNo?: string;
  sentDate?: string; // YYYY-MM-DD
  memo?: string;
};

// 提案書送信の成功後に、Notionの「見込み顧客アタックリスト」へ1行追記する。
// best-effort：失敗してもメール送信の成否には影響させない（例外は握りつぶす）。
// 必要な環境変数（Vercel）:
//   NOTION_TOKEN … Notion内部インテグレーションのシークレット（secret_... または ntn_...）
//   NOTION_DB_ID … 追記先の database_id（既定: 27c3f8fe-bc9b-49f7-bba1-430b90697cec）
async function appendLeadToNotion(lead: LeadPayload): Promise<void> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return; // トークン未設定なら何もしない（安全にノーオペ）
  const databaseId = process.env.NOTION_DB_ID || "27c3f8fe-bc9b-49f7-bba1-430b90697cec";

  const props: Record<string, unknown> = {
    会社名: { title: [{ text: { content: lead.company || "（無題）" } }] },
    ステータス: { select: { name: "提案送付済み" } },
  };
  if (typeof lead.subsidyYen === "number") props["補助金額(概算)"] = { number: lead.subsidyYen };
  if (typeof lead.yearsToRecover === "number") props["回収年数"] = { number: lead.yearsToRecover };
  if (lead.wishSubsidy) props["希望制度"] = { select: { name: lead.wishSubsidy } };
  if (lead.email) props["担当メール"] = { email: lead.email };
  if (lead.phone) props["電話"] = { phone_number: lead.phone };
  if (lead.address) props["住所"] = { rich_text: [{ text: { content: lead.address } }] };
  if (lead.proposalNo) props["提案No"] = { rich_text: [{ text: { content: lead.proposalNo } }] };
  if (lead.sentDate) props["送信日"] = { date: { start: lead.sentDate } };
  if (lead.memo) props["メモ"] = { rich_text: [{ text: { content: lead.memo } }] };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000); // 8秒でタイムアウト
  try {
    await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: props,
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

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
    // メール送信成功後、Notionへ1行追記（best-effort：失敗しても送信成功は返す）
    if (lead) {
      try {
        await appendLeadToNotion(lead);
      } catch {
        // Notion追記の失敗はメール送信の成否に影響させない
      }
    }
    return NextResponse.json({ ok: true, id: info.messageId ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
