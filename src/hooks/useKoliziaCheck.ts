'use client';
import { useState, useCallback, useRef } from 'react';

type Kolizia = { zavaznost?: string; [key: string]: unknown };

export function useKoliziaCheck() {
  const [kolize, setKolize] = useState<Kolizia[]>([]);
  const [nacitava, setNacitava] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const check = useCallback(async (url: string, params: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setNacitava(true);
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await res.json();
        setKolize(data.kolize || []);
      } catch (e) { console.error(e); } finally { setNacitava(false); }
    }, 600);
  }, []);
  return { kolize, nacitava, maKolize: kolize.length > 0, maKriticke: kolize.some((k: Kolizia) => k.zavaznost === 'high'), checkKlient: (p: Record<string, unknown>) => check('/api/kolize/check', p), checkNehnutelnost: (p: Record<string, unknown>) => check('/api/kolize/nehnutelnosti', p), vymazKolize: () => setKolize([]) };
}
