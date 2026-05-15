import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";
import { CreateUserSchema } from "@/lib/schemas";
import { validatePasswordStrength } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const sb = getSupabaseAdmin();
    const select = "id, name, initials, role, email, login_email, pobocka_id, makler_id, company_id, notification_prefs, vzorove_inzeraty, nav_prefs, created_at";
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

    const rawBody = await request.json();
    const parsed = CreateUserSchema.safeParse(rawBody);
    if (!parsed.success) return NextResponse.json({ error: "Neplatné dáta", details: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data;
    const userId = body.id || rawBody.id;
    const sb = getSupabaseAdmin();

    // Pre makléra automaticky vytvor makleri záznam a nalinkuj ho
    let maklerUuid: string | null = null;
    if (body.role === "makler") {
      const { data: mk, error: mkErr } = await sb.from("makleri").insert({
        meno: body.name,
        email: body.login_email || body.email || null,
        aktivny: true,
      }).select("id").single();
      if (mkErr) return NextResponse.json({ error: "Chyba pri vytváraní maklér záznamu: " + mkErr.message }, { status: 500 });
      maklerUuid = mk.id;
    }

    const { error } = await sb.from("users").insert({
      id: userId,
      name: body.name,
      initials: body.initials,
      role: body.role,
      ...(body.email ? { email: body.email } : {}),
      login_email: body.login_email || null,
      password: body.password || "",
      company_id: auth.user.company_id,
      ...(maklerUuid ? { makler_id: maklerUuid } : {}),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({ action: "user.create", actor_id: auth.user.id, actor_name: auth.user.name, target_id: userId, target_type: "user", target_name: body.name, ip_address: (request as NextRequest).headers.get("x-forwarded-for") || undefined });
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
    if (body.password) {
      const pwCheck = validatePasswordStrength(body.password);
      if (!pwCheck.valid) return NextResponse.json({ error: pwCheck.message }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    const allowedFields = ["name", "initials", "role", "email", "login_email", "password", "notification_prefs", "vzorove_inzeraty", "pobocka_id", "nav_prefs"];
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key] ?? null;
    }

    const sb = getSupabaseAdmin();
    const { error } = await sb.from("users").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({ action: "user.update", actor_id: auth.user.id, actor_name: auth.user.name, target_id: id, target_type: "user", ip_address: (request as NextRequest).headers.get("x-forwarded-for") || undefined });
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
    // Nullify FK references pred delete — faktury/odberatelia nemajú ON DELETE SET NULL
    await sb.from("faktury").update({ user_id: null }).eq("user_id", id);
    await sb.from("odberatelia").update({ user_id: null }).eq("user_id", id);
    const { error } = await sb.from("users").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({ action: "user.delete", actor_id: auth.user.id, actor_name: auth.user.name, target_id: id, target_type: "user", ip_address: (request as NextRequest).headers.get("x-forwarded-for") || undefined });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
