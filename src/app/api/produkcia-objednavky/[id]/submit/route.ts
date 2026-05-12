import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

const SERVICES_SK: Record<string, string> = {
  FOTO: "Fotografia",
  VIDEO: "Video",
  VIDEO_VSTUPY_MAKLERA: "Video vstupy makléra",
  DRON: "Dron",
  VIZUALIZACIA_INT: "Vizualizácia interiéru",
  VIZUALIZACIA_POZEMOK: "Vizualizácia pozemku",
  PODORYS_Z_PREDLOHY: "Pôdorys z predlohy",
  PODORYS_MERANIE: "Pôdorys s meraním",
};

const DAYS_SK: Record<string, string> = {
  MON: "Pondelok", TUE: "Utorok", WED: "Streda",
  THU: "Štvrtok", FRI: "Piatok", SAT: "Sobota",
  SUN: "Nedeľa", ANY_WEEKDAY: "Akýkoľvek pracovný deň",
};

const ON_SITE_SK: Record<string, string> = {
  SELF: "Maklér osobne", OWNER: "Vlastník", OTHER_AGENT: "Iný maklér",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data: order } = await sb
    .from("produkcia_objednavky")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent — ak už submitted, nevysielame druhý email
  if (order.stav === "submitted" || order.stav === "scheduled" ||
      order.stav === "in_progress" || order.stav === "completed") {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await sb
    .from("produkcia_objednavky")
    .update({ stav: "submitted", submitted_at: now, updated_at: now })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Email notifikácia
  const resendKey = process.env.RESEND_API_KEY;
  const managerEmail = process.env.MANAGER_EMAIL;
  if (resendKey && managerEmail) {
    const d = order.details as Record<string, unknown>;
    const services = ((d.services as string[]) ?? [])
      .map(s => SERVICES_SK[s] ?? s).join(", ");
    const days = ((d.preferred_days as string[]) ?? [])
      .map(s => DAYS_SK[s] ?? s).join(", ");
    const onSite = ON_SITE_SK[(d.on_site_person as string) ?? ""] ?? d.on_site_person;

    const { data: makler } = await sb
      .from("users")
      .select("name")
      .eq("id", order.makler_id)
      .maybeSingle();

    const now_sk = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "VIANEMA Real <onboarding@resend.dev>",
        to: managerEmail,
        subject: `📸 Nová produkčná objednávka — ${order.snapshot_meno ?? "klient"}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="font-size:22px;font-weight:500;letter-spacing:-0.03em;color:#0A0A0A;">VIANEMA</div>
              <div style="font-size:9px;letter-spacing:0.4em;color:#86868B;margin-top:2px;">REAL</div>
            </div>
            <h2 style="color:#1f2937;margin:0 0 16px;font-size:18px;">📸 Nová produkčná objednávka</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;width:140px;">Maklér</td>
                <td style="padding:8px 0;font-weight:500;">${makler?.name ?? order.makler_id}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Klient</td>
                <td style="padding:8px 0;font-weight:500;">${order.snapshot_meno ?? "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Telefón</td>
                <td style="padding:8px 0;">${order.snapshot_telefon ?? "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Lokalita</td>
                <td style="padding:8px 0;">${order.snapshot_lokalita ?? "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Typ nehnuteľnosti</td>
                <td style="padding:8px 0;">${(d.property_type_mapped as string) ?? "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Služby</td>
                <td style="padding:8px 0;font-weight:500;">${services || "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Preferované dni</td>
                <td style="padding:8px 0;">${days || "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Čas</td>
                <td style="padding:8px 0;">${(d.preferred_time as string) || "—"}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">Na mieste</td>
                <td style="padding:8px 0;">${onSite ?? "—"}${d.other_agent_name ? ` (${d.other_agent_name})` : ""}${d.owner_contact ? ` — ${d.owner_contact}` : ""}</td>
              </tr>
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 0;color:#6b7280;">AI hlas</td>
                <td style="padding:8px 0;">${d.ai_voice_consent ? "Áno, súhlasím" : "Nie"}</td>
              </tr>
              ${d.highlights ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Špecifiká</td><td style="padding:8px 0;">${d.highlights}</td></tr>` : ""}
              ${d.notes ? `<tr><td style="padding:8px 0;color:#6b7280;">Poznámka</td><td style="padding:8px 0;">${d.notes}</td></tr>` : ""}
            </table>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Odoslané ${now_sk} cez VIANEMA CRM</p>
          </div>
        `,
      }),
    }).catch(e => console.warn("[produkcia/submit] email failed:", e));
  }

  return NextResponse.json({ ok: true });
}
