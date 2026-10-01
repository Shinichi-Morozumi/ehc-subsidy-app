import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* 2026-09-26 改善1: 検索エンジン向けの案内（/robots.txt）。
   担当者用の画面と API は巡回させない。ページ側でも noindex にしてある（二重の守り）。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/kanri", "/unlock"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
