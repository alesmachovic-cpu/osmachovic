import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue } from "@/lib/auth/session";

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
  const { count } = await sb.from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("attempted_at", since);
  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return `Príliš veľa neúspešných pokusov. Skús znova za ${LOCKOUT_MINUTES} min.`;
  }
  // Aj per-identifier lockout (aby útočník nemohol skúšať bez limitu cez rôzne IP)
  const { count: userCount } = await sb.from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("success", false)
    .gte("attempted_at", since);
  if ((userCount ?? 0) >= MAX_ATTEMPTS * 2) {
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

async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  // Bcrypt hash začína $2a$ / $2b$ / $2y$
  if (/^\$2[aby]\$/.test(stored)) {
    try { return await bcrypt.compare(plain, stored); } catch { return false; }
  }
  // Legacy: plain text porovnanie
  return plain === stored;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!identifier) {
      return NextResponse.json({ error: "Zadaj meno alebo email" }, { status: 400 });
    }

    const ip = getClientIp(request);
    const sb = getSupabaseAdmin();

    // Rate limit
    const rateLimitError = await checkRateLimit(sb, ip, identifier);
    if (rateLimitError) {
      return NextResponse.json({ error: rateLimitError }, { status: 429 });
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

    // Nevracaj heslo
    const safeUser = { ...user, password: undefined };
    const res = NextResponse.json({ user: safeUser });
    // P0 security: nastav HMAC-signed httponly session cookie, aby sme mali
    // server-side overiteľnú identitu. AuthProvider stále číta user z body,
    // ale API endpointy budú vyžadovať tento cookie cez requireUser().
    res.headers.set("Set-Cookie", buildSessionCookieValue(String(user.id)));
    return res;
  } catch (e) {
    console.error("[login] error:", e);
    return NextResponse.json({ error: "Chyba pri prihlasovaní" }, { status: 500 });
  }
}
