import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BENCHMARKS: Record<string, number> = {
  "Bratislava I": 4200, "Bratislava II": 3400, "Bratislava III": 3200,
  "Bratislava IV": 3100, "Bratislava V": 2800,
  "Bratislava": 3300, "Bratislava-Staré Mesto": 4200,
  "Bratislava-Ružinov": 3400, "Bratislava-Nové Mesto": 3200,
  "Bratislava-Karlova Ves": 3100, "Bratislava-Petržalka": 2800,
  "Bratislava-Dúbravka": 2900, "Bratislava-Rača": 2700,
  "Bratislava-Vrakuňa": 2600, "Bratislava-Podunajské Biskupice": 2500,
  "Trnava": 2400, "Nitra": 2100, "Trenčín": 1900,
  "Žilina": 2200, "Banská Bystrica": 1800,
  "Prešov": 1700, "Košice": 2000,
  "Stupava": 2600, "Senec": 2700, "Pezinok": 2500, "Malacky": 2100,
  "Piešťany": 2200, "Poprad": 2000, "Martin": 1800,
};

function getBenchmark(lokalita: string): number {
  const lower = lokalita.toLowerCase();
  for (const [key, val] of Object.entries(BENCHMARKS)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 2500;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (s.length - 1));
  return s[idx];
}

const GEMINI_KEYS = (process.env.GEMINI_API_KEY || "").split(",").map(k => k.trim()).filter(Boolean);
let keyIdx = 0;

async function callGemini(prompt: string): Promise<string | null> {
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const key = GEMINI_KEYS[(keyIdx + i) % GEMINI_KEYS.length];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
          }),
        }
      );
      if (res.status === 429 || res.status === 400) { keyIdx = (keyIdx + i + 1) % GEMINI_KEYS.length; continue; }
      if (!res.ok) return null;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch { continue; }
  }
  return null;
}

async function callGPT(prompt: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", temperature: 0.3, max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const { typ, plocha, obec, okres, predajnaCena } = await req.json() as {
    typ: string; plocha: number; obec: string; okres: string; predajnaCena?: number;
  };

  if (!obec || !plocha) {
    return NextResponse.json({ error: "Chýba obec alebo plocha" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const [monitorResult, naseDResult] = await Promise.all([
    supabase
      .from("monitor_inzeraty")
      .select("cena, plocha")
      .ilike("lokalita", `%${obec}%`)
      .eq("typ_nehnutelnosti", typ)
      .not("cena", "is", null)
      .not("plocha", "is", null)
      .limit(50),
    supabase
      .from("naberove_listy")
      .select("predajna_cena, plocha")
      .ilike("obec", `%${obec}%`)
      .eq("typ_nehnutelnosti", typ)
      .not("predajna_cena", "is", null)
      .limit(20),
  ]);

  const monitorItems = (monitorResult.data ?? []).map((r: { cena: number; plocha: number }) => ({ cena: r.cena, plocha: r.plocha }));
  const naseItems = (naseDResult.data ?? []).map((r: { predajna_cena: number; plocha: number }) => ({ cena: r.predajna_cena, plocha: r.plocha }));
  const allItems = [...monitorItems, ...naseItems];

  const cenyM2 = allItems
    .filter(n => n.plocha > 0)
    .map(n => n.cena / n.plocha)
    .filter(x => x > 500 && x < 15000);

  const zdroj: "monitor" | "benchmark" = cenyM2.length >= 3 ? "monitor" : "benchmark";

  let priemer: number;
  if (zdroj === "benchmark") {
    priemer = getBenchmark(`${obec} ${okres}`);
  } else {
    priemer = median(cenyM2);
  }

  const odporucana_od = Math.round(priemer * plocha * 0.95);
  const odporucana_do = Math.round(priemer * plocha * 1.05);

  let hodnotenie: "V rozsahu" | "Mierne vysoká" | "Vysoká" | "Mierne nízka" | "Nízka" = "V rozsahu";
  let odchylka_pct = 0;

  if (predajnaCena && predajnaCena > 0 && priemer > 0) {
    const eurM2Klient = predajnaCena / plocha;
    odchylka_pct = Math.round(((eurM2Klient - priemer) / priemer) * 100);
    if (odchylka_pct > 15) hodnotenie = "Vysoká";
    else if (odchylka_pct > 5) hodnotenie = "Mierne vysoká";
    else if (odchylka_pct < -15) hodnotenie = "Nízka";
    else if (odchylka_pct < -5) hodnotenie = "Mierne nízka";
    else hodnotenie = "V rozsahu";
  }

  const typLabel = typ === "byt" ? "byt" : typ === "rodinny_dom" ? "rodinný dom" : "pozemok";
  const aiPrompt = `Si realitný analytik na Slovensku. Napíš 1-2 vety o trhu s ${typLabel}mi v ${obec}${okres ? ` (${okres})` : ""}. Priemer €/m²: ${priemer}. ${predajnaCena ? `Klientova cena: ${predajnaCena}€ (${odchylka_pct > 0 ? "+" : ""}${odchylka_pct}% voči priemeru).` : ""} Buď konkrétny a faktický, bez klišé.`;

  const komentar = await callGemini(aiPrompt) || await callGPT(aiPrompt) || "";

  return NextResponse.json({
    priemerna_cena_m2: priemer,
    odporucana_od,
    odporucana_do,
    hodnotenie,
    odchylka_pct,
    pocet_porovnani: cenyM2.length,
    zdroj,
    komentar,
  });
}
