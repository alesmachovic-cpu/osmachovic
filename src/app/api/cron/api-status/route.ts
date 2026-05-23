// Spustí sa každých 6 hodín cez Vercel cron (vercel.json).
// Skontroluje stav API kreditov a pošle email ak niečo nefunguje.

import { NextRequest, NextResponse } from "next/server";
import { GET as checkStatus } from "@/app/api/api-status/route";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const queryKey = request.nextUrl.searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fakeReq = new NextRequest("http://localhost/api/api-status?alert=1");
  const res = await checkStatus(fakeReq);
  const data = await res.json();
  return NextResponse.json({ checked: true, statuses: data });
}
