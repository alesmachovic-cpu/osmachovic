import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/notifications/seed
 * Body: { user_id }
 *
 * Vytvorí 4 ukážkové notifikácie pre tohto usera (pre demo / testovanie).
 * Idempotentné — neduplikuje (preverí či už existujú podobné).
 */
export async function POST(req: NextRequest) {
  let body: { user_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const userId = body.user_id;
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // Idempotency: skip ak už máme aspoň 1 demo notif za posledných 5 min
  const { data: recent } = await sb.from("in_app_notifications")
    .select("id").eq("user_id", userId).eq("typ", "demo")
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json({ created: 0, message: "Demo notifikácie už pridané v posledných 5 min" });
  }

  const rows = [
    {
      user_id: userId, typ: "demo",
      titulok: "🏠 Nový súkromný inzerát · Bratislava-Petržalka",
      sprava: "189 000 € · 65 m² · 3-izb\nByt na predaj — Daxnerova",
      data: { url: "https://www.nehnutelnosti.sk" },
      precitane: false,
    },
    {
      user_id: userId, typ: "demo",
      titulok: "🔥 Motivovaný predajca",
      sprava: "Inzerát ktorý sleduješ znížil cenu o 8% za posledný týždeň. Dobrý čas zavolať.",
      data: { url: "/monitor" },
      precitane: false,
    },
    {
      user_id: userId, typ: "demo",
      titulok: "📞 Pripomienka: zavolať klientovi",
      sprava: "Marek Tichý — naplánovaný hovor na dnes 14:00.",
      data: { url: "/klienti" },
      precitane: false,
    },
    {
      user_id: userId, typ: "demo",
      titulok: "✅ Predaj detegovaný",
      sprava: "Inzerát ktorý si analyzoval pred 2 týždňami pravdepodobne predaný. Odhad realizačnej ceny: 245 000 €.",
      data: { url: "/analyzy" },
      precitane: true,
    },
  ];

  const { error } = await sb.from("in_app_notifications").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ created: rows.length });
}
