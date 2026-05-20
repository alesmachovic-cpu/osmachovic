import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, readSessionUserId } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
import { VIANEMA_COMPANY_ID } from "@/lib/auth/companyScope";
import { logAudit } from "@/lib/audit";
import { getDphRate, calcDph } from "@/lib/dphRates";
import { sanitizeText, sanitizeFields, SANITIZE_FIELDS } from "@/lib/sanitize";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);

  const sessionUserId = readSessionUserId(req);
  let companyId = VIANEMA_COMPANY_ID;
  if (sessionUserId) {
    const scope = await getUserScope(sessionUserId);
    if (scope) companyId = scope.company_id;
  }

  // includeZrusene=1 ukáže aj soft-deleted (pre archív / kontrolu DPH).
  const includeZrusene = searchParams.get("includeZrusene") === "1";

  const id = searchParams.get("id");
  if (id) {
    const { data: faktura, error } = await sb
      .from("faktury")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: polozky } = await sb
      .from("faktura_polozky")
      .select("*")
      .eq("faktura_id", id)
      .order("poradie", { ascending: true });
    return NextResponse.json({ ...faktura, polozky: polozky ?? [] });
  }
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json([]);
  let q = sb
    .from("faktury")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (!includeZrusene) q = q.is("zrusena_at", null);
  const { data, error } = await q.order("datum_vystavenia", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

function nextNumber(existing: string[], prefix: string) {
  const year = new Date().getFullYear();
  const re = new RegExp(`^${prefix}(\\d{4})(\\d{4})$`);
  let max = 0;
  for (const c of existing) {
    const m = c?.match(re);
    if (m && parseInt(m[1]) === year) {
      const n = parseInt(m[2]);
      if (n > max) max = n;
    }
  }
  return `${prefix}${year}${String(max + 1).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const body = await req.json();
  const { polozky = [], ...faktura } = body;

  if (!faktura.user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const postSessionUserId = readSessionUserId(req);
  let postCompanyId = VIANEMA_COMPANY_ID;
  if (postSessionUserId) {
    const scope = await getUserScope(postSessionUserId);
    if (scope) postCompanyId = scope.company_id;
  } else {
    const scope = await getUserScope(String(faktura.user_id));
    if (scope) postCompanyId = scope.company_id;
  }

  const sumaCelkomBezDph = polozky.reduce((s: number, p: { spolu?: number }) => s + (Number(p.spolu) || 0), 0);

  // 🆕 DPH výpočet podľa firma_info.platca_dph + dátum vystavenia.
  // Pre neplatcu DPH → dph = 0, suma_celkom = suma_bez_dph.
  // Pre platcu → dph = sadzba × suma_bez_dph (sadzba podľa zákona 222/2004 platná k dátumu).
  const datumVystavenia = faktura.datum_vystavenia || new Date().toISOString().slice(0, 10);
  const { data: firmaInfo } = await sb.from("firma_info").select("platca_dph, platca_dph_od").eq("id", 1).maybeSingle();
  const isPlatca = !!firmaInfo?.platca_dph && (!firmaInfo?.platca_dph_od || datumVystavenia >= firmaInfo.platca_dph_od);
  const dphSadzba = isPlatca ? getDphRate(datumVystavenia) : 0;
  const dphSuma = isPlatca ? calcDph(sumaCelkomBezDph, dphSadzba) : 0;
  const sumaCelkom = sumaCelkomBezDph + dphSuma;

  // Retry loop kvôli race condition pri paralelných POSToch s rovnakým user_id.
  // Unique index (user_id, cislo_faktury) zabezpečí, že druhý retry nájde nové max
  // a inkrementuje od neho — čísla nebudú duplicitné.
  type Created = { id: string; cislo_faktury: string };
  let created: Created | null = null;
  let cislo = "";
  let vs = "";
  let lastErr: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: all } = await sb
      .from("faktury")
      .select("cislo_faktury, variabilny_symbol")
      .eq("user_id", faktura.user_id);
    cislo = faktura.cislo_faktury || nextNumber((all ?? []).map((x) => x.cislo_faktury), "FA");
    vs = faktura.variabilny_symbol || nextNumber((all ?? []).map((x) => x.variabilny_symbol), "VS");

    const payload = {
      user_id: faktura.user_id,
      company_id: postCompanyId,
      cislo_faktury: cislo,
      variabilny_symbol: vs,
      odberatel_id: faktura.odberatel_id ?? null,
      odberatel_snapshot: faktura.odberatel_snapshot ?? null,
      datum_vystavenia: datumVystavenia,
      datum_dodania: faktura.datum_dodania ?? null,
      datum_splatnosti: faktura.datum_splatnosti ?? null,
      forma_uhrady: faktura.forma_uhrady || "Prevodom",
      suma_bez_dph: faktura.suma_bez_dph ?? sumaCelkomBezDph,
      dph: faktura.dph ?? dphSuma,
      suma_celkom: sumaCelkom,
      zaplatene: false,
      poznamka: sanitizeText(faktura.poznamka), // C4: XSS
    };
    const { data, error } = await sb.from("faktury").insert(payload).select().single();
    if (!error) { created = data as Created; break; }
    lastErr = error;
    if (error.code !== "23505") break; // iná chyba ako unique → stop
    if (faktura.cislo_faktury || faktura.variabilny_symbol) break; // user prepísal číslo → nesnaž retry
  }
  if (!created) {
    return NextResponse.json({ error: lastErr?.message || "Insert failed" }, { status: 500 });
  }
  const payload = { datum_vystavenia: faktura.datum_vystavenia || new Date().toISOString().slice(0, 10) };

  if (polozky.length) {
    const rows = polozky.map((p: { popis?: string; mnozstvo?: number; jednotka?: string; cena_jednotka?: number; spolu?: number }, i: number) => ({
      faktura_id: created.id,
      company_id: postCompanyId,
      popis: sanitizeText(p.popis) || "", // C4: XSS na popise položky
      mnozstvo: Number(p.mnozstvo) || 1,
      jednotka: sanitizeText(p.jednotka) || "ks",
      cena_jednotka: Number(p.cena_jednotka) || 0,
      spolu: Number(p.spolu) || 0,
      poradie: i,
    }));
    const { error: polozkyErr } = await sb.from("faktura_polozky").insert(rows);
    if (polozkyErr) console.error("[faktury POST] polozky insert failed:", polozkyErr.message);
  }

  // Pridať do prehľadu ako prijem
  await sb.from("prehlad_zaznamy").insert({
    typ: "prijem",
    datum: payload.datum_vystavenia,
    popis: `Faktúra ${cislo}`,
    suma: sumaCelkom,
    zaplatene: false,
    faktura_id: created.id,
  });

  return NextResponse.json(created);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // C4: XSS sanitize free-form fields
  const cleanRest = sanitizeFields(rest as Record<string, unknown>, [...SANITIZE_FIELDS]);
  const { data, error } = await sb.from("faktury").update(cleanRest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // sync prehlad
  if (rest.zaplatene !== undefined) {
    await sb.from("prehlad_zaznamy").update({ zaplatene: rest.zaplatene }).eq("faktura_id", id);
  }
  return NextResponse.json(data);
}

/**
 * DELETE /api/faktury?id=<uuid>&dovod=<text>
 *
 * 🚨 FIX 2026-05-20 (Compliance P0):
 *   Pôvodne fyzicky mazal faktúry. Porušenie zákona 222/2004 § 76 (DPH 10y
 *   retention) + zák. 431/2002 § 35 (ZoÚ). Pri kontrole Finančnej správy
 *   = pokuta + dorovnanie DPH + reputačné riziko.
 *
 * Teraz: SOFT-DELETE (zrusena_at = now()).
 *   - faktúra ostáva fyzicky v DB
 *   - polozky + prehlad_zaznamy NEMAZAŤ (sú súčasť účtovného záznamu)
 *   - prehlad_zaznamy.zaplatene → false a doplníme "(zrušená)" do popisu
 *     aby sa nezapočítavalo do príjmov, ale stále evidované
 *   - audit log MANDATORY
 *
 * Hard-delete fyzický (po 10 rokoch) je separátny admin-only flow, nie cez
 * tento endpoint.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const dovod = (searchParams.get("dovod") || "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!dovod || dovod.length < 3) {
    return NextResponse.json({
      error: "Dôvod zrušenia je povinný (min 3 znaky). Napr. 'storno', 'oprava', 'duplikát'.",
    }, { status: 400 });
  }

  // Načítaj faktúru pred zmenou pre audit a guardy.
  const { data: faktura, error: getErr } = await sb
    .from("faktury")
    .select("id, cislo_faktury, user_id, company_id, datum_vystavenia, suma_celkom, zrusena_at, zaplatene")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!faktura) return NextResponse.json({ error: "Faktúra nenájdená" }, { status: 404 });
  if (faktura.zrusena_at) {
    return NextResponse.json({
      error: "Faktúra už bola zrušená",
      zrusena_at: faktura.zrusena_at,
    }, { status: 409 });
  }

  // Soft-delete.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { error: updErr } = await sb.from("faktury").update({
    zrusena_at: new Date().toISOString(),
    zrusena_dovod: dovod,
    zrusena_by: auth.user.id,
    zaplatene: false,
  }).eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Označ prehlad_zaznamy aby sa nezapočítaval do príjmov, ale ostáva evidovaný.
  await sb.from("prehlad_zaznamy").update({
    zaplatene: false,
    popis: `Faktúra ${faktura.cislo_faktury} (zrušená)`,
  }).eq("faktura_id", id);

  await logAudit({
    action: "faktura.soft_delete",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: id,
    target_type: "faktura",
    detail: {
      cislo_faktury: faktura.cislo_faktury,
      suma_celkom: faktura.suma_celkom,
      datum_vystavenia: faktura.datum_vystavenia,
      dovod,
    },
    ip_address: ip || undefined,
  });

  return NextResponse.json({
    ok: true,
    soft_deleted: true,
    message: "Faktúra zrušená. Ostáva v archíve 10 rokov podľa zákona o DPH.",
  });
}
