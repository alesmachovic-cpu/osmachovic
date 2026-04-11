import { NextRequest, NextResponse } from "next/server";

/* ── Trhové benchmarky (€/m²) ── */
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
  if (!lokalita) return 3000;
  const lower = lokalita.toLowerCase();
  for (const [key, val] of Object.entries(BENCHMARKS)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 2500; // SK priemer
}

/* ── Gemini API s multi-key rotáciou ── */
const GEMINI_KEYS = (process.env.GEMINI_API_KEY || "").split(",").map(k => k.trim()).filter(Boolean);
let currentKeyIdx = 0;

async function callGemini(system: string, prompt: string): Promise<string | null> {
  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = GEMINI_KEYS[(currentKeyIdx + attempt) % GEMINI_KEYS.length];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
          }),
        }
      );
      if (res.status === 429 || res.status === 400) {
        console.log(`[analyze] Key ${attempt + 1} rate limited, rotating...`);
        currentKeyIdx = (currentKeyIdx + attempt + 1) % GEMINI_KEYS.length;
        continue;
      }
      if (!res.ok) { console.error("[analyze] Gemini HTTP", res.status); return null; }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch (e) {
      console.error("[analyze] Gemini error:", e);
    }
  }
  return null;
}

/* ── GPT fallback ── */
async function callGPT(system: string, prompt: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", temperature: 0.3, max_tokens: 3000,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

async function callAI(system: string, prompt: string): Promise<string | null> {
  return await callGemini(system, prompt) || await callGPT(system, prompt);
}

function extractJSON(raw: string): unknown {
  const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/* ══════ BATCH ANALYSIS ══════ */
async function batchAnalysis(items: Array<Record<string, unknown>>) {
  const listings = items.map((n, i) => {
    const cena = Number(n.cena) || 0;
    const plocha = Number(n.plocha) || 0;
    const eurM2 = plocha > 0 ? Math.round(cena / plocha) : 0;
    const benchmark = getBenchmark(String(n.lokalita || ""));
    return {
      idx: i, id: n.id,
      nazov: n.nazov || `${n.typ_nehnutelnosti} — ${n.lokalita}`,
      lokalita: n.lokalita, cena, plocha, eurM2, benchmark,
    };
  });

  const system = `Si analytik realitného trhu na Slovensku. Vráť IBA JSON pole bez markdown.`;
  const prompt = `Analyzuj tieto nehnuteľnosti voči trhovým benchmarkom. Pre KAŽDÚ vráť stav:
- "podhodnotene" ak €/m² je výrazne pod benchmarkom (>10% pod)
- "trhova_cena" ak je v rozmedzí ±10%
- "nadhodnotene" ak je výrazne nad benchmarkom (>10% nad)

Ak nemá cenu alebo plochu, daj "chyba_dat".

Nehnuteľnosti:
${listings.map(l => `#${l.idx}: "${l.nazov}" | ${l.lokalita} | ${l.cena}€ | ${l.plocha}m² | ${l.eurM2}€/m² | benchmark: ${l.benchmark}€/m²`).join("\n")}

Vráť JSON pole: [{"idx":0,"stav":"trhova_cena","eurM2":3200,"benchmark":3300,"odchylka":-3,"komentar":"krátky komentár"}]`;

  const raw = await callAI(system, prompt);
  if (!raw) {
    // Fallback — lokálny výpočet bez AI
    return listings.map(l => {
      if (!l.cena || !l.plocha) return { idx: l.idx, id: l.id, stav: "chyba_dat", eurM2: 0, benchmark: l.benchmark, odchylka: 0, komentar: "Chýba cena alebo plocha" };
      const odchylka = Math.round(((l.eurM2 - l.benchmark) / l.benchmark) * 100);
      let stav = "trhova_cena";
      if (odchylka < -10) stav = "podhodnotene";
      if (odchylka > 10) stav = "nadhodnotene";
      return { idx: l.idx, id: l.id, stav, eurM2: l.eurM2, benchmark: l.benchmark, odchylka, komentar: `${odchylka > 0 ? "+" : ""}${odchylka}% voči priemeru ${l.lokalita}` };
    });
  }

  const parsed = extractJSON(raw);
  if (Array.isArray(parsed)) return parsed.map((p: Record<string, unknown>, i: number) => ({ ...p, id: listings[i]?.id }));
  // Fallback
  return listings.map(l => {
    const odchylka = l.benchmark > 0 ? Math.round(((l.eurM2 - l.benchmark) / l.benchmark) * 100) : 0;
    let stav = "trhova_cena";
    if (odchylka < -10) stav = "podhodnotene";
    if (odchylka > 10) stav = "nadhodnotene";
    return { idx: l.idx, id: l.id, stav, eurM2: l.eurM2, benchmark: l.benchmark, odchylka, komentar: `${odchylka > 0 ? "+" : ""}${odchylka}%` };
  });
}

/* ══════ DEEP DIVE ANALYSIS ══════ */
async function deepDive(item: Record<string, unknown>) {
  const cena = Number(item.cena) || 0;
  const plocha = Number(item.plocha) || 0;
  const eurM2 = plocha > 0 ? Math.round(cena / plocha) : 0;
  const benchmark = getBenchmark(String(item.lokalita || ""));
  const odchylka = benchmark > 0 ? Math.round(((eurM2 - benchmark) / benchmark) * 100) : 0;

  // Hypotekárny model: 80% LTV, 3.2%, 30 rokov
  const ltv = 0.80;
  const urok = 0.032;
  const roky = 30;
  const istina = cena * ltv;
  const mesacnyUrok = urok / 12;
  const pocetSplatok = roky * 12;
  const mesacnaSplatka = istina > 0
    ? Math.round(istina * (mesacnyUrok * Math.pow(1 + mesacnyUrok, pocetSplatok)) / (Math.pow(1 + mesacnyUrok, pocetSplatok) - 1))
    : 0;
  const celkovaNakup = Math.round(istina + (mesacnaSplatka * pocetSplatok - istina));
  const hotovost = Math.round(cena * 0.20 + cena * 0.035); // 20% + poplatky ~3.5%
  const potrebnyPrijem = Math.round(mesacnaSplatka / 0.40); // max 40% príjmu

  // AI komentár
  const system = `Si senior realitný analytik. Odpovedaj po slovensky, stručne a vecne. Vráť IBA JSON bez markdown.`;
  const prompt = `Analyzuj túto nehnuteľnosť:
Názov: ${item.nazov || item.typ_nehnutelnosti}
Lokalita: ${item.lokalita}
Cena: ${cena}€ | Plocha: ${plocha}m² | €/m²: ${eurM2}
Benchmark: ${benchmark}€/m² | Odchýlka: ${odchylka}%
Typ: ${item.typ_nehnutelnosti} | Stav: ${item.stav}
Balkón: ${item.balkon} | Garáž: ${item.garaz} | Výťah: ${item.vytah}

Vráť JSON:
{
  "verdikt": "podhodnotene/trhova_cena/nadhodnotene",
  "silne_stranky": ["max 3 body"],
  "slabe_stranky": ["max 3 body"],
  "odporucanie": "1-2 vety čo robiť",
  "cielova_skupina": "kto je ideálny kupujúci",
  "cas_predaja": "odhad v týždňoch"
}`;

  const raw = await callAI(system, prompt);
  const aiAnalysis = raw ? extractJSON(raw) : null;

  return {
    zaklad: {
      cena, plocha, eurM2, benchmark, odchylka,
      stav: odchylka < -10 ? "podhodnotene" : odchylka > 10 ? "nadhodnotene" : "trhova_cena",
    },
    hypoteka: {
      istina, mesacnaSplatka, celkovaNakup,
      hotovost, potrebnyPrijem,
      ltv: `${ltv * 100}%`, urok: `${urok * 100}%`, roky,
    },
    ai: aiAnalysis || {
      verdikt: odchylka < -10 ? "podhodnotene" : odchylka > 10 ? "nadhodnotene" : "trhova_cena",
      silne_stranky: [], slabe_stranky: [],
      odporucanie: "Nedostatok dát pre AI analýzu",
      cielova_skupina: "—", cas_predaja: "—",
    },
  };
}

/* ══════ MAIN ══════ */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, items, item } = body;

  if (action === "batch" && Array.isArray(items)) {
    console.log(`[analyze] Batch analysis for ${items.length} items`);
    const results = await batchAnalysis(items);
    return NextResponse.json({ results });
  }

  if (action === "deep" && item) {
    console.log(`[analyze] Deep dive for: ${item.nazov || item.id}`);
    const result = await deepDive(item);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Neplatná akcia" }, { status: 400 });
}
