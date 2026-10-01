"use client";

import { useId, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import {
  PHOTO_MAX_EDGE,
  type BillReading,
  type NameplateReading,
  type PhotoKind,
  type PhotoReadResponse,
} from "@/lib/photoRead";

/* ───────────────────────────────────────────────────────────
   写真から入力を読み取るボタン（2026-09-26 改善11）

   ・サーバに Anthropic の API キーがあるとき（ビルド時に NEXT_PUBLIC_PHOTO_READ="on"）だけ表示する。
   ・写真は端末の中で長い辺 1600px の JPEG に縮めてから送る（通信量を減らし、上限の内側に収める）。
   ・読み取った値は onRead で渡すだけ。入れるかどうか・どの欄に入れるかは呼ぶ側が決める。
   ・読み取りの結果は「確認してください」と必ず添える（確定値ではない）。
   ─────────────────────────────────────────────────────────── */

export const PHOTO_READ_ON = process.env.NEXT_PUBLIC_PHOTO_READ === "on";

type ReadingOf<K extends PhotoKind> = K extends "bill" ? BillReading : NameplateReading;

async function shrinkToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("画像を開けませんでした。"));
      el.src = url;
    });
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を処理できませんでした。");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoReadButton<K extends PhotoKind>({
  kind,
  label,
  onRead,
  className,
}: {
  kind: K;
  label: string;
  onRead: (reading: ReadingOf<K>, info: { confidence: string; note: string | null }) => void;
  className?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (!PHOTO_READ_ON) return null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const image = await shrinkToJpeg(file);
      const res = await fetch("/api/read-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, image }),
      });
      const json = (await res.json().catch(() => null)) as PhotoReadResponse | null;
      if (!json || !json.ok) {
        track("photo_read", { kind, ok: false });
        setMessage({ kind: "error", text: json && !json.ok ? json.error : "写真を読み取れませんでした。数字を手で入力してください。" });
        return;
      }
      track("photo_read", { kind, ok: true });
      onRead(json.reading as ReadingOf<K>, { confidence: json.confidence, note: json.note });
      setMessage({
        kind: "ok",
        text:
          (json.confidence === "low" ? "読み取りに自信がない値があります。" : "読み取った値を入れました。") +
          (kind === "bill" ? "明細と見比べて、違っていたら直してください。" : "銘板と見比べて、違っていたら直してください。") +
          (json.note ? `（${json.note}）` : ""),
      });
    } catch (e) {
      track("photo_read", { kind, ok: false });
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "写真を読み取れませんでした。" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        id={`${id}-file`}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
        disabled={busy}
      />
      <label
        htmlFor={`${id}-file`}
        className={cn(
          "inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-brand bg-paper-card px-4 text-[16px] font-bold leading-[1.6] text-brand-deep",
          "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-deep",
          busy && "cursor-wait opacity-70"
        )}
      >
        {busy ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Camera aria-hidden className="h-5 w-5" />}
        {busy ? "読み取っています…" : label}
      </label>
      <p className="text-[14px] leading-[1.7] text-ink-soft">
        写真は読み取りにだけ使い、保存しません（読み取りは外部のAIサービスで行います）。
      </p>
      <p aria-live="polite" className={cn("text-[14px] leading-[1.7]", message?.kind === "error" ? "font-bold text-red-800" : "text-ink")}>
        {message?.text ?? ""}
      </p>
    </div>
  );
}
