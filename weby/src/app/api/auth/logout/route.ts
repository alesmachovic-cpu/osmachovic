import { NextResponse } from "next/server";
import { logoutCookie } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", logoutCookie());
  return res;
}
