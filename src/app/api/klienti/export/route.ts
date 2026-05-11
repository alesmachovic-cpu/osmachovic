import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// GET /api/klienti/export?id=<uuid>
// GDPR článok 15 — právo na prístup k osobným údajom
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowedRoles = ["super_admin", "majitel", "manazer"];
  if (!allowedRoles.includes(auth.user.role)) {
    return NextResponse.json({ error: "Nedostatočné oprávnenia" }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const [klient, obhliadky, nabery, docs, udalosti] = await Promise.all([
    sb.from("klienti").select("*").eq("id", id).single(),
    sb.from("obhliadky").select("id, created_at, datum, poznamka").eq("klient_id", id),
    sb.from("naberove_listy").select("id, created_at, stav").eq("klient_id", id),
    sb.from("klient_dokumenty").select("id, nazov, created_at").eq("klient_id", id),
    sb.from("klient_udalosti").select("id, typ, poznamka, created_at").eq("klient_id", id),
  ]);

  await logAudit({ action: "klient.gdpr_export", actor_id: auth.user.id, actor_name: auth.user.name, target_id: id, target_type: "klient", ip_address: req.headers.get("x-forwarded-for") || undefined });

  const exportData = {
    gdpr_note: `Export osobných údajov podľa GDPR článku 15. Vygenerované: ${new Date().toISOString()}`,
    osobne_udaje: klient.data,
    obhliadky: obhliadky.data ?? [],
    naberove_listy: nabery.data ?? [],
    dokumenty_zoznam: docs.data ?? [],
    udalosti: udalosti.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gdpr-export-${id}-${Date.now()}.json"`,
    },
  });
}
