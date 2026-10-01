import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* 2026-09-26 改善1: サイトの地図（/sitemap.xml）。Search Console に登録して、検索エンジンに知らせる。
   ページを増やしたらここにも足す。担当者用の画面は載せない。 */
const UPDATED = new Date("2026-09-26T00:00:00+09:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/kaigo`, lastModified: new Date("2026-10-01T00:00:00+09:00"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/company`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
}
