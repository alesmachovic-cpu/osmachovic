'use client';
import { useState, useCallback, useRef } from 'react';
export function useKoliziaCheck() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kolize, setKolize] = useState<any[]>([]);
  const [nacitava, setNacitava] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounceRef = useRef<any>(null);
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
  return { kolize, nacitava, maKolize: kolize.length > 0, maKriticke: kolize.some((k: any) => k.zavaznost === 'high'), checkKlient: (p: Record<string, unknown>) => check('/api/kolize/check', p), checkNehnutelnost: (p: Record<string, unknown>) => check('/api/kolize/nehnutelnosti', p), vymazKolize: () => setKolize([]) };
}
