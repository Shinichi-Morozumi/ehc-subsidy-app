import { NextResponse } from "next/server";
import { fetchLiveSubsidies } from "@/lib/jgrants";

// Jグランツ公開APIをサーバー側で叩いて正規化して返す。
// クライアントから直接叩かずここを経由することで、CORS回避＋キャッシュ集約する。
export const runtime = "nodejs";
export const revalidate = 21600; // 6時間

export async function GET() {
  try {
    const items = await fetchLiveSubsidies();
    return NextResponse.json(
      { updatedAt: new Date().toISOString(), count: items.length, items },
      {
        headers: {
          // CDN側でも6時間キャッシュ・24hはstaleを許容
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { updatedAt: new Date().toISOString(), count: 0, items: [], error: "fetch_failed" },
      { status: 200 }
    );
  }
}
