import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Spustí sa denne cez Vercel cron (vercel.json).
// Pre každý aktívny pravidelný náklad: ak je dnes 0–2 dni pred dňom splatnosti
// a tento mesiac ešte neexistuje záznam, vytvor ho v prehlad_zaznamy.

export async function GET() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const monthStart = `${yyyy}-${mm}-01`;
  const nextMonth = new Date(yyyy, today.getMonth() + 1, 1).toISOString().slice(0, 10);

  const { data: pravidelne, error } = await supabase
    .from("pravidelne_naklady")
    .select("*")
    .eq("aktivny", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const created: string[] = [];

  for (const p of pravidelne ?? []) {
    const lastDayOfMonth = new Date(yyyy, today.getMonth() + 1, 0).getDate();
    const splatnostDen = Math.min(p.den_splatnosti, lastDayOfMonth);
    const splatnost = new Date(yyyy, today.getMonth(), splatnostDen);
    const diffDays = Math.ceil((splatnost.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Pridať keď zostáva 0–2 dni do splatnosti
    if (diffDays > 2 || diffDays < 0) continue;

    // Skontroluj či už existuje pre tento mesiac
    const { data: existing } = await supabase
      .from("prehlad_zaznamy")
      .select("id")
      .eq("popis", p.nazov)
      .gte("datum", monthStart)
      .lt("datum", nextMonth)
      .limit(1);

    if (existing && existing.length > 0) continue;

    await supabase.from("prehlad_zaznamy").insert({
      typ: "vydaj",
      datum: splatnost.toISOString().slice(0, 10),
      popis: p.nazov,
      suma: p.suma,
      zaplatene: false,
      kategoria: p.kategoria || "Pravidelný náklad",
    });
    created.push(p.nazov);
  }

  return NextResponse.json({ ok: true, created, count: created.length });
}
