import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const getSb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { lokalita, typ_nehnutelnosti, izby, nazov, cena, nehnutelnost_id, makler_email, makler_meno } = await req.json();
    const kolize: Array<Record<string, unknown>> = [];

    if (lokalita && typ_nehnutelnosti && izby) {
      let query = getSb()
        .from('nehnutelnosti')
        .select('id, nazov, lokalita, typ_nehnutelnosti, izby, cena, makler_email, makler_meno, status_kolizie')
        .eq('lokalita', lokalita)
        .eq('typ_nehnutelnosti', typ_nehnutelnosti)
        .eq('izby', izby)
        .eq('status_kolizie', 'aktivna');

      if (nehnutelnost_id) query = query.neq('id', nehnutelnost_id);

      const { data: dup } = await query;

      if (dup && dup.length > 0) {
        dup.forEach(n => {
          kolize.push({
            typ: 'ROVNAKA_NEHNUTELNOST',
            zavaznost: 'high',
            sprava: lokalita + ' - ' + izby + ' izby - ' + typ_nehnutelnosti + ' uz eviduje iny makler',
            data: {
              existujuca_nehnutelnost_id: n.id,
              nazov: n.nazov,
              lokalita: n.lokalita,
              izby: n.izby,
              cena: n.cena,
              makler_a_email: n.makler_email || 'nezname',
              makler_a_meno: n.makler_meno || 'Makler A',
              makler_b_email: makler_email || 'nezname',
              makler_b_meno: makler_meno || 'Makler B',
            }
          });
        });
      }
    }

    if (kolize.length > 0) {
      await getSb().from('kolizny_log').insert(kolize.map(k => ({
        typ_kolizie: k.typ,
        zavaznost: k.zavaznost,
        popis: k.sprava,
        meta_data: k.data,
        stav: 'nova',
        vytvorene: new Date().toISOString()
      })));

      // Posli email notifikaciu
      try {
        await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL!.replace('/rest/v1', '') + '/functions/v1/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
          body: JSON.stringify({ kolize })
        });
      } catch (e) { console.log('Email nedostupny:', (e as Error).message); }
    }

    return NextResponse.json({ ma_kolizie: kolize.length > 0, pocet: kolize.length, kolize });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Chyba' }, { status: 500 });
  }
}
