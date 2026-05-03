import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms, normalizePhone } from "@/lib/sms";

export const runtime = "nodejs";

/**
 * POST /api/sign/request
 * Body: { entity_type: 'naber'|'objednavka', entity_id, telefon, user_id }
 *
 * 1. Vygeneruje 6-ciferný OTP + 32-byte token (URL-safe)
 * 2. Hashuje obe + uloží do signature_otps (TTL 15 min)
 * 3. Pošle SMS s linkom + OTP (alebo vráti manual mode ak SMS nedostupné)
 * 4. Vráti maklerovi link (na ukážku/share) + ak manual mode aj plain OTP
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

export async function POST(req: NextRequest) {
  let body: { entity_type?: string; entity_id?: string; telefon?: string; user_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const entityType = body.entity_type;
  const entityId = body.entity_id;
  if (!entityType || !["naber", "objednavka"].includes(entityType)) {
    return NextResponse.json({ error: "entity_type musí byť 'naber' alebo 'objednavka'" }, { status: 400 });
  }
  if (!entityId) return NextResponse.json({ error: "entity_id required" }, { status: 400 });
  const telefon = normalizePhone(body.telefon || "");
  if (!telefon) return NextResponse.json({ error: "Neplatný telefón" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // Overí že entita existuje (a získa info pre SMS)
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

  // Pošli SMS
  const origin = new URL(req.url).origin;
  const link = `${origin}/podpis/${token}`;
  const smsBody = `Vianema: Pre podpis ${entityLabel} otvor ${link} a zadaj kód ${otp}. Platí ${TTL_MIN} minút.`;
  const sms = await sendSms(telefon, smsBody);

  // Persist
  const { error: insErr } = await sb.from("signature_otps").insert({
    token_hash: hashSha256(token),
    entity_type: entityType,
    entity_id: entityId,
    telefon,
    otp_hash: hashSha256(otp),
    requested_by_user_id: body.user_id || null,
    expires_at: expiresAt,
    sms_status: sms.ok ? "sent" : "failed",
    sms_provider: sms.provider,
    sms_error: sms.error,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Manual mode = OTP zobrazený maklérovi (klient kód doplní cez telefón)
  const manual = !sms.ok;
  return NextResponse.json({
    ok: true,
    link,
    expires_at: expiresAt,
    manual,
    // V manual mode vrátime aj plain OTP — maklér ho prečíta klientovi.
    // V SMS mode OTP nikdy nevraciame (klient ho dostal cez SMS).
    otp: manual ? otp : undefined,
    sms: {
      provider: sms.provider,
      sent: sms.ok,
      error: sms.error,
    },
  });
}
