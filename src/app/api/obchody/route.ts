import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { OBCHOD_PRESET } from "@/lib/obchodPreset";

export const runtime = "nodejs";

/** GET /api/obchody?klient_id=X — zoznam obchodov klienta vrátane úloh */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const klientId = req.nextUrl.searchParams.get("klient_id");
  if (!klientId) return NextResponse.json({ error: "Chýba klient_id" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("obchody")
    .select("*, obchod_ulohy(*)")
    .eq("klient_id", klientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ obchody: data ?? [] });
}

/** POST /api/obchody — vytvorí obchod + naseeduje preset úlohy */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: {
    klient_id: string;
    nehnutelnost_id?: string | null;
    cena?: number | null;
    provizia?: number | null;
    kupujuci_meno?: string | null;
    notar?: string | null;
    banka?: string | null;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (!body.klient_id) return NextResponse.json({ error: "Chýba klient_id" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: obchod, error: obchodErr } = await sb
    .from("obchody")
    .insert({
      klient_id:       body.klient_id,
      nehnutelnost_id: body.nehnutelnost_id ?? null,
      cena:            body.cena ?? null,
      provizia:        body.provizia ?? null,
      kupujuci_meno:   body.kupujuci_meno ?? null,
      notar:           body.notar ?? null,
      banka:           body.banka ?? null,
    })
    .select()
    .single();

  if (obchodErr) return NextResponse.json({ error: obchodErr.message }, { status: 500 });

  // Naseeduj preset úlohy
  const seedRows = OBCHOD_PRESET.map(u => ({
    obchod_id: obchod.id,
    kategoria: u.kategoria,
    nazov:     u.nazov,
    popis:     u.popis ?? null,
    priorita:  u.priorita,
  }));

  const { error: seedErr } = await sb.from("obchod_ulohy").insert(seedRows);
  if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });

  // Načítaj hotový obchod vrátane úloh
  const { data: full } = await sb
    .from("obchody")
    .select("*, obchod_ulohy(*)")
    .eq("id", obchod.id)
    .single();

  return NextResponse.json({ obchod: full }, { status: 201 });
}
