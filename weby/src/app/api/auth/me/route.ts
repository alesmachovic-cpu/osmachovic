import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

/** GET /api/auth/me → { user } alebo 401 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  return NextResponse.json({ user: auth.user });
}
