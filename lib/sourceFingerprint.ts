// v1 / 2026-10-26 / EHC-0095: 内容差分用。取得成功を制度確認済みとは扱わない。
import { createHash } from "node:crypto";

export function officialContent(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  return main.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
export function sourceFingerprint(html: string): string {
  return createHash("sha256").update(officialContent(html)).digest("hex");
}
