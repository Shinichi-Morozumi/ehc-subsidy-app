import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ⑤簡易パスワード保護
// Vercel の環境変数 EHC_PASSCODE を設定すると全ページにパスコードゲートがかかる。
// 未設定なら従来どおり誰でも閲覧可（noindex＋URL限定共有のまま）。
// 合言葉入力後は cookie で30日間フリーパス。?d= 共有リンクも解錠後に元のURLへ戻る。
export function middleware(req: NextRequest) {
  const pass = process.env.EHC_PASSCODE;
  if (!pass) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/unlock") || pathname.startsWith("/api/unlock")) {
    return NextResponse.next();
  }

  if (req.cookies.get("ehc_pass")?.value === pass) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 静的アセット・PWA関連は保護対象外（インストール・アイコン表示を妨げない）
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-192.png|icon-512.png|apple-icon.png).*)",
  ],
};
