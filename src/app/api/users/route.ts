import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * /api/users — CRUD pre users tabuľku cez admin client (obchádza RLS).
 *
 * Prečo: po zapnutí RLS na users tabuľke môže anon key iba SELECT.
 * Všetky write operácie musia ísť cez tento endpoint.
 *
 * Security: každá mutation by mala overiť kto ju volá (audit log v migrácii 012).
 * Pre teraz: admin operácie (addAccount, deleteAccount) by mal robiť iba Aleš.
 * Frontend si to samo gateuje cez isAdmin check.
 */

// GET /api/users — list (rovnaké ako priame SELECT cez anon, ale pre konzistenciu)
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("users")
      .select("id, name, initials, role, email, login_email, pobocka_id, notification_prefs, vzorove_inzeraty, created_at")
      .order("created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/users — vytvor nového usera (iba admin)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("users").insert({
      id: body.id,
      name: body.name,
      initials: body.initials,
      role: body.role,
      email: body.email,
      login_email: body.login_email || null,
      password: body.password || "",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/users?id=xxx — update usera
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const allowedFields = ["name", "initials", "role", "email", "login_email", "password", "notification_prefs", "vzorove_inzeraty", "pobocka_id"];
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key] ?? null;
    }

    const sb = getSupabaseAdmin();
    const { error } = await sb.from("users").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/users?id=xxx — iba admin
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { error } = await sb.from("users").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
