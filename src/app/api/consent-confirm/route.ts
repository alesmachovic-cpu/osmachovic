import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyConsentToken } from "@/lib/consentToken";
import { touchEngagement } from "@/lib/engagement";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * VEREJNÝ endpoint (bez auth) — klient klikne „chcem zostať" v consent-refresh
 * maili. Token (HMAC) nesie klient_id + purpose. Zapíše súhlas + resetuje
 * retention lehotu (engagement). Vráti jednoduchú HTML stránku.
 */
function page(title: string, message: string, ok: boolean): NextResponse {
  const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5F5F7;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)">
<div style="font-size:48px;margin-bottom:12px">${ok ? "✅" : "⚠️"}</div>
<h1 style="font-size:20px;margin:0 0 8px;color:#1d1d1f">${title}</h1>
<p style="font-size:15px;color:#6e6e73;line-height:1.5;margin:0">${message}</p>
</div></body></html>`;
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const parsed = verifyConsentToken(token);
  if (!parsed) {
    return page("Odkaz vypršal", "Tento odkaz už nie je platný. Ak chcete zostať v kontakte, ozvite sa nám.", false);
  }

  const sb = getSupabaseAdmin();
  const { data: klient } = await sb.from("klienti").select("id, anonymized_at").eq("id", parsed.klientId).maybeSingle();
  if (!klient || klient.anonymized_at) {
    return page("Nedostupné", "Záznam už nie je dostupný.", false);
  }

  await sb.from("consents").insert({
    klient_id: parsed.klientId,
    purpose: parsed.purpose,
    granted: true,
    granted_at: new Date().toISOString(),
    proof_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    proof_user_agent: req.headers.get("user-agent"),
    source: "email-refresh",
  });
  await touchEngagement(parsed.klientId);
  await logAudit({
    action: "consent.granted",
    actor_id: null,
    actor_name: "consent-refresh (klient)",
    target_id: parsed.klientId,
    target_type: "klient",
    detail: { purpose: parsed.purpose, source: "email-refresh" },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return page("Ďakujeme! 🎄", "Zostávate v kontakte — ozveme sa vám s tipmi a ponukami nehnuteľností. Krásne sviatky!", true);
}
