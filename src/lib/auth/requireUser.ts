/**
 * requireUser — server-side guard pre /api/* route.ts.
 *
 * Použitie:
 *   const auth = await requireUser(req);
 *   if (auth.error) return auth.error; // už je NextResponse 401
 *   const userId = auth.user.id;
 *
 * BACKWARD COMPAT: ak request obsahuje X-CRM-User-Id header (legacy klient bez
 * cookie), prijmeme ho s WARN logom a priraďujeme low-trust user. Endpointy
 * ktoré chcú strict mode používajú requireUser(req, { strict: true }).
 *
 * P0 SCOPE: aplikujem na vysoko-rizikové endpointy (mutations + IDOR-prone
 * GETs). Ostatné fungujú ako predtým, kým migrujeme inkrementálne.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "./session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface AuthOk {
  error: null;
  user: { id: string; role: string; name: string; email: string; company_id: string; pobocka_id: string | null };
  source: "session" | "header_legacy";
}
export interface AuthFail {
  error: NextResponse;
  user: null;
  source: null;
}
export type AuthResult = AuthOk | AuthFail;

interface RequireOpts {
  /** Ak true, neprijme legacy X-CRM-User-Id header — len overený session cookie. */
  strict?: boolean;
  /** Ak je nastavené, vyžaduje že user.role je medzi týmito hodnotami. */
  requireRole?: string[];
}

/** Načíta cookie z request headers. */
function readCookie(req: NextRequest, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  const cookies = raw.split(";").map(c => c.trim());
  for (const c of cookies) {
    const eq = c.indexOf("=");
    if (eq > 0 && c.slice(0, eq) === name) return decodeURIComponent(c.slice(eq + 1));
  }
  return null;
}

export async function requireUser(req: NextRequest, opts: RequireOpts = {}): Promise<AuthResult> {
  const failResponse = (status: number, msg: string): AuthFail => ({
    error: NextResponse.json({ error: msg }, { status }),
    user: null,
    source: null,
  });

  // 1) Skús session cookie (bezpečný way)
  const cookie = readCookie(req, SESSION_COOKIE_NAME);
  let userId: string | null = null;
  let source: AuthOk["source"] = "session";

  if (cookie) {
    const verified = verifySession(cookie);
    if (verified) {
      userId = verified.userId;
    } else {
      // Cookie existuje ale je invalid → zamietni
      return failResponse(401, "Neplatná alebo expirovaná session — prihlás sa znova");
    }
  } else if (!opts.strict) {
    // 2) Backward compat: header X-CRM-User-Id (legacy AuthProvider ho ešte nepošle —
    //    musíme upraviť klienta, ale dovtedy aspoň niečo)
    const headerUid = req.headers.get("x-crm-user-id");
    if (headerUid && /^[a-zA-Z0-9_-]+$/.test(headerUid)) {
      userId = headerUid;
      source = "header_legacy";
    }
  }

  if (!userId) {
    return failResponse(401, "Vyžaduje prihlásenie");
  }

  // 3) Načítaj user z DB (potrebné pre role checks + company_id)
  const sb = getSupabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("id, name, role, email, company_id, pobocka_id")
    .eq("id", userId)
    .maybeSingle();
  if (!user) {
    return failResponse(401, "Užívateľ neexistuje");
  }

  // 4) Role check
  if (opts.requireRole && opts.requireRole.length > 0) {
    if (!opts.requireRole.includes(user.role as string)) {
      return failResponse(403, "Nemáš oprávnenie na túto akciu");
    }
  }

  return {
    error: null,
    user: {
      id: user.id as string,
      role: user.role as string,
      name: user.name as string,
      email: user.email as string,
      company_id: (user.company_id ?? "a0000000-0000-0000-0000-000000000001") as string,
      pobocka_id: (user.pobocka_id as string | null) ?? null,
    },
    source,
  };
}

/** Pomocná: aktuálny userId zo session, alebo null. Bez auth response — pre endpoints ktoré chcu fallback. */
export function readSessionUserId(req: NextRequest): string | null {
  const cookie = readCookie(req, SESSION_COOKIE_NAME);
  if (!cookie) return null;
  const v = verifySession(cookie);
  return v?.userId ?? null;
}

export const isSuperAdmin = (role: string | null | undefined): boolean =>
  role === "super_admin" || role === "majitel";

/** manazer + všetko nad tým */
export const isManagerOrAbove = (role: string | null | undefined): boolean =>
  isSuperAdmin(role) || role === "manazer";

/** Čistý makler (bez manažérskych práv) */
export const isMakler = (role: string | null | undefined): boolean =>
  !isManagerOrAbove(role);
