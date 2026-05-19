import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/auth/session-bootstrap — DEPRECATED & DISABLED
 *
 * Tento endpoint mintol crm_session HMAC cookie pre AKÉKOĽVEK user_id z body.
 * Útočník zistí ID admina (napr. cez /api/users) → POST sem → dostane admin session.
 *
 * FIX 2026-05-20 (Security Auditor finding P0):
 * Endpoint vracia 410 Gone. AuthProvider musí presmerovať na /login.
 * Klient po prihlasení dostane crm_session cookie normálnou cestou cez /api/auth/login.
 *
 * Pôvodný komentár sám priznal že je rozbitý: "klient si stale moze podvrhnut user_id".
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: "Endpoint deaktivovaný kvôli bezpečnosti. Prihlás sa znova cez /login.",
      code: "SESSION_BOOTSTRAP_DEPRECATED",
    },
    { status: 410 } // 410 Gone
  );
}
