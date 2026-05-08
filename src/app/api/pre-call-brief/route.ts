import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/pre-call-brief
 * Body: { inzerat_id }   // monitor_inzeraty.id
 *
 * Vyrobí krátky brief (~150 slov) ktorý maklér môže prečítať pred zavolaním
 * predajcovi z monitora. Obsahuje:
 *   - Základné údaje (typ, plocha, lokalita)
 *   - Aktívne motivation_signals
 *   - Trhové porovnanie (median, gap od trhu)
 *   - Konkrétne talking points čo povedať predajcovi
 *
 * Stačí 1 Claude volanie (~0.01 € per brief).
 */

interface MonitorRow {
  id: string;
  url: string;
  nazov: string | null;
  typ: string | null;
  lokalita: string | null;
  cena: number | null;
  plocha: number | null;
  izby: number | null;
  popis: string | null;
  predajca_typ: string | null;
  first_seen_at: string;
  last_seen_at: string;
  motivation_score: number;
  listed_on_n_portals: number;
  first_known_cena: number | null;
}

interface SignalRow {
  signal_type: string;
  severity: string;
  evidence: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  let body: { inzerat_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  if (!body.inzerat_id) return NextResponse.json({ error: "inzerat_id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: inz, error } = await sb
    .from("monitor_inzeraty")
    .select("id, url, nazov, typ, lokalita, cena, plocha, izby, popis, predajca_typ, first_seen_at, last_seen_at, motivation_score, listed_on_n_portals, first_known_cena")
    .eq("id", body.inzerat_id)
    .single();
  if (error || !inz) return NextResponse.json({ error: "Inzerát nenájdený" }, { status: 404 });

  const m = inz as MonitorRow;

  // Aktívne motivation signals
  const { data: signals } = await sb
    .from("motivation_signals")
    .select("signal_type, severity, evidence")
    .eq("inzerat_id", m.id)
    .eq("is_active", true);

  // Trhový benchmark (realized > asking) z monitor dát
  const lokFilter = (m.lokalita || "").split(" ")[0];
  let cmaText = "Pre tento segment nie je dosť trhových dát.";
  let benchPerM2 = 0;
  let realizedCount = 0;
  let avgDiscount = 0;
  let medDom = 0;

  if (m.lokalita && m.typ) {
    // Realized z disappearances
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let q = sb.from("monitor_inzeraty_disappearances")
      .select("estimated_sale_price, last_known_eur_per_m2, total_days_on_market, estimated_discount_pct, monitor_inzeraty!inner(lokalita, typ, izby)")
      .eq("classification", "likely_sold")
      .gte("confidence_score", 0.6)
      .gte("disappeared_on", yearAgo)
      .ilike("monitor_inzeraty.lokalita", `%${lokFilter}%`)
      .ilike("monitor_inzeraty.typ", `%${m.typ}%`);
    if (m.izby != null) q = q.eq("monitor_inzeraty.izby", m.izby);
    const { data: sold } = await q.limit(50);
    type S = { last_known_eur_per_m2: number | null; estimated_discount_pct: number | null; total_days_on_market: number };
    const rows = (sold || []) as unknown as S[];

    const realizedPerM2 = rows.map(s => {
      const a = s.last_known_eur_per_m2 ? Number(s.last_known_eur_per_m2) : null;
      const d = s.estimated_discount_pct != null ? Number(s.estimated_discount_pct) : 0;
      return a && a > 100 && a < 30000 ? a * (1 - d / 100) : 0;
    }).filter(v => v > 100).sort((a, b) => a - b);
    const discounts = rows.map(s => s.estimated_discount_pct != null ? Number(s.estimated_discount_pct) : 0).filter(v => v > 0 && v < 50);
    const doms = rows.map(s => Number(s.total_days_on_market)).filter(v => v >= 0).sort((a, b) => a - b);

    const med = (a: number[]) => a.length ? a[Math.floor(a.length / 2)] : 0;
    if (realizedPerM2.length >= 3) {
      benchPerM2 = Math.round(med(realizedPerM2));
      realizedCount = realizedPerM2.length;
      avgDiscount = discounts.length ? Math.round((discounts.reduce((s, x) => s + x, 0) / discounts.length) * 10) / 10 : 0;
      medDom = doms.length ? Math.round(med(doms)) : 0;
      cmaText = `Median realizačnej ceny: ${benchPerM2} €/m² (z ${realizedCount} predaných za posledný rok). Predajcovia v segmente bežne zľavnili o ${avgDiscount} %. Median DOM: ${medDom} dní.`;
    } else {
      // Fallback asking
      let q2 = sb.from("monitor_inzeraty")
        .select("cena, plocha")
        .eq("is_active", true)
        .ilike("lokalita", `%${lokFilter}%`)
        .ilike("typ", `%${m.typ}%`)
        .gt("cena", 0);
      if (m.izby != null) q2 = q2.eq("izby", m.izby);
      const { data: active } = await q2.limit(50);
      const askingPerM2 = (active || [])
        .map(r => Number(r.cena) / Number(r.plocha))
        .filter(v => Number.isFinite(v) && v > 100 && v < 30000)
        .sort((a, b) => a - b);
      if (askingPerM2.length >= 3) {
        benchPerM2 = Math.round(med(askingPerM2));
        cmaText = `Median ASKING ceny: ${benchPerM2} €/m² (z ${askingPerM2.length} aktívnych ponúk). Pre presnejšie čísla treba viac predaných comparables.`;
      }
    }
  }

  // Spočítaj odchýlku od benchmarku
  const myCena = Number(m.cena) || 0;
  const myPlocha = Number(m.plocha) || 0;
  const myEurM2 = myPlocha > 0 ? Math.round(myCena / myPlocha) : 0;
  const odchPct = benchPerM2 > 0 && myEurM2 > 0 ? Math.round(((myEurM2 - benchPerM2) / benchPerM2) * 100) : null;

  const dom = Math.floor((Date.now() - new Date(m.first_seen_at).getTime()) / (24 * 60 * 60 * 1000));
  const firstCena = m.first_known_cena ? Number(m.first_known_cena) : myCena;
  const dropPct = firstCena > myCena && firstCena > 0 ? Math.round(((firstCena - myCena) / firstCena) * 100 * 10) / 10 : 0;

  // Sumár signálov pre prompt
  const sigList = ((signals || []) as SignalRow[])
    .map(s => `${s.signal_type}(${s.severity}): ${JSON.stringify(s.evidence)}`)
    .join("; ");

  // Sebavedomé fallback brief — bez AI ak ANTHROPIC chýba
  const fallback = (() => {
    const lines: string[] = [];
    lines.push(`📞 Pre-call brief — ${m.nazov || (m.typ || "Inzerát") + " " + (m.lokalita || "")}`);
    lines.push("");
    lines.push(`📊 Základné: ${m.typ || "—"}${m.izby ? `, ${m.izby}-izb.` : ""}${m.plocha ? `, ${m.plocha} m²` : ""}, ${m.lokalita || "—"}, cena ${myCena.toLocaleString("sk")} €${myEurM2 ? ` (${myEurM2} €/m²)` : ""}.`);
    lines.push(`📅 Listed: ${dom} dní (od ${new Date(m.first_seen_at).toLocaleDateString("sk")})${m.listed_on_n_portals > 1 ? `, na ${m.listed_on_n_portals} portáloch` : ""}.`);
    if (dropPct > 0) lines.push(`📉 Cena znížená o ${dropPct} % od pôvodnej (${firstCena.toLocaleString("sk")} → ${myCena.toLocaleString("sk")} €).`);
    lines.push(`🏷 Predajca: ${m.predajca_typ === "sukromny" ? "súkromník" : m.predajca_typ === "firma" ? "RK / firma" : "neznámy typ"}.`);
    lines.push(`🔥 Motivation score: ${m.motivation_score}/100${(signals || []).length > 0 ? ` (${(signals || []).map(s => s.signal_type).join(", ")})` : ""}.`);
    lines.push("");
    lines.push("📊 Trh:");
    lines.push(`   ${cmaText}`);
    if (odchPct !== null) {
      lines.push(`   Inzerát ${odchPct > 0 ? "+" : ""}${odchPct} % oproti trhu.`);
    }
    lines.push("");
    lines.push("💡 Talking points (čo povedať predajcovi):");
    if (dropPct >= 5) lines.push(`   • "Vidím že ste cenu znížili o ${dropPct} %. Vidíte záujem o byt?"`);
    if (dom >= 90) lines.push(`   • "Inzerát je na trhu už ${dom} dní — premýšľali ste o spolupráci s realitkou?"`);
    if ((m.listed_on_n_portals || 1) >= 3) lines.push(`   • "Vidím že máte byt na ${m.listed_on_n_portals} portáloch. Funguje to?"`);
    if (odchPct !== null && odchPct > 10) lines.push(`   • "Cena ${myEurM2} €/m² je o ${odchPct} % nad trhovým mediánom ${benchPerM2} €/m². Skúšali ste znížiť?"`);
    if (avgDiscount > 0) lines.push(`   • "V tejto lokalite predajcovia bežne zľavnia o ${avgDiscount} % — to je flex priestor na vyjednávanie."`);
    if (lines.length === 0 || (signals || []).length === 0) lines.push(`   • Krátky úvod, predstaviť sa, ponúknuť spoluprácu pri predaji.`);
    return lines.join("\n");
  })();

  // Pokus AI prompt — krajší / personifikovanejší brief
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ brief: fallback, ai_used: false, source_url: m.url });
  }

  const systemPrompt = `Si senior realitný analytik. Tvoja úloha: vytvoriť krátky brief (~150-200 slov, čisto vecný, slovenčina) ktorý maklér prečíta pred zavolaním motivovanému predajcovi z online inzerátu. Vráť IBA text briefu, žiadny markdown header, žiadny preamble.

Štruktúra:
1) 1 veta čo to je za nehnuteľnosť (typ, izby, m², lokalita, cena)
2) 2-3 vety o motivácii predajcu (signály, DOM, zľavy, počet portálov)
3) 2 vety trhový kontext s konkrétnymi číslami
4) 3-4 talking points — čo povedať predajcovi (priame citácie v úvodzovkách)

NIE klišé. NIE "exkluzívna príležitosť". Vecne.`;

  const userPrompt = `Inzerát:
- Názov: ${m.nazov || "—"}
- Typ: ${m.typ}, ${m.izby ? `${m.izby} izieb, ` : ""}${m.plocha ? `${m.plocha} m², ` : ""}${m.lokalita}
- Cena: ${myCena.toLocaleString("sk")} € (${myEurM2} €/m²)
- Pôvodná cena: ${firstCena.toLocaleString("sk")} € ${dropPct > 0 ? `(zľava ${dropPct} %)` : "(bez zmeny)"}
- DOM: ${dom} dní (od ${new Date(m.first_seen_at).toLocaleDateString("sk")})
- Listed na portáloch: ${m.listed_on_n_portals}
- Predajca typ: ${m.predajca_typ === "sukromny" ? "súkromník" : m.predajca_typ === "firma" ? "RK" : "neznámy"}
- Motivation score: ${m.motivation_score}/100
- Aktívne signály: ${sigList || "žiadne"}

Trh:
${cmaText}
${odchPct !== null ? `Inzerát ${odchPct > 0 ? "+" : ""}${odchPct} % oproti trhu.` : ""}

Popis (pre kontext, nezahŕňaj doslovne): ${(m.popis || "").slice(0, 500)}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!r.ok) {
      console.error("[pre-call-brief] Anthropic HTTP", r.status);
      return NextResponse.json({ brief: fallback, ai_used: false, source_url: m.url });
    }
    const data = await r.json();
    const text = data?.content?.[0]?.text?.trim() || fallback;
    return NextResponse.json({ brief: text, ai_used: true, source_url: m.url });
  } catch (e) {
    console.error("[pre-call-brief] error:", e);
    return NextResponse.json({ brief: fallback, ai_used: false, source_url: m.url });
  }
}
