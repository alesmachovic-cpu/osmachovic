import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { nehnutelnost_id, akcia, poznamka } = await req.json();

    if (!nehnutelnost_id || !akcia) {
      return NextResponse.json({ error: 'Chyba parametrov' }, { status: 400 });
    }

    const novy_status = akcia === 'schvalit' ? 'aktivna' : 'neaktivna';

    const { data, error } = await supabase
      .from('nehnutelnosti')
      .update({ status_kolizie: novy_status, kolizia_poznamka: poznamka || null })
      .eq('id', nehnutelnost_id)
      .select()
      .single();

    if (error) throw error;

    // Aktualizuj aj kolizny log
    await supabase
      .from('kolizny_log')
      .update({ stav: akcia === 'schvalit' ? 'riesena' : 'ignorovana', aktualizovane: new Date().toISOString() })
      .contains('meta_data', { existujuca_nehnutelnost_id: nehnutelnost_id });

    return NextResponse.json({ success: true, nehnutelnost: data });
  } catch (e) {
    return NextResponse.json({ error: 'Chyba' }, { status: 500 });
  }
}
