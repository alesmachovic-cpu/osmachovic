"use client";

import { useState, useEffect } from "react";

export type MatchingSummaryItem = {
  totalMatches: number;
  topScore: number;
  daysSinceCreated: number;
};

export function useMatchingSummary(ids: string[]) {
  const [data, setData] = useState<Record<string, MatchingSummaryItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const key = ids.join(",");

  useEffect(() => {
    if (!key) { setData(null); return; }
    setLoading(true);
    fetch(`/api/matching/summary?objednavky=${key}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [key]);

  return { data, loading };
}

export type ZhodaItem = {
  nehnutelnost: {
    id: string;
    typ: string | null;
    cena: number | null;
    plocha: number | null;
    izby: number | null;
    lokalita: string | null;
    okres: string | null;
    nazov?: string | null;
    source?: "internal" | "monitor";
    portal?: string | null;
    url?: string | null;
    predavajuci?: { id: string; meno: string; telefon: string | null };
  };
  score: number;
};

export function useZhodyPreObjednavku(id: string | null, limit = 5) {
  const [data, setData] = useState<ZhodaItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setData(null); return; }
    setLoading(true);
    fetch(`/api/matching/objednavka/${id}?limit=${limit}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id, limit]);

  return { data, loading };
}

export type ZaujemcaItem = {
  objednavka: {
    id: string;
    klient_id: string;
    druh: string | string[] | null;
    cena_do: number | null;
    cena_od: number | null;
    lokalita: unknown;
    kupujuci?: { id: string; meno: string; telefon: string | null };
  };
  score: number;
};

export function useZaujemcoviaPreNehnutelnost(id: string | null) {
  const [data, setData] = useState<ZaujemcaItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setData(null); return; }
    setLoading(true);
    fetch(`/api/matching/nehnutelnost/${id}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}
