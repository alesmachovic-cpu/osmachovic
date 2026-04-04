'use client';
import { useEffect, useState } from 'react';
const ICONS: Record<string, string> = { DUPLIKATNY_TELEFON: '📞', DUPLIKATNY_EMAIL: '✉️', ROVNAKA_NEHNUTELNOST_VIACERI_MAKLERI: '🏠' };
const LABELS: Record<string, string> = { DUPLIKATNY_TELEFON: 'Duplicitny telefon', DUPLIKATNY_EMAIL: 'Duplicitny email', ROVNAKA_NEHNUTELNOST_VIACERI_MAKLERI: 'Nehnutelnost u viacerych makleri' };
export default function KolizePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kolize, setKolize] = useState<any[]>([]);
  const [stats, setStats] = useState({ celkom: 0, nove: 0, high: 0, medium: 0, riesene: 0 });
  const [nacitava, setNacitava] = useState(true);
  const [filterStav, setFilterStav] = useState('');
  const [riesenieId, setRiesenieId] = useState(null);
  const [poznamka, setPoznamka] = useState('');
  const nacitaj = async () => {
    setNacitava(true);
    const params = new URLSearchParams();
    if (filterStav) params.set('stav', filterStav);
    const res = await fetch('/api/kolize?' + params);
    const data = await res.json();
    setKolize(data.kolize || []);
    setStats(data.stats || {});
    setNacitava(false);
  };
  useEffect(() => { nacitaj(); }, [filterStav]);
  const aktualizuj = async (id: string, stav: string) => {
    await fetch('/api/kolize', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, stav, poznamka }) });
    setRiesenieId(null); setPoznamka(''); nacitaj();
  };
  return (
    <div className='p-6'>
      <div className='mb-8 flex items-center gap-3'>
        <span className='text-3xl'>⚡</span>
        <div><h1 className='text-2xl font-bold'>Kolizny system</h1><p className='text-white/40 text-sm'>Ochrana klientov a nehnutelnosti</p></div>
        {stats.nove > 0 && <span className='bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full ml-2'>{stats.nove} novych</span>}
      </div>
      <div className='grid grid-cols-5 gap-3 mb-8'>
        {[['Celkom', stats.celkom, 'border-white/10'], ['Nove', stats.nove, 'border-blue-500/20'], ['Kriticke', stats.high, 'border-red-500/20'], ['Stredne', stats.medium, 'border-yellow-500/20'], ['Riesene', stats.riesene, 'border-green-500/20']].map(([l, v, c]) => (
          <div key={l} className={'rounded-xl border bg-white/3 p-4 ' + c}><div className='text-2xl font-bold'>{v}</div><div className='text-xs text-white/40 mt-1'>{l}</div></div>
        ))}
      </div>
      <div className='flex gap-3 mb-6'>
        <select value={filterStav} onChange={e => setFilterStav(e.target.value)} className='bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none'>
          <option value=''>Vsetky stavy</option>
          <option value='nova'>Nove</option>
          <option value='riesena'>Riesene</option>
          <option value='ignorovana'>Ignorovane</option>
        </select>
        <button onClick={nacitaj} className='bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-sm'>Obnovit</button>
      </div>
      {nacitava ? <div className='text-center py-16 text-white/30'>Nacitavam...</div> : kolize.length === 0 ? <div className='text-center py-16 text-white/30'><div className='text-4xl mb-3'>✅</div><p>Ziadne kolizie</p></div> : (
        <div className='space-y-3'>
          {kolize.map(k => (
            <div key={k.id} className={'rounded-2xl border p-5 ' + (k.stav === 'nova' && k.zavaznost === 'high' ? 'border-red-500/30 bg-red-500/5' : k.stav === 'nova' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/10 opacity-50')}>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex gap-3 flex-1'>
                  <span className='text-2xl'>{ICONS[k.typ_kolizie] || '⚠️'}</span>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 flex-wrap mb-1'>
                      <span className='font-semibold text-sm'>{LABELS[k.typ_kolizie] || k.typ_kolizie}</span>
                      <span className={'text-xs px-2 py-0.5 rounded-full ' + (k.zavaznost === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400')}>{k.zavaznost === 'high' ? 'Kriticka' : 'Stredna'}</span>
                      <span className={'text-xs px-2 py-0.5 rounded-full ' + (k.stav === 'riesena' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40')}>{k.stav === 'nova' ? 'Nova' : k.stav === 'riesena' ? 'Riesena' : 'Ignorovana'}</span>
                    </div>
                    <p className='text-sm text-white/60'>{k.popis}</p>
                    <p className='text-xs text-white/25 mt-2'>{new Date(k.vytvorene).toLocaleDateString('sk-SK')}</p>
                  </div>
                </div>
                {k.stav === 'nova' && (
                  <div className='flex flex-col gap-2 shrink-0'>
                    {riesenieId === k.id ? (
                      <>
                        <input type='text' placeholder='Poznamka...' value={poznamka} onChange={e => setPoznamka(e.target.value)} className='bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none w-36' />
                        <button onClick={() => aktualizuj(k.id, 'riesena')} className='bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg px-3 py-1.5 text-xs'>Potvrdit</button>
                        <button onClick={() => setRiesenieId(null)} className='text-white/30 text-xs'>Zrusit</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setRiesenieId(k.id)} className='bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl px-3 py-1.5 text-xs'>Riesit</button>
                        <button onClick={() => aktualizuj(k.id, 'ignorovana')} className='bg-white/5 text-white/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs'>Ignorovat</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}