import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// GET /api/objednavky[?klient_id=X]
// B1 fix: requireUser + company scope. Objednávky obsahujú PII kupujúcich
// (rozpočet, lokalita, požiadavky) → bez auth to bol verejný leak.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const klientId = searchParams.get("klient_id");
  const sb = getSupabaseAdmin();
  let q = sb
    .from("objednavky")
    .select("*")
    .eq("company_id", scope.company_id)
    .order("created_at", { ascending: false });
  if (klientId) q = q.eq("klient_id", klientId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/objednavky
// B4 fix: klient_id musí patriť do firmy callera; company_id sa nastaví zo scope
// (nikdy z body); + audit.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const body = await req.json();
  if (!body.klient_id) return NextResponse.json({ error: "klient_id required" }, { status: 400 });
  if (!body.druh) return NextResponse.json({ error: "druh required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  // Over že klient patrí do firmy callera (cross-tenant ochrana).
  const { data: klient } = await sb.from("klienti").select("company_id").eq("id", body.klient_id).maybeSingle();
  if (!klient || klient.company_id !== scope.company_id) {
    return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });
  }

  // company_id NIKDY z body — vždy zo scope.
  const { company_id: _ignored, ...rest } = body;
  const { data, error } = await sb
    .from("objednavky")
    .insert({ ...rest, company_id: scope.company_id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "objednavka.create",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: data?.id,
    target_type: "objednavka",
    detail: { klient_id: body.klient_id, druh: body.druh },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/objednavky
// B3 fix: ownership (company) check + audit.
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const body = await req.json();
  const { id, company_id: _c, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: existing } = await sb.from("objednavky").select("id, company_id").eq("id", id).maybeSingle();
  if (!existing || existing.company_id !== scope.company_id) {
    return NextResponse.json({ error: "Objednávka nenájdená" }, { status: 404 });
  }

  const { data, error } = await sb.from("objednavky").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "objednavka.update",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: id,
    target_type: "objednavka",
    detail: { fields: Object.keys(rest) },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json(data);
}

// DELETE /api/objednavky?id=X
// B3 fix: ownership (company) check + audit. requireReAuth zámerne NIE — rozbil
// by kupujuci delete flow (plain DELETE bez prompt-u). Ownership + audit je
// dostatočná ochrana proti IDOR; re-auth = follow-up ak sa do UI doplní prompt.
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: existing } = await sb.from("objednavky").select("id, company_id").eq("id", id).maybeSingle();
  if (!existing || existing.company_id !== scope.company_id) {
    return NextResponse.json({ error: "Objednávka nenájdená" }, { status: 404 });
  }

  const { error } = await sb.from("objednavky").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    action: "objednavka.delete",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_id: id,
    target_type: "objednavka",
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });
  return NextResponse.json({ ok: true });
}
