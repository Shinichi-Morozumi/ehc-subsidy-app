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
      {
        fetchedAt: new Date().toISOString(),
        count: items.length,
        verificationState: "needs_review",
        note: "J-Grants一覧APIによる候補発見結果です。詳細・公募要領を確認するまで申請可能とは表示しません。",
        items,
      },
      {
        headers: {
          // CDN側でも6時間キャッシュ・24hはstaleを許容
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { fetchedAt: new Date().toISOString(), count: 0, verificationState: "unavailable", items: [], error: "fetch_failed" },
      { status: 200 }
    );
  }
}
