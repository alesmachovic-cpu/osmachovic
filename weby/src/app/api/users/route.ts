import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { sb } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/users — zoznam používateľov (len správca). */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req, { admin: true });
  if (auth.error) return auth.error;
  const { data, error } = await sb().from("weby_users").select("id, email, name, role, created_at, last_login_at").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

/** POST /api/users { email, name, role, password } — nový používateľ (len správca). */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { admin: true });
  if (auth.error) return auth.error;
  let body: { email?: string; name?: string; role?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const role = body.role === "admin" ? "admin" : "makler";
  const password = String(body.password || "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Neplatný e‑mail" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Chýba meno" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Heslo musí mať aspoň 8 znakov" }, { status: 400 });
  const { data, error } = await sb().from("weby_users")
    .insert({ email, name, role, password_hash: await bcrypt.hash(password, 10) })
    .select("id, email, name, role, created_at, last_login_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Tento e‑mail už existuje" : error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
