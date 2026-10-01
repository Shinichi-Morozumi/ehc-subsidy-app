import { NextResponse } from "next/server";
import { clientKeyFromHeaders } from "@/lib/submitRateLimit";
import {
  parseBillAnswer,
  parseNameplateAnswer,
  promptFor,
  splitImageDataUrl,
  type PhotoKind,
} from "@/lib/photoRead";

/* ───────────────────────────────────────────────────────────
   写真から入力を読み取る口（2026-09-26 改善11）

   画面が縮めて送ってきた写真（data URL）を Anthropic 社の API（Claude）に渡し、
   読み取った値を lib/photoRead.ts の決まりで確かめてから返す。

   ■ 必要な環境変数（Vercel）
   　　ANTHROPIC_API_KEY … Anthropic の API キー（無い間は 503 を返し、画面にもボタンを出さない）
   　　PHOTO_READ_MODEL  … 使うモデル（省略時 claude-sonnet-5）
   ■ 守ること
   　　・画像はどこにも保存しない。ログにも画像や読み取った値を書かない（種類・成否・所要時間だけ）。
   　　・1つの接続元から1時間に20枚まで（費用の暴走を防ぐ。記録はプロセス内のメモリなので目安）。
   ─────────────────────────────────────────────────────────── */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function overLimit(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}

const NG = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NG(503, "写真の読み取りは、ただいま使えません。数字を手で入力してください。");

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NG(400, "リクエスト形式が不正です。");
    body = parsed as Record<string, unknown>;
  } catch {
    return NG(400, "写真が大きすぎるか、形式が読めません。");
  }
  const kind: PhotoKind | null = body.kind === "bill" || body.kind === "nameplate" ? body.kind : null;
  if (!kind) return NG(400, "読み取る種類が不正です。");
  const image = splitImageDataUrl(body.image);
  if (!image) return NG(400, "写真の形式が読めません（JPEG・PNG・WebP、4MBまで）。");
  if (overLimit(clientKeyFromHeaders(req.headers))) {
    return NG(429, "短い時間に読み取りが続いたため、いったん止めています。数字を手で入力してください。");
  }

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.PHOTO_READ_MODEL || "claude-sonnet-5",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
              { type: "text", text: promptFor(kind) },
            ],
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[read-photo] AI の呼び出しに失敗（${kind}・${res.status}）:`, detail.slice(0, 300));
      return NG(502, "写真を読み取れませんでした。数字を手で入力してください。");
    }
    const data = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
    const answer = (data?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    const parsed = kind === "bill" ? parseBillAnswer(answer) : parseNameplateAnswer(answer);
    console.info(`[read-photo] ${kind} ${parsed ? "読み取り" : "読めず"}（${Date.now() - started}ms）`);
    if (!parsed) {
      return NG(422, kind === "bill"
        ? "明細の数字を読み取れませんでした。明るい場所で、使用量と請求額が写るように撮り直すか、手で入力してください。"
        : "銘板の文字を読み取れませんでした。銘板に近づいて、文字がはっきり写るように撮り直すか、手で入力してください。");
    }
    return NextResponse.json(parsed);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error(`[read-photo] ${kind} ${aborted ? "時間切れ" : "例外"}:`, e instanceof Error ? e.message : String(e));
    return NG(504, "読み取りに時間がかかりすぎました。数字を手で入力してください。");
  } finally {
    clearTimeout(timer);
  }
}
