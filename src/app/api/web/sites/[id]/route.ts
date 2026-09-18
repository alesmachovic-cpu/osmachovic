import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { canEditSite, isManager } from "@/lib/web/access";
import { slugify } from "@/lib/web/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadSite(id: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("web_sites").select("*").eq("id", id).maybeSingle();
  return data as { id: string; user_id: string | null; slug: string } | null;
}

/**
 * PUT /api/web/sites/[id] — uloží draft (autosave z adminu).
 * Body: { draft?, slug?, user_id?, poradie? } — slug/user_id/poradie môže meniť len manažér.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  const site = await loadSite(id);
  if (!site) return NextResponse.json({ error: "Web neexistuje" }, { status: 404 });
  if (!canEditSite(auth.user, site)) return NextResponse.json({ error: "Nemáš oprávnenie upravovať tento web" }, { status: 403 });

  let body: { draft?: unknown; slug?: string; user_id?: string | null; poradie?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (body.draft !== undefined) {
    if (typeof body.draft !== "object" || body.draft === null) return NextResponse.json({ error: "draft musí byť objekt" }, { status: 400 });
    if (JSON.stringify(body.draft).length > 4_000_000) return NextResponse.json({ error: "Dáta webu sú príliš veľké (max 4 MB) — fotky nahraj cez Nahrať fotku, nie ako base64." }, { status: 413 });
    patch.draft = body.draft;
  }
  if (isManager(auth.user.role)) {
    if (body.slug !== undefined) {
      const slug = slugify(body.slug);
      if (!slug) return NextResponse.json({ error: "Neplatná adresa" }, { status: 400 });
      const sb = getSupabaseAdmin();
      const { data: dup } = await sb.from("web_sites").select("id").eq("slug", slug).neq("id", id).maybeSingle();
      if (dup) return NextResponse.json({ error: `Adresa /web/${slug} je už obsadená` }, { status: 409 });
      patch.slug = slug;
    }
    if (body.user_id !== undefined) patch.user_id = body.user_id || null;
    if (body.poradie !== undefined) patch.poradie = Number(body.poradie) || 0;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nič na uloženie" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("web_sites").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: { ...data, canEdit: true } });
}

/** DELETE /api/web/sites/[id] — zmaže web (len manažér). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req, { requireRole: ["super_admin", "majitel", "manazer"] });
  if (auth.error) return auth.error;
  const { id } = await params;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("web_sites").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
