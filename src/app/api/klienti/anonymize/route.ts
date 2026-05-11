import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * POST /api/klienti/anonymize
 * Body: { id: string }
 *
 * Právo na zabudnutie podľa GDPR (čl. 17). Anonymizuje osobné údaje klienta:
 *   meno → "[anonymizovaný]"
 *   telefon, email, lokalita, poznamka, lv_data → NULL
 *   anonymized_at → now()
 *
 * Operácia je nevratná — vyžaduje admin.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) return NextResponse.json({ error: "Anonymizáciu môže spustiť len admin" }, { status: 403 });

  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("klienti").update({
    meno: "[anonymizovaný]",
    telefon: null,
    email: null,
    lokalita: null,
    poznamka: null,
    lv_data: null,
    anonymized_at: new Date().toISOString(),
  }).eq("id", body.id).select("id, anonymized_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, klient: data });
}
