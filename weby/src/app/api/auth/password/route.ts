import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { sb } from "@/lib/db";

export const runtime = "nodejs";

/** POST /api/auth/password { current, next } — zmena vlastného hesla. */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  let body: { current?: string; next?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const next = String(body.next || "");
  if (next.length < 8) return NextResponse.json({ error: "Nové heslo musí mať aspoň 8 znakov" }, { status: 400 });
  const { data: u } = await sb().from("weby_users").select("password_hash").eq("id", auth.user.id).single();
  if (!u || !(await bcrypt.compare(String(body.current || ""), u.password_hash as string))) {
    return NextResponse.json({ error: "Súčasné heslo nesedí" }, { status: 400 });
  }
  await sb().from("weby_users").update({ password_hash: await bcrypt.hash(next, 10) }).eq("id", auth.user.id);
  return NextResponse.json({ ok: true });
}
