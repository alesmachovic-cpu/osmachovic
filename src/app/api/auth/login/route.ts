import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue, buildBillingCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/login
 *
 * Body: { identifier, password }
 * Odpoveď: { user } (bez hesla) alebo { error }
 *
 * Bezpečnosť:
 * 1. Rate limit: max 5 pokusov za 15 min na IP (v DB tabuľke login_attempts)
 * 2. Password: bcrypt porovnanie ak je už hashované (začína $2a$/$2b$/$2y$),
 *              inak plain text + automaticky re-hash pri úspešnom prihláseni
 * 3. Constant-time odpoveď (čiastočne) — always await bcrypt ak user existuje
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         request.headers.get("x-real-ip") ||
         "unknown";
}

async function checkRateLimit(sb: ReturnType<typeof getSupabaseAdmin>, ip: string, identifier: string): Promise<string | null> {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();

  // Per IP+identifikátor — makléri zdieľajú office IP, ale každý má vlastný limit
  const { count: pairCount } = await sb.from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("identifier", identifier)
    .eq("success", false)
    .gte("attempted_at", since);
  if ((pairCount ?? 0) >= MAX_ATTEMPTS) {
    return `Príliš veľa neúspešných pokusov. Skús znova za ${LOCKOUT_MINUTES} min.`;
  }

  // Per-identifier ochrana voči útokom z rôznych IP
  const { count: userCount } = await sb.from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("success", false)
    .gte("attempted_at", since);
  if ((userCount ?? 0) >= MAX_ATTEMPTS * 3) {
    return `Účet je dočasne zablokovaný. Skús za ${LOCKOUT_MINUTES} min.`;
  }
  return null;
}

async function logAttempt(sb: ReturnType<typeof getSupabaseAdmin>, ip: string, identifier: string, success: boolean) {
  await sb.from("login_attempts").insert({
    ip, identifier: identifier.toLowerCase(), success,
    attempted_at: new Date().toISOString(),
  });
}

async function checkAndAlertNewIp(
  sb: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  userName: string,
  identifier: string,
  ip: string,
  userAgent: string,
) {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await sb.from("login_attempts")
      .select("ip")
      .eq("identifier", identifier.toLowerCase())
      .eq("success", true)
      .gte("attempted_at", since);

    const knownIps = new Set((recent ?? []).map((r: { ip: string }) => r.ip));
    // Aktuálna session je už vložená v logAttempt, teda ak je tam len táto jedna → nová IP
    const isNewIp = !knownIps.has(ip) || knownIps.size === 0;

    if (!isNewIp) return;

    const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });

    // Zápis do audit_log
    await sb.from("audit_log").insert({
      user_id: userId,
      action: "suspicious_login",
      entity_type: "user",
      entity_id: userId,
      detail: { ip, user_agent: userAgent, user_name: userName },
      ip,
      user_agent: userAgent,
    });

    // Email alert manažérovi
    const managerEmail = process.env.MANAGER_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;
    if (!managerEmail || !resendKey) return;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "VIANEMA Real <onboarding@resend.dev>",
        to: managerEmail,
        subject: "⚠️ Prihlásenie z novej IP — VIANEMA CRM",
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 22px; font-weight: 500; letter-spacing: -0.03em; color: #0A0A0A;">VIANEMA</div>
              <div style="font-size: 9px; letter-spacing: 0.4em; color: #86868B; margin-top: 2px;">REAL</div>
            </div>
            <h2 style="color: #1f2937; margin: 0 0 12px;">Prihlásenie z novej IP adresy</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Do CRM systému sa prihlásil používateľ z IP adresy, ktorú sme za posledných 30 dní nezaznamenali.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Používateľ</td>
                <td style="padding: 8px 0; font-weight: 500;">${userName || identifier}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">IP adresa</td>
                <td style="padding: 8px 0; font-weight: 500; font-family: monospace;">${ip}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Čas</td>
                <td style="padding: 8px 0;">${now}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
              Ak poznáš tohto používateľa a zmenu IP očakávaš (VPN, nová sieť), tento email ignoruj.
              Ak nie, skontroluj prístup v nastaveniach CRM.
            </p>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.warn("[login] checkAndAlertNewIp failed:", e);
  }
}

async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  // Bcrypt hash začína $2a$ / $2b$ / $2y$
  if (/^\$2[aby]\$/.test(stored)) {
    try { return await bcrypt.compare(plain, stored); } catch { return false; }
  }
  // Legacy: plain text porovnanie
  return plain === stored;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Turnstile nie je nakonfigurované — skip
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");
    const turnstileToken = String(body.turnstileToken || "");

    if (!identifier) {
      return NextResponse.json({ error: "Zadaj meno alebo email" }, { status: 400 });
    }

    const ip = getClientIp(request);
    const sb = getSupabaseAdmin();

    // Rate limit musí byť prvý — pred Turnstile aj pred DB lookupom
    const rateLimitError = await checkRateLimit(sb, ip, identifier);
    if (rateLimitError) {
      const r = NextResponse.json({ error: rateLimitError }, { status: 429 });
      r.headers.set("Retry-After", String(LOCKOUT_MINUTES * 60));
      return r;
    }

    // Cloudflare Turnstile — overenie iba ak je SECRET_KEY nastavený
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        await logAttempt(sb, ip, identifier, false);
        return NextResponse.json({ error: "Chýba Turnstile token" }, { status: 400 });
      }
      const ok = await verifyTurnstile(turnstileToken, ip);
      if (!ok) {
        await logAttempt(sb, ip, identifier, false);
        return NextResponse.json({ error: "Overenie Turnstile zlyhalo. Obnovte stránku a skúste znova." }, { status: 403 });
      }
    }

    // Nájdi usera
    const { data: users } = await sb.from("users").select("*");
    const user = (users || []).find((a: Record<string, unknown>) =>
      String(a.id).toLowerCase() === identifier ||
      String(a.email || "").toLowerCase() === identifier ||
      String(a.login_email || "").toLowerCase() === identifier ||
      String(a.name || "").toLowerCase() === identifier
    );

    if (!user) {
      // Dummy bcrypt call aby sme nedal timing leak
      await bcrypt.compare(password, "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL").catch(() => {});
      await logAttempt(sb, ip, identifier, false);
      return NextResponse.json({ error: "Nesprávne meno/email alebo heslo" }, { status: 401 });
    }

    const storedPw = user.password as string | null;
    const hasPassword = !!storedPw;

    // Ak user má heslo, overujeme. Ak nie, prihlasovanie cez Google (nie sem)
    if (hasPassword) {
      const ok = await verifyPassword(password, storedPw);
      if (!ok) {
        await logAttempt(sb, ip, identifier, false);
        return NextResponse.json({ error: "Nesprávne meno/email alebo heslo" }, { status: 401 });
      }

      // Ak heslo je v plain texte (legacy), hashni ho pri úspešnom logine
      if (!/^\$2[aby]\$/.test(storedPw || "")) {
        try {
          const hashed = await bcrypt.hash(password, 10);
          await sb.from("users").update({ password: hashed }).eq("id", user.id);
          console.log(`[login] auto-hashed password for ${user.id}`);
        } catch (e) { console.warn("[login] auto-hash failed:", e); }
      }
    } else {
      // Bez hesla = anybody can log in (staré správanie). Ale log to.
      console.warn(`[login] no password set for ${user.id} — allowing login`);
    }

    await logAttempt(sb, ip, identifier, true);

    // Fire-and-forget: alert pri prihlásení z novej IP (neblokuje odpoveď)
    const userAgent = request.headers.get("user-agent") || "";
    checkAndAlertNewIp(sb, String(user.id), String(user.name || ""), identifier, ip, userAgent).catch(() => {});

    // Billing status — zisti is_active firmy pre crm_billing cookie
    let companyActive = true;
    const companyId = user.company_id as string | null;
    if (companyId) {
      const { data: co } = await sb.from("companies").select("is_active").eq("id", companyId).single();
      companyActive = co?.is_active !== false;
    }

    // Nevracaj heslo
    const safeUser = { ...user, password: undefined };
    const res = NextResponse.json({ user: safeUser });
    res.headers.append("Set-Cookie", buildSessionCookieValue(String(user.id)));
    res.headers.append("Set-Cookie", buildBillingCookieValue(companyActive));
    return res;
  } catch (e) {
    console.error("[login] error:", e);
    return NextResponse.json({ error: "Chyba pri prihlasovaní" }, { status: 500 });
  }
}
