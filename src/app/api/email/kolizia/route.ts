import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { makler_a_email, makler_b_email, makler_a_meno, makler_b_meno, lokalita, izby, typ } = await req.json();

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) return NextResponse.json({ error: 'RESEND_API_KEY chyba' }, { status: 500 });

    const spravy = [
      {
        to: process.env.MANAGER_EMAIL || 'manager@vianema.sk',
        subject: 'KOLIZIA: Duplicitna nehnutelnost',
        html: '<h2>Kolizia nehnutelnosti</h2><p>Makler <b>' + makler_b_meno + '</b> nahodil duplikatnu nehnutelnost (' + lokalita + ', ' + izby + ' izby, ' + typ + '), ktoru uz eviduje Makler <b>' + makler_a_meno + '</b>.</p><p><b>Akcia: Prihlaste sa do systemu a schvalte alebo zamietnte zaznam.</b></p>'
      },
      {
        to: makler_a_email,
        subject: 'Info: Kolega sa pokusil registrovat tvoju nehnutelnost',
        html: '<p>Dobry den ' + makler_a_meno + ',</p><p>Kolega sa pokusil registrovat nehnutelnost na adrese <b>' + lokalita + '</b> (' + izby + ' izby), ktoru uz evidujete vy. System zaznam zablokoval a caka na schvalenie manazera.</p>'
      },
      {
        to: makler_b_email,
        subject: 'Upozornenie: Vas zaznam caka na schvalenie',
        html: '<p>Dobry den ' + makler_b_meno + ',</p><p>Vas zaznam nehnutelnosti <b>' + lokalita + '</b> (' + izby + ' izby) je v kolizii s existujucim zaznamom. Zaznam je docasne neaktivny a caka na vyjadrenie manazera.</p>'
      }
    ];

    const vysledky = await Promise.allSettled(
      spravy.map(s =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'OS Machovic <noreply@vianema.sk>', to: s.to, subject: s.subject, html: s.html })
        })
      )
    );

    return NextResponse.json({ success: true, odoslane: vysledky.filter(r => r.status === 'fulfilled').length });
  } catch (e) {
    return NextResponse.json({ error: 'Chyba' }, { status: 500 });
  }
}
