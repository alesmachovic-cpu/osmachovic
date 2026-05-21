import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";
import { CreateUserSchema } from "@/lib/schemas";
import { validatePasswordStrength } from "@/lib/auth/password";
import { requireReAuth } from "@/lib/auth/reAuth";

export const runtime = "nodejs";

// 🚨 FIX 2026-05-20 (P1 cross-tenant leak):
//   Pôvodne GET vracal users všetkých firiem (chýbal filter na company_id).
//   Authenticated user firmy A videl celý zoznam users firmy B → multi-tenant
//   security breach.
//   Teraz: filter na auth.user.company_id. Iba `platform_admin` (super-super
//   admin pre celú platformu) môže vidieť cross-tenant cez ?all=1.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const sb = getSupabaseAdmin();
    const select = "id, name, initials, role, email, login_email, telefon, pobocka_id, makler_id, company_id, notification_prefs, vzorove_inzeraty, nav_prefs, created_at";

    const { searchParams } = new URL(req.url);
    const wantsAll = searchParams.get("all") === "1";
    const isPlatformAdmin = auth.user.role === "platform_admin";

    let q = sb.from("users").select(select).order("created_at");
    if (!(wantsAll && isPlatformAdmin)) {
      q = q.eq("company_id", auth.user.company_id);
    }
    const { data, error } = await q;
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

    // Pre makléra automaticky vytvor makleri záznam a nalinkuj ho.
    // company_id MUSÍ byť vyplnené (cross-tenant scope, migrácia 074).
    let maklerUuid: string | null = null;
    if (body.role === "makler") {
      const { data: mk, error: mkErr } = await sb.from("makleri").insert({
        meno: body.name,
        email: body.login_email || body.email || null,
        aktivny: true,
        company_id: auth.user.company_id,
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Self-update: každý maklér môže upraviť VLASTNÝ profil (telefon, meno, email).
    // Cudzí účet (id !== auth.user.id) môže meniť iba super_admin.
    const isSelf = id === auth.user.id;
    if (!isSelf && !isSuperAdmin(auth.user.role)) {
      return NextResponse.json({ error: "Len admin môže upravovať cudzie účty" }, { status: 403 });
    }

    const body = await request.json();
    if (body.password) {
      const pwCheck = validatePasswordStrength(body.password);
      if (!pwCheck.valid) return NextResponse.json({ error: pwCheck.message }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    // Polia ktoré ktokoľvek môže meniť na VLASTNOM účte.
    const selfFields = ["name", "initials", "email", "telefon", "notification_prefs", "vzorove_inzeraty", "nav_prefs"];
    // Polia ktoré môže meniť IBA admin (sensitive: role escalation, password reset, pobocka assignment).
    const adminFields = ["role", "login_email", "password", "pobocka_id"];
    const allowedFields = isSelf && !isSuperAdmin(auth.user.role)
      ? selfFields
      : [...selfFields, ...adminFields];
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key] ?? null;
    }

    // 🔒 M1 force re-auth pre security-sensitive zmeny:
    //   - role change (privilege escalation prevention)
    //   - password reset (cudzí account hijack prevention)
    if ("role" in updates || "password" in updates) {
      const reAuth = await requireReAuth({
        userId: auth.user.id,
        password: typeof body.confirm_password === "string" ? body.confirm_password : undefined,
        code: typeof body.confirm_code === "string" ? body.confirm_code : undefined,
      });
      if (!reAuth.ok) {
        return NextResponse.json({
          error: reAuth.error,
          code: "RE_AUTH_REQUIRED",
          action: "role" in updates ? "role_change" : "password_change",
        }, { status: reAuth.status });
      }
    }

    const sb = getSupabaseAdmin();
    // 🚨 P1 cross-tenant fix: over že target patrí do tej istej firmy.
    // platform_admin môže update naprieč firmami.
    const { data: target } = await sb.from("users").select("company_id").eq("id", id).maybeSingle();
    if (!target) return NextResponse.json({ error: "Užívateľ nenájdený" }, { status: 404 });
    if (target.company_id !== auth.user.company_id && auth.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Užívateľ patrí do inej firmy" }, { status: 403 });
    }
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
    // 🚨 P1 cross-tenant fix: over že target patrí do tej istej firmy.
    const { data: target } = await sb.from("users").select("company_id").eq("id", id).maybeSingle();
    if (!target) return NextResponse.json({ error: "Užívateľ nenájdený" }, { status: 404 });
    if (target.company_id !== auth.user.company_id && auth.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Užívateľ patrí do inej firmy" }, { status: 403 });
    }
    // Nullify FK references pred delete — faktury/odberatelia nemajú ON DELETE SET NULL.
    // Filter NA company_id (defence-in-depth) — neprepíšeme záznamy v inej firme.
    await sb.from("faktury").update({ user_id: null }).eq("user_id", id).eq("company_id", target.company_id);
    await sb.from("odberatelia").update({ user_id: null }).eq("user_id", id).eq("company_id", target.company_id);
    const { error } = await sb.from("users").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({ action: "user.delete", actor_id: auth.user.id, actor_name: auth.user.name, target_id: id, target_type: "user", ip_address: (request as NextRequest).headers.get("x-forwarded-for") || undefined });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
