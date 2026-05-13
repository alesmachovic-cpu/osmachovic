import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const userId = req.nextUrl.searchParams.get("user_id") || auth.user?.id;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const [userRes, klientiRes, obhliadkyRes, faktury] = await Promise.all([
    sb.from("users").select("id, name, email, role, created_at").eq("id", userId).maybeSingle(),
    sb.from("klienti").select("id, meno, email, telefon, typ, status, created_at").eq("makler_id", userId),
    sb.from("obhliadky").select("id, datum, klient_meno, nehnutelnost_id, created_at").eq("makler_id", userId),
    sb.from("faktury").select("id, cislo_faktury, suma_celkom, datum_vystavenia, zaplatene").eq("user_id", userId),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    user: userRes.data,
    klienti: klientiRes.data ?? [],
    obhliadky: obhliadkyRes.data ?? [],
    faktury: faktury.data ?? [],
    note: "Export podľa čl. 20 GDPR — právo na prenositeľnosť. Niektoré dáta sú vynechané z dôvodu ochrany tretích strán.",
  };

  // Audit log
  await sb.from("audit_log").insert({
    user_id: auth.user?.id,
    action: "gdpr_export",
    entity_type: "user",
    entity_id: userId,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: req.headers.get("user-agent"),
  }).then(() => null, () => null);

  return NextResponse.json(payload);
}
