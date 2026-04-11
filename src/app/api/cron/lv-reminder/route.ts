import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

// Cron: beží ráno o 7:00, kontroluje klientov s dohodnutým náberom DNES bez LV
// Pošle email maklerovi ako rannú pripomienku
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Nájdi klientov: dohodnutý náber, bez LV, s dátumom náberu DNES
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: klienti, error } = await sb
    .from("klienti")
    .select("id, meno, telefon, lokalita, datum_naberu, makler_id")
    .eq("status", "dohodnuty_naber")
    .is("lv_data", null)
    .not("datum_naberu", "is", null)
    .gte("datum_naberu", startOfDay.toISOString())
    .lte("datum_naberu", endOfDay.toISOString());

  if (error) {
    console.error("[lv-reminder] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!klienti?.length) {
    return NextResponse.json({ message: "Žiadni klienti na pripomienku", count: 0 });
  }

  // Pre každého klienta nájdi email maklera
  const maklerIds = [...new Set(klienti.filter(k => k.makler_id).map(k => k.makler_id))];
  const { data: makleri } = await sb
    .from("makleri")
    .select("id, meno, email")
    .in("id", maklerIds);

  const maklerMap = new Map((makleri || []).map(m => [m.id, m]));
  let sent = 0;

  for (const klient of klienti) {
    const makler = maklerMap.get(klient.makler_id);
    if (!makler?.email) continue;

    const datumStr = klient.datum_naberu
      ? new Date(klient.datum_naberu).toLocaleString("sk-SK", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
      : "neznámy";

    // Pošli email cez Resend
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "OS Machovič <noreply@vianema.sk>",
            to: makler.email,
            subject: `Pripomienka: Dnes máš náber — ${klient.meno}, chýba LV`,
            html: `
              <h2>Dnes máš náber — chýba List vlastníctva</h2>
              <p>Ahoj ${makler.meno},</p>
              <p>Dnes o <strong>${datumStr}</strong> máš naplánovaný náber pre klienta <strong>${klient.meno}</strong>${klient.lokalita ? ` (${klient.lokalita})` : ""}, ale ešte nemáš nahratý List vlastníctva.</p>
              <p>Pridaj LV pred náberom — pomôže automaticky vyplniť náberový list.</p>
              <p style="margin-top: 20px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://funny-stonebraker.vercel.app"}/klienti/${klient.id}"
                   style="background: #374151; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Otvoriť klienta
                </a>
              </p>
            `,
          }),
        });
        sent++;
      } catch (e) {
        console.error("[lv-reminder] email error:", e);
      }
    }
  }

  return NextResponse.json({ message: `Odoslaných ${sent} pripomienok`, count: sent, total: klienti.length });
}
