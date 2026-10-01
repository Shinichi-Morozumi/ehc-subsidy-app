import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { todayJst } from "@/lib/programClock";
import { COMPANY } from "@/lib/company";
import { DEFAULT_DB_ID, notionHeaders } from "@/lib/notionLead";
import { mailConfig } from "@/lib/mailConfig";
import {
  REMINDED_PROPERTY,
  dueToday,
  reminderFilter,
  reminderMail,
  rowsFromNotion,
} from "@/lib/leadReminder";

/* ───────────────────────────────────────────────────────────
   「未着手」のままの相談を担当者に知らせる定期実行（2026-09-26 改善5）

   vercel.json の crons から平日の朝9時（日本時間。UTC 0:00）に呼ばれる。決め事は lib/leadReminder.ts。

   ■ 呼べる人
   　　CRON_SECRET を設定していれば、Vercel が付ける「Authorization: Bearer <CRON_SECRET>」の呼び出しだけ。
   　　設定していなければ、Vercel の定期実行（User-Agent が vercel-cron）の呼び出しだけ。
   　　どちらにしても、同じ行には1日1回しか知らせない（Notion の「リマインド送信日」で止める）ので、
   　　余計に叩かれても担当者の受信箱は埋まらない。
   ■ 動き方（LEAD_REMINDER_MODE）
   　　"send"（既定）… 実際に送る（ただし DIAGNOSIS_MAIL_MODE が staff / send のときだけ。診断のメールと同じ）
   　　"dry_run"     … 送らずにログにだけ出す
   　　"off"         … 何もしない
   ─────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return (req.headers.get("user-agent") || "").toLowerCase().includes("vercel-cron");
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const mode = (process.env.LEAD_REMINDER_MODE || "send").toLowerCase();
  if (mode === "off") return NextResponse.json({ ok: true, skipped: "off" });

  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ ok: true, skipped: "NOTION_TOKEN 未設定" });
  const databaseId = process.env.NOTION_DB_ID || DEFAULT_DB_ID;
  const today = todayJst(new Date());

  // ── Notion から対象の行を集める（最大100行）
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({ filter: reminderFilter(today), page_size: 100 }),
  }).catch((e: unknown) => {
    console.error("[lead-followup] Notion に接続できません:", e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!res || !res.ok) {
    const detail = res ? await res.text().catch(() => "") : "";
    console.error("[lead-followup] Notion の検索に失敗:", res?.status, detail.slice(0, 400));
    return NextResponse.json({ ok: false, error: "notion_query_failed" }, { status: 502 });
  }
  const data = (await res.json().catch(() => null)) as { results?: unknown } | null;
  const due = dueToday(rowsFromNotion(data?.results), today);
  if (due.length === 0) {
    console.info("[lead-followup] 知らせる行はありません:", today);
    return NextResponse.json({ ok: true, today, due: 0 });
  }

  const mail = reminderMail(due, today, COMPANY.replyDays);
  const cfg = mailConfig();
  if (mode === "dry_run" || !cfg.liveStaff) {
    console.info(`[lead-followup] 送らずに記録だけ（${mode === "dry_run" ? "dry_run" : "DIAGNOSIS_MAIL_MODE が staff / send ではない"}）\n${mail.subject}\n${mail.text}`);
    return NextResponse.json({ ok: true, today, due: due.length, sent: false });
  }
  if (!cfg.user || !cfg.pass) {
    console.error("[lead-followup] 送信アカウントが未設定のため送れません。");
    return NextResponse.json({ ok: false, error: "smtp_not_configured" }, { status: 500 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({ from: cfg.from, to: cfg.staffTo, cc: cfg.staffCc, subject: mail.subject, text: mail.text });
  } catch (e) {
    console.error("[lead-followup] 送信に失敗:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  // ── 知らせた行に今日の日付を入れる（同じ日に2度知らせないため）
  let marked = 0;
  for (const row of due) {
    const r = await fetch(`https://api.notion.com/v1/pages/${row.pageId}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ properties: { [REMINDED_PROPERTY]: { date: { start: today } } } }),
    }).catch(() => null);
    if (r?.ok) marked += 1;
    else {
      const detail = r ? await r.text().catch(() => "") : "";
      console.warn(`[lead-followup] 「${REMINDED_PROPERTY}」を書けませんでした（項目が Notion に無い可能性）:`, row.receiptNo, detail.slice(0, 200));
    }
  }
  console.info(`[lead-followup] ${due.length}件を知らせました（記録 ${marked}件）:`, today);
  return NextResponse.json({ ok: true, today, due: due.length, sent: true, marked });
}
