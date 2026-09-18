import { NextRequest, NextResponse } from "next/server";
import { requireUser, canEditSite } from "@/lib/auth";
import { sb, normalizeHost } from "@/lib/db";
import { slugify } from "@/lib/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/sites/[id] { draft?, slug?, domain?, user_id?, poradie? }
 * draft môže meniť vlastník aj správca; slug/domain/user_id/poradie len správca.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data: site } = await sb().from("weby_sites").select("id, user_id, slug").eq("id", id).maybeSingle();
  if (!site) return NextResponse.json({ error: "Web neexistuje" }, { status: 404 });
  if (!canEditSite(auth.user, site)) return NextResponse.json({ error: "Nemáš oprávnenie upravovať tento web" }, { status: 403 });

  let body: { draft?: unknown; slug?: string; domain?: string | null; user_id?: string | null; poradie?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (body.draft !== undefined) {
    if (typeof body.draft !== "object" || body.draft === null) return NextResponse.json({ error: "draft musí byť objekt" }, { status: 400 });
    if (JSON.stringify(body.draft).length > 4_000_000) return NextResponse.json({ error: "Dáta webu sú príliš veľké (max 4 MB)" }, { status: 413 });
    patch.draft = body.draft;
  }
  if (auth.user.role === "admin") {
    if (body.slug !== undefined) {
      const slug = slugify(body.slug);
      if (!slug) return NextResponse.json({ error: "Neplatná adresa" }, { status: 400 });
      const { data: dup } = await sb().from("weby_sites").select("id").eq("slug", slug).neq("id", id).maybeSingle();
      if (dup) return NextResponse.json({ error: `Adresa /s/${slug} je už obsadená` }, { status: 409 });
      patch.slug = slug;
    }
    if (body.domain !== undefined) {
      const domain = normalizeHost(body.domain);
      if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return NextResponse.json({ error: "Neplatná doména (napr. silviahurova.sk)" }, { status: 400 });
      if (domain) {
        const { data: dup } = await sb().from("weby_sites").select("id").eq("domain", domain).neq("id", id).maybeSingle();
        if (dup) return NextResponse.json({ error: `Doménu ${domain} už používa iný web` }, { status: 409 });
      }
      patch.domain = domain || null;
    }
    if (body.user_id !== undefined) patch.user_id = body.user_id || null;
    if (body.poradie !== undefined) patch.poradie = Number(body.poradie) || 0;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nič na uloženie" }, { status: 400 });

  const { data, error } = await sb().from("weby_sites").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: { ...data, canEdit: true } });
}

/** DELETE /api/sites/[id] — len správca. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req, { admin: true });
  if (auth.error) return auth.error;
  const { id } = await params;
  const { error } = await sb().from("weby_sites").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
