import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms, normalizePhone } from "@/lib/sms";

export const runtime = "nodejs";

/**
 * POST /api/sign/request
 * Body: {
 *   entity_type: 'naber'|'objednavka',
 *   entity_id,
 *   channel: 'sms'|'email',  // default 'sms'
 *   telefon?: string,         // ak channel='sms'
 *   email?: string,           // ak channel='email' (zadarmo cez Resend)
 *   user_id
 * }
 *
 * 1. Vygeneruje 6-ciferný OTP + 32-byte token (URL-safe)
 * 2. Hashuje obe + uloží do signature_otps (TTL 15 min)
 * 3. Pošle SMS alebo email s linkom + OTP
 * 4. Manual mode (ak provider zlyhá) → vráti OTP makléri
 */

const TTL_MIN = 15;

function hashSha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function genToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Pošle email s linkom + OTP cez Resend. Vráti {ok, error}. */
async function sendOtpEmail(toEmail: string, link: string, otp: string, entityLabel: string): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, error: "Resend nie je nakonfigurovaný" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "VIANEMA Real <onboarding@resend.dev>",
        to: toEmail,
        subject: `Podpis ${entityLabel} — VIANEMA Real`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 22px; font-weight: 500; letter-spacing: -0.03em; color: #0A0A0A;">VIANEMA</div>
              <div style="font-size: 9px; letter-spacing: 0.4em; color: #86868B; margin-top: 2px;">REAL</div>
            </div>
            <h2 style="color: #1f2937; margin: 0 0 12px;">Podpis ${entityLabel}</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Pre podpis dokumentu otvorte tento odkaz a zadajte overovací kód.
              Odkaz je platný ${TTL_MIN} minút.
            </p>
            <p style="margin: 24px 0;">
              <a href="${link}" style="background: #374151; color: #fff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; display: inline-block;">
                Otvoriť dokument na podpis
              </a>
            </p>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0;">
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">Overovací kód</div>
              <div style="font-size: 28px; font-weight: 700; letter-spacing: 0.3em; color: #111827; font-family: monospace;">${otp}</div>
            </div>
            <p style="font-size: 11px; color: #9ca3af;">
              Ak tlačidlo nefunguje, skopírujte tento odkaz:<br/>
              <code style="word-break: break-all;">${link}</code>
            </p>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 24px;">
              Ak ste o podpis nepožiadali, tento email môžete ignorovať.
            </p>
            <div style="text-align: center; margin-top: 28px; padding-top: 16px; border-top: 1px solid #E8E8ED; opacity: 0.6;">
              <span style="font-size: 9px; letter-spacing: 0.12em; color: #6b7280;">POWERED BY</span>
              <span style="font-size: 11px; font-weight: 500; letter-spacing: -0.02em; color: #1f2937; margin-left: 8px;">AMGD</span>
            </div>
          </div>
        `,
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => "");
      return { ok: false, error: `HTTP ${r.status}: ${err.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function POST(req: NextRequest) {
  let body: { entity_type?: string; entity_id?: string; channel?: string; telefon?: string; email?: string; user_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const entityType = body.entity_type;
  const entityId = body.entity_id;
  if (!entityType || !["naber", "objednavka"].includes(entityType)) {
    return NextResponse.json({ error: "entity_type musí byť 'naber' alebo 'objednavka'" }, { status: 400 });
  }
  if (!entityId) return NextResponse.json({ error: "entity_id required" }, { status: 400 });

  const channel = (body.channel || "sms").toLowerCase();
  if (!["sms", "email"].includes(channel)) {
    return NextResponse.json({ error: "channel musí byť 'sms' alebo 'email'" }, { status: 400 });
  }

  let telefon: string | null = null;
  let email: string | null = null;
  if (channel === "sms") {
    telefon = normalizePhone(body.telefon || "");
    if (!telefon) return NextResponse.json({ error: "Neplatný telefón" }, { status: 400 });
  } else {
    email = String(body.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Neplatný email" }, { status: 400 });
    }
  }

  const sb = getSupabaseAdmin();

  // Overí že entita existuje (a získa info)
  let entityLabel = "";
  if (entityType === "naber") {
    const { data } = await sb.from("naberove_listy").select("id, podpis_data, majitel").eq("id", entityId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Náberový list neexistuje" }, { status: 404 });
    if (data.podpis_data) return NextResponse.json({ error: "Náberový list je už podpísaný" }, { status: 400 });
    entityLabel = `náberového listu${data.majitel ? ` pre ${data.majitel}` : ""}`;
  } else {
    const { data } = await sb.from("objednavky").select("id, podpis").eq("id", entityId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Objednávka neexistuje" }, { status: 404 });
    if (data.podpis) return NextResponse.json({ error: "Objednávka je už podpísaná" }, { status: 400 });
    entityLabel = "objednávky";
  }

  const otp = genOtp();
  const token = genToken();
  const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000).toISOString();

  const origin = new URL(req.url).origin;
  const link = `${origin}/podpis/${token}`;

  // Pošli notifikáciu cez vybraný kanál
  let sendOk = false;
  let sendProvider = channel;
  let sendError: string | undefined;
  if (channel === "sms" && telefon) {
    const sms = await sendSms(telefon, `Vianema: Pre podpis ${entityLabel} otvor ${link} a zadaj kód ${otp}. Platí ${TTL_MIN} minút.`);
    sendOk = sms.ok;
    sendProvider = sms.provider;
    sendError = sms.error;
  } else if (channel === "email" && email) {
    const emailRes = await sendOtpEmail(email, link, otp, entityLabel);
    sendOk = emailRes.ok;
    sendProvider = "resend";
    sendError = emailRes.error;
  }

  // Persist (telefon stĺpec je NOT NULL — uložíme buď telefon alebo email-as-fallback)
  const { error: insErr } = await sb.from("signature_otps").insert({
    token_hash: hashSha256(token),
    entity_type: entityType,
    entity_id: entityId,
    telefon: telefon || email || "",  // záznam pre audit
    otp_hash: hashSha256(otp),
    requested_by_user_id: body.user_id || null,
    expires_at: expiresAt,
    sms_status: sendOk ? "sent" : "failed",
    sms_provider: sendProvider,
    sms_error: sendError,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Manual mode = OTP zobrazený maklérovi (klient kód doplní iným spôsobom)
  const manual = !sendOk;
  return NextResponse.json({
    ok: true,
    channel,
    link,
    expires_at: expiresAt,
    manual,
    otp: manual ? otp : undefined,
    delivery: {
      provider: sendProvider,
      sent: sendOk,
      error: sendError,
    },
  });
}
