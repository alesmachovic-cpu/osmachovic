import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { OBCHOD_PRESET } from "@/lib/obchodPreset";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** GET /api/obchody?klient_id=X — zoznam obchodov klienta vrátane úloh */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const klientId = req.nextUrl.searchParams.get("klient_id");
  if (!klientId) return NextResponse.json({ error: "Chýba klient_id" }, { status: 400 });

  const sb = getSupabaseAdmin();
  // 🔒 S6 cross-tenant guard — obchody (cena, provízia) len z firmy callera.
  const { data, error } = await sb
    .from("obchody")
    .select("*, obchod_ulohy(*)")
    .eq("klient_id", klientId)
    .eq("company_id", auth.user.company_id)
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

  // P0 fix 2026-05-24: obchody.company_id je NOT NULL, derive z klienta
  // (authoritative source — obchod patrí do firmy svojho klienta).
  const { data: klient, error: klientErr } = await sb
    .from("klienti")
    .select("company_id")
    .eq("id", body.klient_id)
    .single();
  if (klientErr || !klient) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  if (!klient.company_id) return NextResponse.json({ error: "Klient bez company_id (legacy záznam)" }, { status: 500 });

  const { data: obchod, error: obchodErr } = await sb
    .from("obchody")
    .insert({
      klient_id:       body.klient_id,
      company_id:      klient.company_id,
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

  // Naseeduj preset úlohy — company_id musí byť NOT NULL (P0 fix 2026-05-24).
  const seedRows = OBCHOD_PRESET.map(u => ({
    obchod_id:  obchod.id,
    company_id: klient.company_id,
    kategoria:  u.kategoria,
    nazov:      u.nazov,
    popis:      u.popis ?? null,
    priorita:   u.priorita,
  }));

  const { error: seedErr } = await sb.from("obchod_ulohy").insert(seedRows);
  if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });

  // Načítaj hotový obchod vrátane úloh
  const { data: full } = await sb
    .from("obchody")
    .select("*, obchod_ulohy(*)")
    .eq("id", obchod.id)
    .single();

  await logAudit({
    action: "obchod.create",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: obchod.id,
    target_type: "obchod",
    detail: {
      klient_id: body.klient_id,
      nehnutelnost_id: body.nehnutelnost_id ?? null,
      cena: body.cena ?? null,
      provizia: body.provizia ?? null,
    },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({ obchod: full }, { status: 201 });
}
