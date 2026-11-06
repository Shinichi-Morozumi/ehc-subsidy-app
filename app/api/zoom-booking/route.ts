import { NextResponse } from "next/server";
import { verifyZoomBooking, recoverZoomBooking, findZoomBookingByEmail } from "@/lib/zoomBookingServer";
import { clientKeyFromHeaders, overSubmitRateLimit } from "@/lib/submitRateLimit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (overSubmitRateLimit(`zoom:${clientKeyFromHeaders(req.headers)}`)) return NextResponse.json({ ok: false, error: "確認が続いています。少し待ってからお試しください。" }, { status: 429 });
  try {
    const body = await req.json();
    /* EHC-0150: findByEmail は戻り通知が届かない端末向け。参加URLは返さない */
    const booking = body.findByEmail === true ? await findZoomBookingByEmail(body.email) : body.manageUrl ? await recoverZoomBooking(body.manageUrl, body.email) : await verifyZoomBooking(body.booking, body.email);
    return NextResponse.json({ ok: true, booking }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "予約を確認できません。" }, { status: 400 });
  }
}
