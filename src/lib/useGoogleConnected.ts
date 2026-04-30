"use client";

import { useEffect, useState } from "react";

/**
 * Vráti či user má pripojený Google účet (s Calendar/Gmail/Drive scope).
 * undefined = ešte loading.
 */
export function useGoogleConnected(userId?: string | null): boolean | undefined {
  const [connected, setConnected] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!userId) { setConnected(undefined); return; }
    let cancelled = false;
    fetch(`/api/auth/google/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setConnected(!!d?.connected); })
      .catch(() => { if (!cancelled) setConnected(false); });
    return () => { cancelled = true; };
  }, [userId]);
  return connected;
}
