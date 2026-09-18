import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { canEditSite } from "@/lib/web/access";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/web/sites/[id]/publish — skopíruje draft do published (web ide naživo).
 * Body { unpublish: true } — stiahne web z verejnosti (published = null).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { id } = await params;

  const sb = getSupabaseAdmin();
  const { data: site } = await sb.from("web_sites").select("id, user_id, draft").eq("id", id).maybeSingle();
  if (!site) return NextResponse.json({ error: "Web neexistuje" }, { status: 404 });
  if (!canEditSite(auth.user, site)) return NextResponse.json({ error: "Nemáš oprávnenie publikovať tento web" }, { status: 403 });

  let body: { unpublish?: boolean } = {};
  try { body = await req.json(); } catch { /* prázdne telo = publikovať */ }

  const patch = body.unpublish
    ? { published: null, published_at: null }
    : { published: site.draft, published_at: new Date().toISOString() };

  const { data, error } = await sb.from("web_sites").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: { ...data, canEdit: true } });
}
