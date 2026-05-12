import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, readSessionUserId } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
import { VIANEMA_COMPANY_ID } from "@/lib/auth/companyScope";

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
  const { data, error } = await sb
    .from("faktury")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("datum_vystavenia", { ascending: false });
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

  const sumaCelkom = polozky.reduce((s: number, p: { spolu?: number }) => s + (Number(p.spolu) || 0), 0);

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
      datum_vystavenia: faktura.datum_vystavenia || new Date().toISOString().slice(0, 10),
      datum_dodania: faktura.datum_dodania ?? null,
      datum_splatnosti: faktura.datum_splatnosti ?? null,
      forma_uhrady: faktura.forma_uhrady || "Prevodom",
      suma_bez_dph: faktura.suma_bez_dph ?? sumaCelkom,
      dph: faktura.dph ?? 0,
      suma_celkom: sumaCelkom,
      zaplatene: false,
      poznamka: faktura.poznamka ?? null,
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
      popis: p.popis || "",
      mnozstvo: Number(p.mnozstvo) || 1,
      jednotka: p.jednotka || "ks",
      cena_jednotka: Number(p.cena_jednotka) || 0,
      spolu: Number(p.spolu) || 0,
      poradie: i,
    }));
    await sb.from("faktura_polozky").insert(rows);
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
  const { data, error } = await sb.from("faktury").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // sync prehlad
  if (rest.zaplatene !== undefined) {
    await sb.from("prehlad_zaznamy").update({ zaplatene: rest.zaplatene }).eq("faktura_id", id);
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await sb.from("prehlad_zaznamy").delete().eq("faktura_id", id);
  await sb.from("faktura_polozky").delete().eq("faktura_id", id);
  const { error } = await sb.from("faktury").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
