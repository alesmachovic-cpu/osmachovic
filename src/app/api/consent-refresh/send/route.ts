import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";
import { getUserScope } from "@/lib/scope";
import { signConsentToken } from "@/lib/consentToken";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const PURPOSE = "marketing";
const MAX_BATCH = 300;

/**
 * Consent-refresh kampaň (sviatočný „chcem zostať" mail).
 * Admin-only. DEFAULT = DRY-RUN (vráti príjemcov, nič nepošle). Reálne odoslanie
 * len pri body.dry_run === false. Posiela klientom firmy s e-mailom, ktorí nie
 * sú anonymizovaní. Každý mail má HMAC link na /api/consent-confirm → klik zapíše
 * marketingový súhlas + resetuje retention lehotu.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const scope = await getUserScope(auth.user.id);
  if (!scope) return NextResponse.json({ error: "Neznámy užívateľ" }, { status: 401 });
  if (!scope.isAdmin) return NextResponse.json({ error: "Len admin/majiteľ" }, { status: 403 });

  let body: { klient_ids?: string[]; dry_run?: boolean; subject?: string } = {};
  try { body = await req.json(); } catch { /* prázdne telo = dry-run all */ }
  const dryRun = body.dry_run !== false; // default true

  const sb = getSupabaseAdmin();
  let q = sb.from("klienti")
    .select("id, meno, email")
    .eq("company_id", scope.company_id)
    .is("anonymized_at", null)
    .not("email", "is", null)
    .limit(MAX_BATCH);
  if (Array.isArray(body.klient_ids) && body.klient_ids.length) q = q.in("id", body.klient_ids);
  const { data: recipients, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const list = (recipients ?? []).filter(r => typeof r.email === "string" && r.email.includes("@"));

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      recipients_count: list.length,
      sample: list.slice(0, 5).map(r => ({ id: r.id, meno: r.meno, email: r.email })),
      note: "DRY-RUN — nič sa neodoslalo. Pre reálne odoslanie pošli { dry_run: false }.",
    });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY nie je nastavený" }, { status: 500 });
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "vianema.amgd.sk";
  const origin = `${proto}://${host}`;
  const subject = body.subject || "Krásne sviatky od Vianema 🎄";

  let sent = 0;
  const results = await Promise.allSettled(list.map(async (r) => {
    const token = signConsentToken(r.id, PURPOSE, 60);
    const link = `${origin}/api/consent-confirm?token=${encodeURIComponent(token)}`;
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;color:#1d1d1f">
<p>Dobrý deň${r.meno ? `, ${String(r.meno).split(" ")[0]}` : ""},</p>
<p>prajeme Vám krásne sviatky! 🎄</p>
<p>Ak chcete aj naďalej dostávať naše tipy a ponuky nehnuteľností, kliknite na tlačidlo nižšie. Ak nie, nemusíte robiť nič — ozveme sa len keď budete kupovať alebo predávať.</p>
<p style="text-align:center;margin:28px 0">
<a href="${link}" style="background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;display:inline-block">Áno, chcem zostať v kontakte</a>
</p>
<p style="font-size:12px;color:#86868b">Vianema s.r.o. · Tento e-mail ste dostali ako náš klient. Ak si neželáte ďalšiu komunikáciu, odpovedzte „ODHLÁSIŤ".</p>
</div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "VIANEMA Real <onboarding@resend.dev>",
        to: r.email,
        subject,
        html,
      }),
    });
    if (res.ok) sent++;
    else throw new Error(`${r.id}: HTTP ${res.status}`);
  }));
  const failed = results.filter(x => x.status === "rejected").length;

  await logAudit({
    action: "consent_refresh.sent",
    actor_id: auth.user.id,
    actor_name: auth.user.name,
    target_type: "kampan",
    detail: { sent, failed, total: list.length },
    ip_address: req.headers.get("x-forwarded-for") || undefined,
  });

  return NextResponse.json({ dry_run: false, sent, failed, total: list.length });
}
