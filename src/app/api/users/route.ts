import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

// GET — dva módy podľa cookie:
//   - autentifikovaný (má crm_session) → plné dáta (potrebuje AuthProvider + nastavenia)
//   - neautentifikovaný → len id, name, initials (pre login screen — výber účtu)
export async function GET(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const auth = await requireUser(req);
    const authed = auth.error === null;

    const select = authed
      ? "id, name, initials, role, email, login_email, pobocka_id, notification_prefs, vzorove_inzeraty, nav_prefs, created_at"
      : "id, name, initials";

    const { data, error } = await sb.from("users").select(select).order("created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — len admin
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request as NextRequest);
    if (auth.error) return auth.error;
    if (!isSuperAdmin(auth.user.role)) return NextResponse.json({ error: "Len admin môže vytvárať účty" }, { status: 403 });

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

// PATCH — len admin
export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request as NextRequest);
    if (auth.error) return auth.error;
    if (!isSuperAdmin(auth.user.role)) return NextResponse.json({ error: "Len admin môže upravovať účty" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const allowedFields = ["name", "initials", "role", "email", "login_email", "password", "notification_prefs", "vzorove_inzeraty", "pobocka_id", "nav_prefs"];
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

// DELETE — len admin
export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request as NextRequest);
    if (auth.error) return auth.error;
    if (!isSuperAdmin(auth.user.role)) return NextResponse.json({ error: "Len admin môže mazať účty" }, { status: 403 });

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
