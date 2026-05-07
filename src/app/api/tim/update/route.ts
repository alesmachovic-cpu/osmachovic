import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

type Role = "super_admin" | "majitel" | "manazer" | "makler";
const VALID_ROLES: Role[] = ["super_admin", "majitel", "manazer", "makler"];

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const callerRole = auth.user.role as Role;
  const callerId = auth.user.id;

  // Len privilegované role môžu editovať
  if (!["super_admin", "majitel", "manazer"].includes(callerRole)) {
    return NextResponse.json({ error: "Nedostatočné oprávnenia" }, { status: 403 });
  }

  let body: { id: string; role?: Role; pobocka_id?: string | null };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Chýba id" }, { status: 400 });
  }

  if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Neplatná rola" }, { status: 400 });
  }

  if (body.pobocka_id !== undefined && body.pobocka_id !== null && typeof body.pobocka_id !== "string") {
    return NextResponse.json({ error: "Neplatná pobočka" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Načítaj cieľového usera
  const { data: target } = await sb.from("users").select("id, role, pobocka_id").eq("id", body.id).maybeSingle();
  if (!target) return NextResponse.json({ error: "User nenájdený" }, { status: 404 });

  const targetRole = target.role as Role;

  // RBAC pravidlá
  if (callerRole === "manazer") {
    // Manažér môže len meniť pobocka_id pre maklérov vo svojej pobočke
    const { data: callerData } = await sb.from("users").select("pobocka_id").eq("id", callerId).maybeSingle();
    const callerPobocka = callerData?.pobocka_id;
    if (targetRole !== "makler") {
      return NextResponse.json({ error: "Manažér môže editovať len maklérov" }, { status: 403 });
    }
    if (target.pobocka_id && target.pobocka_id !== callerPobocka) {
      return NextResponse.json({ error: "Maklér patrí inej pobočke" }, { status: 403 });
    }
    if (body.role !== undefined) {
      return NextResponse.json({ error: "Manažér nemôže meniť rolu" }, { status: 403 });
    }
    // Manažér môže len priradiť makléra do svojej pobočky alebo odbrať
    if (body.pobocka_id && body.pobocka_id !== callerPobocka) {
      return NextResponse.json({ error: "Nemôžeš priradiť do cudzej pobočky" }, { status: 403 });
    }
  }

  if (callerRole === "majitel") {
    // Majiteľ nemôže editovať super_admin
    if (targetRole === "super_admin") {
      return NextResponse.json({ error: "Majiteľ nemôže editovať super_admin" }, { status: 403 });
    }
    // Majiteľ nemôže prideliť rolu super_admin
    if (body.role === "super_admin") {
      return NextResponse.json({ error: "Majiteľ nemôže prideliť super_admin rolu" }, { status: 403 });
    }
  }

  // Nikto nemôže editovať sám seba cez toto API (pre rolu)
  if (body.id === callerId && body.role !== undefined) {
    return NextResponse.json({ error: "Nemôžeš si meniť vlastnú rolu" }, { status: 403 });
  }

  // Zostav patch
  const patch: Record<string, unknown> = {};
  if (body.role !== undefined) patch.role = body.role;
  if (body.pobocka_id !== undefined) patch.pobocka_id = body.pobocka_id;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nič na zmenu" }, { status: 400 });
  }

  const { data, error } = await sb.from("users").update(patch).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ user: data });
}
