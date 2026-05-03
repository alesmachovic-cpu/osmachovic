import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/sign/verify?token=X
 *   Vráti metadata o entite (pre verejnú stránku, pred zadanim OTP)
 *   { entity_type, entity_id, expires_at, used, telefon_masked }
 *
 * POST /api/sign/verify
 *   Body: { token, otp, signature_data? }
 *   1. Nájdi OTP záznam podľa token_hash
 *   2. Skontroluj expiry, used_at, attempts (max 3)
 *   3. Porovnaj OTP hash
 *   4. Ak OK → uložiť podpis_data (naber) alebo podpis (objednavka)
 *      + označit OTP ako used + audit (IP, UA)
 */

const MAX_ATTEMPTS = 3;

function hashSha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function maskPhone(p: string): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 6) return p;
  return p.slice(0, -6) + "******" + p.slice(-2);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("signature_otps")
    .select("entity_type, entity_id, expires_at, used_at, telefon")
    .eq("token_hash", hashSha256(token))
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Neplatný odkaz" }, { status: 404 });

  if (data.used_at) return NextResponse.json({ error: "Tento odkaz bol už použitý" }, { status: 410 });
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: "Odkaz expiroval" }, { status: 410 });

  // Načítaj basic metadata o entite (pre zobrazenie čo podpisuje)
  let entityMeta: Record<string, unknown> = {};
  if (data.entity_type === "naber") {
    const { data: n } = await sb.from("naberove_listy")
      .select("majitel, obec, ulica, supisne_cislo, plocha, predajna_cena, typ_nehnutelnosti")
      .eq("id", data.entity_id).maybeSingle();
    entityMeta = (n || {}) as Record<string, unknown>;
  } else {
    const { data: o } = await sb.from("objednavky")
      .select("druh, cena_do, lokalita, klient_id")
      .eq("id", data.entity_id).maybeSingle();
    entityMeta = (o || {}) as Record<string, unknown>;
  }

  return NextResponse.json({
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    expires_at: data.expires_at,
    telefon_masked: maskPhone(data.telefon),
    entity_meta: entityMeta,
  });
}

export async function POST(req: NextRequest) {
  let body: { token?: string; otp?: string; signature_data?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const token = String(body.token || "").trim();
  const otp = String(body.otp || "").trim();
  if (!token || !otp) return NextResponse.json({ error: "Chýba token alebo OTP" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from("signature_otps")
    .select("*")
    .eq("token_hash", hashSha256(token))
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Neplatný odkaz" }, { status: 404 });
  if (row.used_at) return NextResponse.json({ error: "Tento odkaz bol už použitý" }, { status: 410 });
  if (new Date(row.expires_at) < new Date()) return NextResponse.json({ error: "Odkaz expiroval" }, { status: 410 });
  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Príliš veľa nesprávnych pokusov" }, { status: 429 });
  }

  if (row.otp_hash !== hashSha256(otp)) {
    await sb.from("signature_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return NextResponse.json({ error: "Nesprávny kód" }, { status: 400 });
  }

  // OK — podpíš entitu
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  const signedAt = new Date().toISOString();
  const signatureData = body.signature_data || `SMS-OTP signed ${signedAt} from ${ip}`;

  if (row.entity_type === "naber") {
    await sb.from("naberove_listy").update({
      podpis_data: signatureData,
      podpis_meta: { method: "sms_otp", ip, user_agent: ua, signed_at: signedAt, telefon: row.telefon },
    }).eq("id", row.entity_id);
  } else {
    await sb.from("objednavky").update({
      podpis: signatureData,
    }).eq("id", row.entity_id);
  }

  await sb.from("signature_otps").update({
    used_at: signedAt,
    signed_at: signedAt,
    signed_ip: ip,
    signed_user_agent: ua,
  }).eq("id", row.id);

  return NextResponse.json({ ok: true, signed_at: signedAt });
}
