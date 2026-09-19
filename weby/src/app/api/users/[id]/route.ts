import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { sb } from "@/lib/db";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/users/[id] { name?, role?, password? } — úprava, reset hesla (len správca). */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req, { admin: true });
  if (auth.error) return auth.error;
  const { id } = await params;
  let body: { name?: string; role?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.role !== undefined) {
    if (id === auth.user.id && body.role !== "admin") return NextResponse.json({ error: "Sám sebe nemôžeš odobrať správcu" }, { status: 400 });
    patch.role = body.role === "admin" ? "admin" : "makler";
  }
  if (body.password) {
    if (body.password.length < 8) return NextResponse.json({ error: "Heslo musí mať aspoň 8 znakov" }, { status: 400 });
    patch.password_hash = await bcrypt.hash(body.password, 10);
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nič na uloženie" }, { status: 400 });
  const { data, error } = await sb().from("weby_users").update(patch).eq("id", id).select("id, email, name, role, created_at, last_login_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

/** DELETE /api/users/[id] (len správca, nie seba). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req, { admin: true });
  if (auth.error) return auth.error;
  const { id } = await params;
  if (id === auth.user.id) return NextResponse.json({ error: "Sám seba nemôžeš zmazať" }, { status: 400 });
  const { error } = await sb().from("weby_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
