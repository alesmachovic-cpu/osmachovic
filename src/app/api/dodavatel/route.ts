import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const FIELDS = [
  "nazov", "adresa", "ico", "dic", "ic_dph",
  "iban", "banka", "swift", "obch_register", "konst_symbol",
  "email", "telefon", "splatnost_dni", "uvodny_text", "poznamka_default", "vystavil",
  "podpis_data",
] as const;

function pickFields(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    if (k in input) out[k] = input[k];
  }
  return out;
}

export async function GET(req: NextRequest) {
  const __auth = await requireUser(req as NextRequest); if (__auth.error) return __auth.error;
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("makler_dodavatel")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || null);
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const userId = body?.user_id;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  // P1 cross-user guard: bežný user môže editovať len SVOJ dodávateľ záznam.
  if (userId !== auth.user.id && auth.user.role !== "super_admin" && auth.user.role !== "majitel") {
    return NextResponse.json({ error: "Môžeš editovať len svoje fakturačné údaje" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const payload = { user_id: userId, ...pickFields(body) };
  const { data, error } = await sb
    .from("makler_dodavatel")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    action: "dodavatel.upsert",
    actor_id: auth.user.id, actor_name: auth.user.name,
    target_id: userId, target_type: "makler_dodavatel",
    detail: { fields_changed: Object.keys(pickFields(body)) },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json(data);
}
