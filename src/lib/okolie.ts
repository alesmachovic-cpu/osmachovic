/**
 * Okolie analysis — Gemini call ktorý zhodnotí okolie nehnuteľnosti
 * (typically z Google Maps Knowledge) a vráti štruktúrované plusy/mínusy.
 *
 * Používa sa v /api/analyze-url (URL analyzer) a /api/okolie-analysis
 * (samostatný endpoint pre re-fetch z UI).
 */

export interface OkolieAnalysis {
  plusy: string[];           // 3-6 konkrétnych pozitív okolia
  minusy: string[];          // 3-6 konkrétnych negatív okolia
  doprava: string;           // krátky text o doprave (MHD, dialnice)
  obcianska_vybavenost: string; // školy, obchody, zdravotníctvo
  charakter: string;         // rušná/tichá ulica, zeleň, hluk
  shrnutie: string;          // 2-3 vety celkové zhodnotenie
  skore: number;             // 1-10 atraktivita lokality
  zdroj: "gemini" | "fallback";
}

const FALLBACK: OkolieAnalysis = {
  plusy: [],
  minusy: [],
  doprava: "",
  obcianska_vybavenost: "",
  charakter: "",
  shrnutie: "Nedostatočné dáta pre analýzu okolia.",
  skore: 0,
  zdroj: "fallback",
};

/**
 * Zavolaj Gemini s konkrétnou adresou. Vráti JSON s plusmi a mínusmi.
 * Gemini má prístup ku Google Maps a vie analyzovať okolie reálne.
 */
export async function analyzeOkolie(args: {
  lokalita: string;
  ulica?: string | null;
  cislo?: string | null;
  typ?: string | null; // byt / dom / pozemok — kontextualizuje analýzu
}): Promise<OkolieAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK;
  const fullAddr = [args.ulica, args.cislo, args.lokalita].filter(Boolean).join(" ").trim();
  if (!fullAddr || fullAddr.split(/\s+/).length < 2) return FALLBACK;

  const prompt = `Si realitný analytik. Analyzuj okolie konkrétnej nehnuteľnosti${args.typ ? ` (typ: ${args.typ})` : ""}:
ADRESA: "${fullAddr}"

Použi svoje znalosti o tejto lokalite (Google Maps, charakter okolia, doprava, občianska vybavenosť, hluk, zeleň, kriminalita).

Vráť STRIKTNE JSON v tomto formáte (nič iné, žiadny markdown wrapper):
{
  "plusy": ["3-6 konkrétnych pozitív okolia (s názvami obchodov/škôl/parkov ak existujú)"],
  "minusy": ["3-6 konkrétnych negatív okolia (hluk, doprava, vzdialenosť do centra atď.)"],
  "doprava": "1 veta o doprave — najbližšia MHD zastávka názov, vzdialenosť do centra, dostupnosť dialnice",
  "obcianska_vybavenost": "1 veta o školách, obchodoch, zdravotníctve v okolí (s názvami)",
  "charakter": "1 veta — rušná/tichá ulica, zeleň, parky, hluk, sociálne prostredie",
  "shrnutie": "2-3 vety — pre koho je táto lokalita ideálna a pre koho nevhodná",
  "skore": 7
}

Skóre = 1-10 podľa atraktivity lokality. Buď konkrétny, NIE všeobecný. Slovenčina.`;

  try {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
      },
    });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (res.status === 503) {
      // Krátky retry po nasýtení modelu
      await new Promise(r => setTimeout(r, 2000));
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    }
    if (!res.ok) {
      console.warn("[okolie] gemini HTTP", res.status);
      return FALLBACK;
    }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!raw) return FALLBACK;
    // Gemini občas vráti JSON v ```json wrapper — odstráň
    const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      plusy: Array.isArray(parsed.plusy) ? parsed.plusy.slice(0, 6).map(String) : [],
      minusy: Array.isArray(parsed.minusy) ? parsed.minusy.slice(0, 6).map(String) : [],
      doprava: String(parsed.doprava || ""),
      obcianska_vybavenost: String(parsed.obcianska_vybavenost || ""),
      charakter: String(parsed.charakter || ""),
      shrnutie: String(parsed.shrnutie || ""),
      skore: Math.max(0, Math.min(10, Number(parsed.skore) || 0)),
      zdroj: "gemini",
    };
  } catch (e) {
    console.warn("[okolie] analyze error:", (e as Error).message);
    return FALLBACK;
  }
}
