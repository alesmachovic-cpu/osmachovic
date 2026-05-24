"use client";

import { useEffect, useState } from "react";

/**
 * Vráti či user má pripojený Google účet (s Calendar/Gmail/Drive scope).
 * undefined = ešte loading.
 *
 * Implementácia: module-level cache + in-flight deduplication.
 * Bez tohto by každý komponent (Sidebar, page.tsx, ObhliadkyKandidatiBanner...)
 * spustil samostatný fetch /api/auth/google/status pri mount = 2-3 requesty
 * pri otvorení dashboardu. Toto rieši Problem #3 z network reportu.
 *
 * TTL je 60 sekúnd — Google connection state sa mení zriedka, takže cache je
 * bezpečná. Po odhlásení/prihlásení Google sa cache invaliduje manuálne cez
 * invalidateGoogleConnected().
 */

type CacheEntry = {
  value: boolean | undefined;
  expiresAt: number;
  inflight?: Promise<boolean>;
  subscribers: Set<(v: boolean | undefined) => void>;
};

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function getOrCreate(userId: string): CacheEntry {
  let entry = cache.get(userId);
  if (!entry) {
    entry = { value: undefined, expiresAt: 0, subscribers: new Set() };
    cache.set(userId, entry);
  }
  return entry;
}

async function fetchStatus(userId: string): Promise<boolean> {
  const res = await fetch(
    `/api/auth/google/status?userId=${encodeURIComponent(userId)}`,
    { credentials: "include" }
  );
  const data = await res.json();
  return !!data?.connected;
}

/** Manuálna invalidácia cache (zavolaj po Google connect/disconnect flow). */
export function invalidateGoogleConnected(userId?: string) {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}

export function useGoogleConnected(userId?: string | null): boolean | undefined {
  const [connected, setConnected] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setConnected(undefined);
      return;
    }
    const entry = getOrCreate(userId);
    entry.subscribers.add(setConnected);

    const now = Date.now();
    // Čerstvý cache hit
    if (entry.value !== undefined && now < entry.expiresAt) {
      setConnected(entry.value);
    } else if (entry.inflight) {
      // Iný komponent už fetuje — nasleduj
      setConnected(entry.value); // ukáž posledné známe (možno undefined)
      entry.inflight.then(v => setConnected(v)).catch(() => setConnected(false));
    } else {
      // Spusti fetch a uchovaj promise pre ďalších
      const promise = fetchStatus(userId)
        .then(v => {
          entry.value = v;
          entry.expiresAt = Date.now() + TTL_MS;
          entry.inflight = undefined;
          entry.subscribers.forEach(s => s(v));
          return v;
        })
        .catch(() => {
          entry.value = false;
          entry.expiresAt = Date.now() + TTL_MS;
          entry.inflight = undefined;
          entry.subscribers.forEach(s => s(false));
          return false;
        });
      entry.inflight = promise;
      setConnected(entry.value); // možno undefined kým neskončí
    }

    return () => {
      entry.subscribers.delete(setConnected);
    };
  }, [userId]);

  return connected;
}
