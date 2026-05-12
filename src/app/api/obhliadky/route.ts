import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserScope, canEditRecord } from "@/lib/scope";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/obhliadky
 *   ?klient_id=X    → obhliadky kde X je predávajúci ALEBO kupujúci
 *   ?nehnutelnost_id=X → obhliadky pre konkrétny inzerát
 *   bez parametrov → všetky obhliadky (admin)
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const klientId = req.nextUrl.searchParams.get("klient_id");
  const nehnId = req.nextUrl.searchParams.get("nehnutelnost_id");

  let q = sb.from("obhliadky").select("*").order("datum", { ascending: false });
  if (klientId) {
    q = q.or(`predavajuci_klient_id.eq.${klientId},kupujuci_klient_id.eq.${klientId}`);
  }
  if (nehnId) q = q.eq("nehnutelnost_id", nehnId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ obhliadky: data || [] });
}

/** Normalizuje SK telefón na kanonický tvar (digits-only, "0…" → "+421…"). */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).replace(/[\s().\-]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+421" + s.slice(1);
  return s;
}

/**
 * POST /api/obhliadky
 * Body:
 *  {
 *    predavajuci_klient_id, nehnutelnost_id,
 *    kupujuci_klient_id?, kupujuci_meno?, kupujuci_telefon?, kupujuci_email?,
 *    makler_id?, datum, miesto?, poznamka?, calendar_event_id?
 *  }
 *
 * Po vytvorení obhliadky: ak je vyplnený kupujúci (meno + telefón) a nie je
 * priradený žiadny kupujuci_klient_id, pokus sa nájsť alebo vytvoriť kupujúceho
 * v tabuľke `klienti`:
 *   - match podľa normalizovaného telefónu
 *   - ak nájdený a nehnuteľnosť je iná ako jeho doterajší záujem → poznámka
 *     "má záujem aj o {adresa}" + doplň chýbajúce polia (email)
 *   - ak nenájdený → vytvor nového klienta typ=kupujuci so zdrojom obhliadky
 *   - vždy zapíš zdrojového makléra do poznámky
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  if (!body.datum) return NextResponse.json({ error: "datum required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // 0) Conflict check — ak iný maklér plánuje obhliadku tej istej nehnuteľnosti
  // v okne ±60 minút, nedovoľ insert pokiaľ klient explicitne neposlal
  // allow_conflict: true (UI to po varovaní pošle pri "áno, plánuj aj tak").
  if (body.nehnutelnost_id && !body.allow_conflict) {
    // DB ukladá obhliadky.datum bez tz konvertuje cez Postgres ako UTC. JS new Date()
    // bez tz suffixu by interpretoval string ako local — preto pre konzistentnosť
    // dopĺňame 'Z' aby sme oba parsing aj DB porovnávali v UTC.
    const datumStr = String(body.datum);
    const datumIso = /Z|[+-]\d{2}:?\d{2}$/.test(datumStr) ? datumStr : `${datumStr}Z`;
    const targetMs = new Date(datumIso).getTime();
    if (!Number.isNaN(targetMs)) {
      const fromIso = new Date(targetMs - 60 * 60 * 1000).toISOString();
      const toIso = new Date(targetMs + 60 * 60 * 1000).toISOString();
      const { data: clash } = await sb
        .from("obhliadky")
        .select("id, datum, makler_id, kupujuci_meno, status")
        .eq("nehnutelnost_id", body.nehnutelnost_id)
        .gte("datum", fromIso)
        .lte("datum", toIso)
        .neq("status", "zrusena");
      if (clash && clash.length > 0) {
        return NextResponse.json({
          error: "Časový konflikt — na tejto nehnuteľnosti je iná obhliadka v okolí ±1h",
          conflicts: clash,
        }, { status: 409 });
      }
    }
  }

  // 1) Vlož obhliadku
  const payload: Record<string, unknown> = {
    predavajuci_klient_id: body.predavajuci_klient_id || null,
    nehnutelnost_id: body.nehnutelnost_id || null,
    kupujuci_klient_id: body.kupujuci_klient_id || null,
    kupujuci_meno: body.kupujuci_meno || null,
    kupujuci_telefon: body.kupujuci_telefon || null,
    kupujuci_email: body.kupujuci_email || null,
    makler_id: body.makler_id || null,
    datum: body.datum,
    miesto: body.miesto || null,
    poznamka: body.poznamka || null,
    status: body.status || "planovana",
    calendar_event_id: body.calendar_event_id || null,
  };
  const { data, error } = await sb.from("obhliadky").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2) Auto-upsert kupujúci klient (best-effort, nezhasne obhliadku ak zlyhá)
  let kupujuciInfo: { klient_id: string; created: boolean; updated: boolean } | null = null;
  try {
    const kupTel = String(body.kupujuci_telefon || "").trim();
    const kupMeno = String(body.kupujuci_meno || "").trim();
    const alreadyLinked = !!body.kupujuci_klient_id;
    if (!alreadyLinked && kupTel && kupMeno) {
      const normNew = normalizePhone(kupTel);

      // Načítaj všetkých klientov s telefónom a porovnaj normalizované hodnoty
      const { data: existingList } = await sb
        .from("klienti")
        .select("id, meno, telefon, email, typ, poznamka, lokalita, makler_id")
        .not("telefon", "is", null);
      const matched = (existingList || []).find(k =>
        normalizePhone(String((k as { telefon: string }).telefon)) === normNew
      ) as Record<string, unknown> | undefined;

      // Načítaj meno makléra (zdroj informácie) a názov nehnuteľnosti pre poznámku
      const maklerId = body.makler_id as string | null;
      let maklerMeno = "neznámy maklér";
      if (maklerId) {
        const { data: m } = await sb.from("makleri").select("meno").eq("id", maklerId).single();
        if (m?.meno) maklerMeno = String(m.meno);
      }
      const nehnId = body.nehnutelnost_id as string | null;
      let nehnLabel = "";
      if (nehnId) {
        const { data: n } = await sb.from("nehnutelnosti")
          .select("nazov, lokalita, ulica_privatna").eq("id", nehnId).single();
        if (n) {
          const adresa = [n.ulica_privatna, n.lokalita].filter(Boolean).join(", ");
          nehnLabel = adresa || String(n.nazov || "");
        }
      }
      const datumStr = new Date(String(body.datum)).toLocaleDateString("sk", { day: "numeric", month: "numeric", year: "numeric" });
      const noteLine = `Obhliadka ${datumStr}: ${nehnLabel || "nehnuteľnosť"} (od makléra ${maklerMeno})`;

      if (!matched) {
        // 2a) Vytvor nového klienta typu kupujúci
        const newKlient = {
          meno: kupMeno,
          telefon: kupTel,
          email: String(body.kupujuci_email || "") || null,
          typ: "kupujuci" as const,
          status: "novy_kontakt" as const,
          makler_id: maklerId,
          zdroj: "obhliadka",
          lokalita: nehnLabel || null,
          poznamka: noteLine,
        };
        const { data: created, error: cErr } = await sb.from("klienti").insert(newKlient).select("id").single();
        if (cErr) {
          console.warn("[obhliadky POST] auto-create kupujúci failed:", cErr.message, cErr.code);
        }
        if (!cErr && created) {
          kupujuciInfo = { klient_id: String(created.id), created: true, updated: false };
          // Prepoj obhliadku
          await sb.from("obhliadky").update({ kupujuci_klient_id: created.id }).eq("id", (data as { id: string }).id);
        }
      } else {
        // 2b) Klient už existuje — doplň chýbajúce údaje + poznámka
        const patch: Record<string, unknown> = {};
        if (!matched.email && body.kupujuci_email) patch.email = body.kupujuci_email;
        // Ak meno v DB je krátke alebo "neznámy", aktualizuj
        if (!matched.meno || String(matched.meno).length < 3) patch.meno = kupMeno;

        // Append poznámku — ak iná nehnuteľnosť, dopíš "má záujem aj o ..."
        const existingNote = String(matched.poznamka || "").trim();
        const existingLokalita = String(matched.lokalita || "").trim();
        let extra = noteLine;
        if (existingLokalita && nehnLabel && !existingLokalita.toLowerCase().includes(nehnLabel.toLowerCase())) {
          extra = `${noteLine} — má záujem aj o ${nehnLabel}`;
        }
        // Idempotencia: ak rovnaký riadok už existuje v poznámke, nepridávaj
        if (!existingNote.includes(noteLine)) {
          patch.poznamka = existingNote ? `${existingNote}\n${extra}` : extra;
        }
        if (Object.keys(patch).length > 0) {
          await sb.from("klienti").update(patch).eq("id", matched.id);
        }
        // Prepoj obhliadku na existujúceho klienta
        await sb.from("obhliadky").update({ kupujuci_klient_id: matched.id }).eq("id", (data as { id: string }).id);
        kupujuciInfo = { klient_id: String(matched.id), created: false, updated: Object.keys(patch).length > 0 };
      }
    }
  } catch (upsertErr) {
    console.warn("[obhliadky POST] kupujúci upsert failed:", upsertErr);
  }

  return NextResponse.json({ obhliadka: data, kupujuci: kupujuciInfo });
}

/**
 * PATCH /api/obhliadky
 * Body: { id, ...fields }
 *   – update pre status, podpis, email, poznámka, GDPR audit
 *   – pri zápise podpis_data sa server-side dopĺňa IP do podpis_meta.ip
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const userId = auth.user.id;

  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const { data: existing } = await sb.from("obhliadky").select("makler_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Obhliadka nenájdená" }, { status: 404 });
  const ok = await canEditRecord(scope, existing.makler_id);
  if (!ok) return NextResponse.json({ error: "Nemáš oprávnenie editovať túto obhliadku" }, { status: 403 });
  if (!scope.isAdmin && body.makler_id) delete body.makler_id; // anti-impersonation

  const allowed = [
    "status","miesto","poznamka","datum",
    "kupujuci_klient_id","kupujuci_meno","kupujuci_telefon","kupujuci_email",
    "podpis_data","podpis_datum",
    "list_pdf_base64","email_sent_at","email_sent_to",
    "calendar_event_id","makler_id","nehnutelnost_id",
    "gdpr_consent","gdpr_consent_at","podpis_meta",
  ];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in body) patch[k] = body[k];

  // Audit trail: ak sa ukladá podpis, doplň IP a server-side timestamp do podpis_meta
  if (body.podpis_data && typeof body.podpis_meta === "object" && body.podpis_meta !== null) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    patch.podpis_meta = {
      ...(body.podpis_meta as Record<string, unknown>),
      ip,
      server_timestamp: new Date().toISOString(),
    };
  }

  const { data, error } = await sb.from("obhliadky").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ obhliadka: data });
}

/**
 * DELETE /api/obhliadky?id=X&user_id=Y
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const userId = auth.user.id;

  const scope = await getUserScope(userId);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  const { data: existing } = await sb.from("obhliadky").select("makler_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Obhliadka nenájdená" }, { status: 404 });
  const ok = await canEditRecord(scope, existing.makler_id);
  if (!ok) return NextResponse.json({ error: "Nemáš oprávnenie zmazať túto obhliadku" }, { status: 403 });

  const { error } = await sb.from("obhliadky").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
