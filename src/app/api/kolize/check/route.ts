import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
const getSb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
export async function POST(req: NextRequest) {
  try {
    const { telefon, email, klient_id } = await req.json();
    const kolize: Array<Record<string, unknown>> = [];
    if (telefon) {
      const clean = telefon.replace(/s+/g, '').replace(/^0/, '+421');
      const { data: dup } = await getSb().from('klienti').select('id, meno, priezvisko').or('telefon.eq.' + telefon + ',telefon.eq.' + clean).neq('id', klient_id || '00000000-0000-0000-0000-000000000000');
      if (dup && dup.length > 0) dup.forEach(k => kolize.push({ typ: 'DUPLIKATNY_TELEFON', zavaznost: 'high', sprava: 'Telefon ' + telefon + ' uz existuje pre klienta ' + k.meno + ' ' + k.priezvisko, data: { existujuci_klient_meno: k.meno + ' ' + k.priezvisko } }));
    }
    if (email) {
      const { data: dup } = await getSb().from('klienti').select('id, meno, priezvisko').eq('email', email.toLowerCase()).neq('id', klient_id || '00000000-0000-0000-0000-000000000000');
      if (dup && dup.length > 0) dup.forEach(k => kolize.push({ typ: 'DUPLIKATNY_EMAIL', zavaznost: 'medium', sprava: 'Email ' + email + ' uz existuje pre klienta ' + k.meno + ' ' + k.priezvisko, data: { existujuci_klient_meno: k.meno + ' ' + k.priezvisko } }));
    }
    if (kolize.length > 0) await getSb().from('kolizny_log').insert(kolize.map(k => ({ typ_kolizie: k.typ, zavaznost: k.zavaznost, popis: k.sprava, meta_data: k.data, stav: 'nova', vytvorene: new Date().toISOString() })));
    return NextResponse.json({ ma_kolizie: kolize.length > 0, pocet: kolize.length, kolize });
  } catch (e) { return NextResponse.json({ error: 'Chyba' }, { status: 500 }); }
}