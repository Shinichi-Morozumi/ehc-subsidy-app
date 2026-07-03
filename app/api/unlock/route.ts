import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 合言葉を検証し、一致すれば30日間有効の cookie を発行する
export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  const pass = process.env.EHC_PASSCODE;

  if (!pass || typeof code !== "string" || code !== pass) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("ehc_pass", pass, {
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
