import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { canEditSite, isManager } from "@/lib/web/access";
import { emptyMakler } from "@/lib/web/defaults";
import { loadNastavenia } from "@/lib/web/db";
import { slugify, type WebSite } from "@/lib/web/types";

export const runtime = "nodejs";

/** GET /api/web/sites — zoznam webov (maklér vidí všetky, editovať môže len svoj) + nastavenia. */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const [{ data, error }, nastavenia] = await Promise.all([
    sb.from("web_sites").select("*").order("poradie").order("created_at"),
    loadNastavenia(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sites = (data ?? []) as WebSite[];
  return NextResponse.json({
    sites: sites.map(s => ({ ...s, canEdit: canEditSite(auth.user, s) })),
    nastavenia,
    isManager: isManager(auth.user.role),
  });
}

/** POST /api/web/sites — nový web makléra (len manažér). Body: { name?, user_id?, copyOf? } */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { requireRole: ["super_admin", "majitel", "manazer"] });
  if (auth.error) return auth.error;

  let body: { name?: string; user_id?: string | null; copyOf?: string };
  try { body = await req.json(); } catch { body = {}; }

  const sb = getSupabaseAdmin();
  let draft = emptyMakler();
  if (body.copyOf) {
    const { data: src } = await sb.from("web_sites").select("draft").eq("id", body.copyOf).maybeSingle();
    if (src?.draft && (src.draft as { typ: string }).typ === "makler") {
      draft = { ...(src.draft as typeof draft), name: `${(src.draft as typeof draft).name} (kópia)` };
    }
  }
  if (body.name) draft.name = body.name;

  // Unikátny slug
  const base = slugify(draft.name);
  const { data: existing } = await sb.from("web_sites").select("slug");
  const taken = new Set((existing ?? []).map(r => r.slug as string));
  let slug = base, i = 2;
  while (taken.has(slug)) slug = `${base}-${i++}`;

  const { data: maxRow } = await sb.from("web_sites").select("poradie").order("poradie", { ascending: false }).limit(1).maybeSingle();
  const poradie = ((maxRow?.poradie as number) ?? 0) + 1;

  const { data, error } = await sb.from("web_sites")
    .insert({ slug, typ: "makler", user_id: body.user_id ?? null, poradie, draft, published: null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: { ...data, canEdit: true } });
}
