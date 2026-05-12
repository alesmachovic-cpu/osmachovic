import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "./requireUser";

export type PlatformAdminResult =
  | { error: null; user: { id: string; name: string; email: string } }
  | { error: NextResponse; user: null };

export async function requirePlatformAdmin(req: NextRequest): Promise<PlatformAdminResult> {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return { error: auth.error, user: null };

  if (auth.user.role !== "platform_admin") {
    return {
      error: NextResponse.json({ error: "Prístup zamietnutý" }, { status: 403 }),
      user: null,
    };
  }

  return { error: null, user: { id: auth.user.id, name: auth.user.name, email: auth.user.email } };
}
