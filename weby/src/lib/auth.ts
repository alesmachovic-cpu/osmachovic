/**
 * Overenie prihlásenia na serveri (API routes aj server komponenty).
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, verify } from "./session";
import { sb } from "./db";
import type { WebUser } from "./types";

export type AuthResult = { user: WebUser; error: null } | { user: null; error: NextResponse };

async function loadUser(id: string | null): Promise<WebUser | null> {
  if (!id) return null;
  const { data } = await sb().from("weby_users").select("id, email, name, role, created_at, last_login_at").eq("id", id).maybeSingle();
  return (data as WebUser) || null;
}

function cookieFromReq(req: NextRequest): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const c of raw.split(";")) {
    const [k, ...v] = c.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Pre API routes. */
export async function requireUser(req: NextRequest, opts: { admin?: boolean } = {}): Promise<AuthResult> {
  const user = await loadUser(verify(cookieFromReq(req)));
  if (!user) return { user: null, error: NextResponse.json({ error: "Vyžaduje prihlásenie" }, { status: 401 }) };
  if (opts.admin && user.role !== "admin") return { user: null, error: NextResponse.json({ error: "Len pre správcu" }, { status: 403 }) };
  return { user, error: null };
}

/** Pre server komponenty (stránky). */
export async function currentUser(): Promise<WebUser | null> {
  const jar = await cookies();
  return loadUser(verify(jar.get(COOKIE)?.value));
}

export function canEditSite(user: WebUser, site: { user_id: string | null }): boolean {
  return user.role === "admin" || (!!site.user_id && site.user_id === user.id);
}
