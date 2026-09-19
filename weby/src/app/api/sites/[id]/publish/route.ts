import { NextRequest, NextResponse } from "next/server";
import { requireUser, canEditSite } from "@/lib/auth";
import { sb } from "@/lib/db";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** POST /api/sites/[id]/publish — draft → published. Body { unpublish: true } stiahne web. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data: site } = await sb().from("weby_sites").select("id, user_id, draft").eq("id", id).maybeSingle();
  if (!site) return NextResponse.json({ error: "Web neexistuje" }, { status: 404 });
  if (!canEditSite(auth.user, site)) return NextResponse.json({ error: "Nemáš oprávnenie publikovať tento web" }, { status: 403 });
  let body: { unpublish?: boolean } = {};
  try { body = await req.json(); } catch { /* publikovať */ }
  const patch = body.unpublish ? { published: null, published_at: null } : { published: site.draft, published_at: new Date().toISOString() };
  const { data, error } = await sb().from("weby_sites").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: { ...data, canEdit: true } });
}
