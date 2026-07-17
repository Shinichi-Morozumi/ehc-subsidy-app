import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 提案書PDFを添付して EHC（＋PN cc）へ自動送信する。
// 宛先はサーバー側で固定（クライアントからは指定不可＝悪用防止）。
// 全ページが EHC_PASSCODE の cookie ゲート配下にあるため、実質ログイン済みのみ到達可能。
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  // Resendで送信ドメインを認証したら PROPOSAL_FROM_EMAIL に "EHC <info@ehcjpn.com>" を設定。
  // 未設定時はResendのテスト送信元（アカウント所有者宛にのみ届く）を使用。
  const from = process.env.PROPOSAL_FROM_EMAIL || "EHC提案書 <onboarding@resend.dev>";
  const to = (process.env.PROPOSAL_TO_EMAIL || "info@ehcjpn.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cc = (process.env.PROPOSAL_CC_EMAIL || "info@project-neo.co.jp")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "メール送信が未設定です（管理者向け: Vercelに RESEND_API_KEY を設定してください）。" },
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

  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      cc,
      replyTo: replyTo && /.+@.+\..+/.test(replyTo) ? replyTo : undefined,
      subject,
      text: text || "提案書PDFを添付します。",
      attachments: [{ filename: filename || "proposal.pdf", content: base64 }],
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message || String(error) }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
