// Spustí sa každých 6 hodín cez Vercel cron (vercel.json).
// Skontroluje stav API kreditov a pošle email ak niečo nefunguje.

import { NextResponse } from "next/server";
import { GET as checkStatus } from "@/app/api/api-status/route";
import { NextRequest } from "next/server";

export async function GET() {
  const fakeReq = new NextRequest("http://localhost/api/api-status?alert=1");
  const res = await checkStatus(fakeReq);
  const data = await res.json();
  return NextResponse.json({ checked: true, statuses: data });
}
