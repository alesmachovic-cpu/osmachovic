import { NextResponse } from "next/server";
import { buildLogoutCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/** POST /api/auth/logout — vymaže crm_session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildLogoutCookieValue());
  return res;
}
