import { NextRequest, NextResponse } from "next/server";
import { requireUser, canEditSite } from "@/lib/auth";
import { sb, loadNastavenia } from "@/lib/db";
import { emptyMakler } from "@/lib/defaults";
import { slugify, type WebSite } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/sites — správca vidí všetky weby, maklér iba svoje. */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const [{ data, error }, nastavenia] = await Promise.all([
    sb().from("weby_sites").select("*").order("poradie").order("created_at"),
    loadNastavenia(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const all = (data ?? []) as WebSite[];
  const sites = auth.user.role === "admin" ? all : all.filter(s => s.user_id === auth.user.id);
  return NextResponse.json({
    sites: sites.map(s => ({ ...s, canEdit: canEditSite(auth.user, s) })),
    nastavenia,
    isAdmin: auth.user.role === "admin",
    primaryHost: process.env.PRIMARY_HOST || null,
  });
}

/** POST /api/sites { name?, user_id?, copyOf? } — nový web makléra (len správca). */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { admin: true });
  if (auth.error) return auth.error;
  let body: { name?: string; user_id?: string | null; copyOf?: string };
  try { body = await req.json(); } catch { body = {}; }

  let draft = emptyMakler();
  if (body.copyOf) {
    const { data: src } = await sb().from("weby_sites").select("draft").eq("id", body.copyOf).maybeSingle();
    if (src?.draft && (src.draft as { typ: string }).typ === "makler") {
      draft = { ...(src.draft as typeof draft), name: `${(src.draft as typeof draft).name} (kópia)` };
    }
  }
  if (body.name) draft.name = body.name;

  const base = slugify(draft.name);
  const { data: existing } = await sb().from("weby_sites").select("slug");
  const taken = new Set((existing ?? []).map(r => r.slug as string));
  let slug = base, i = 2;
  while (taken.has(slug)) slug = `${base}-${i++}`;
  const { data: maxRow } = await sb().from("weby_sites").select("poradie").order("poradie", { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await sb().from("weby_sites")
    .insert({ slug, typ: "makler", user_id: body.user_id ?? null, poradie: ((maxRow?.poradie as number) ?? 0) + 1, draft, published: null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: { ...data, canEdit: true } });
}
