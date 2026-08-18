import { NextResponse } from "next/server";
import { monitorOfficialSources } from "@/lib/program-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const result = await monitorOfficialSources();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" },
  });
}
