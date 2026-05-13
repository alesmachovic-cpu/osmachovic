import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

type IcoData = {
  nazov: string;
  adresa: string;
  ico: string;
  dic: string;
  ic_dph: string;
};

// Scrape verejnej stránky finstat.sk/{ico} — bez API kľúča
async function lookupFinstat(ico: string): Promise<IcoData | null> {
  const res = await fetch(`https://finstat.sk/${encodeURIComponent(ico)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept-Language": "sk-SK,sk;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const html = await res.text();

  // IČO
  const icoM = html.match(/<strong>I[ČC]O<\/strong>\s*<span>([0-9\s]+)<\/span>/);
  if (!icoM) return null; // stránka neexistuje / nenájdené

  // DIČ
  const dicM = html.match(/<strong>DI[ČC]<\/strong>\s*<span>([0-9]+)<\/span>/);
  // IČ DPH
  const icdphM = html.match(/<strong>I[ČC]\s*DPH<\/strong>\s*<span>(SK[0-9]+)/);
  // Sídlo obsahuje meno firmy + adresu oddelené <br/>
  const sidloM = html.match(/<strong>Sídlo<\/strong>\s*<span>([^<]+)<br\/?>\s*([^<]+)<\/span>/);

  return {
    ico: icoM[1].replace(/\s/g, ""),
    dic: dicM?.[1] ?? "",
    ic_dph: icdphM?.[1] ?? "",
    nazov: sidloM?.[1].trim() ?? "",
    adresa: sidloM?.[2].trim() ?? "",
  };
}

export async function GET(req: NextRequest) {
  const ico = req.nextUrl.searchParams.get("ico")?.replace(/\s/g, "");
  if (!ico || !/^\d{6,10}$/.test(ico)) {
    return NextResponse.json({ error: "Neplatné IČO" }, { status: 400 });
  }

  try {
    const data = await lookupFinstat(ico);
    if (data) return NextResponse.json(data);
    return NextResponse.json({ error: "Subjekt nebol nájdený na Finstat" }, { status: 404 });
  } catch (e) {
    console.error("[ico-lookup]", e);
    return NextResponse.json({ error: "Chyba pri vyhľadávaní" }, { status: 500 });
  }
}
