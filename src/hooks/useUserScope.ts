"use client";

import { useState, useEffect } from "react";

export type ClientUserScope = {
  user_id: string;
  role: "super_admin" | "majitel" | "manazer" | "makler";
  makler_id: string | null;
  pobocka_id: string | null;
  pobocka_ids: string[];
  company_id: string;
  isAdmin: boolean;
  isManager: boolean;
  /** null = vidí všetkých (admin/majiteľ). [] = nikoho. inak whitelist makler_id. */
  peers_makler_ids: string[] | null;
};

// In-memory cache — scope sa mení zriedka (rola sa nemení často), nech každá
// stránka nerobí fetch pri mount-e. TTL 5 min, alebo manuálne invalidate.
let cached: { data: ClientUserScope | null; expires: number } | null = null;
const TTL_MS = 5 * 60_000;
const subscribers = new Set<(s: ClientUserScope | null) => void>();

async function fetchScope(): Promise<ClientUserScope | null> {
  try {
    const r = await fetch("/api/user-scope", { credentials: "include" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Vráti scope prihláseného užívateľa. Pri prvom volaní fetchne, ďalšie volania
 * v rámci TTL používajú cache (zdieľanú cez všetky komponenty).
 *
 * Použitie:
 *   const { scope, isLoading } = useUserScope();
 *   if (scope?.isAdmin) { ... }
 *   const canEdit = canEditRecord(scope, klient.makler_id);
 */
export function useUserScope() {
  const [scope, setScope] = useState<ClientUserScope | null>(cached?.data ?? null);
  const [isLoading, setLoading] = useState<boolean>(!cached);

  useEffect(() => {
    // Cache hit (fresh) — nič nerobíme.
    if (cached && cached.expires > Date.now()) {
      setScope(cached.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    fetchScope().then(data => {
      if (cancelled) return;
      cached = { data, expires: Date.now() + TTL_MS };
      setScope(data);
      setLoading(false);
      subscribers.forEach(cb => cb(data));
    });

    // Subscribe na cross-component invalidácie
    const cb = (s: ClientUserScope | null) => setScope(s);
    subscribers.add(cb);
    return () => { cancelled = true; subscribers.delete(cb); };
  }, []);

  return { scope, isLoading };
}

/**
 * Manuálne refresh-ne scope — volaj po zmene role / pobočky.
 */
export function invalidateUserScope() {
  cached = null;
  fetchScope().then(data => {
    cached = { data, expires: Date.now() + TTL_MS };
    subscribers.forEach(cb => cb(data));
  });
}

/**
 * Synchronná FE verzia canEditRecord — používa peers_makler_ids zo scope-u.
 * Vracia true ak prihlásený užívateľ môže editovať záznam s daným makler_id.
 *
 * Pravidlá (identicky ako backend canEditRecord):
 *   - admin/majiteľ — vždy true
 *   - vlastník (makler_id match) — true
 *   - manažér — true ak makler_id je v peers_makler_ids
 *   - inak — false
 *
 * Pre záznam BEZ makler_id (legacy/system) vracia true len pre adminov.
 */
export function canEditRecord(
  scope: ClientUserScope | null,
  recordMaklerId: string | null | undefined,
): boolean {
  if (!scope) return false;
  if (scope.isAdmin) return true;
  if (!recordMaklerId) return false;
  if (scope.makler_id && recordMaklerId === scope.makler_id) return true;
  if (scope.peers_makler_ids === null) return true; // backend safeguard (shouldn't happen for non-admin)
  return scope.peers_makler_ids.includes(recordMaklerId);
}
