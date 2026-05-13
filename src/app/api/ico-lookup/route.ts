import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const maxDuration = 15;

type IcoData = {
  nazov: string;
  adresa: string;
  ico: string;
  dic: string;
  ic_dph: string;
};

// ORSR HTML scraping — free, no API key needed
// Returns nazov + adresa. DIČ/IČ DPH nie sú v ORSR.
async function lookupOrsr(ico: string): Promise<Partial<IcoData> | null> {
  const searchUrl = `https://www.orsr.sk/hladaj_ico.asp?ICO=${encodeURIComponent(ico)}&SID=0`;
  const searchRes = await fetch(searchUrl, {
    headers: { "Accept-Charset": "windows-1250" },
    signal: AbortSignal.timeout(8000),
  });
  if (!searchRes.ok) return null;

  const buf = await searchRes.arrayBuffer();
  const html = new TextDecoder("windows-1250").decode(buf);

  // Nájdi odkaz na detail subjektu
  const linkMatch = html.match(/href="(vypis\.asp\?[^"]+)"/);
  if (!linkMatch) return null;

  const detailUrl = `https://www.orsr.sk/${linkMatch[1]}`;
  const detailRes = await fetch(detailUrl, {
    signal: AbortSignal.timeout(8000),
  });
  if (!detailRes.ok) return null;

  const detailBuf = await detailRes.arrayBuffer();
  const detail = new TextDecoder("windows-1250").decode(detailBuf);

  // Parsuj "Obchodné meno: XYZ (od: dd.mm.rrrr)"
  const nazovMatch = detail.match(/Obchodné meno:&nbsp;\s*([^&<(]+)/);
  // Parsuj "Sídlo: Ulica Mesto PSC (od: ...)"
  const sidloMatch = detail.match(/Sídlo:&nbsp;\s*([^&<(]+)/);

  if (!nazovMatch) return null;

  const nazov = nazovMatch[1].trim().replace(/\s+/g, " ");
  const adresa = sidloMatch ? sidloMatch[1].trim().replace(/\s+/g, " ") : "";

  return { nazov, adresa, ico };
}

// Finstat API — vyžaduje FINSTAT_API_KEY v env
// Vracia aj DIČ + IČ DPH navyše k základným údajom
async function lookupFinstat(ico: string): Promise<Partial<IcoData> | null> {
  const apiKey = process.env.FINSTAT_API_KEY;
  if (!apiKey) return null;

  // Hash = MD5(apiKey + "FinstatApiHash2015" + ico)
  const hash = crypto
    .createHash("md5")
    .update(apiKey + "FinstatApiHash2015" + ico)
    .digest("hex");

  const url = `https://finstat.sk/api/company/${encodeURIComponent(ico)}?apiKey=${encodeURIComponent(apiKey)}&Hash=${hash}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const d = await res.json();
  if (!d?.Name) return null;

  const street = [d.Street, d.StreetNumber].filter(Boolean).join(" ");
  const adresa = [street, d.ZipCode, d.City].filter(Boolean).join(", ");

  return {
    nazov: d.Name,
    adresa,
    ico: d.Ico ?? ico,
    dic: d.Dic ?? "",
    ic_dph: d.IcDph ?? "",
  };
}

export async function GET(req: NextRequest) {
  const ico = req.nextUrl.searchParams.get("ico")?.replace(/\s/g, "");
  if (!ico || !/^\d{6,10}$/.test(ico)) {
    return NextResponse.json({ error: "Neplatné IČO" }, { status: 400 });
  }

  try {
    // Finstat má prioritu (vráti aj DIČ/IČ DPH)
    const finstat = await lookupFinstat(ico);
    if (finstat) return NextResponse.json(finstat);

    // Fallback: ORSR (meno + adresa)
    const orsr = await lookupOrsr(ico);
    if (orsr) return NextResponse.json(orsr);

    return NextResponse.json({ error: "Subjekt nebol nájdený" }, { status: 404 });
  } catch (e) {
    console.error("[ico-lookup]", e);
    return NextResponse.json({ error: "Chyba pri vyhľadávaní" }, { status: 500 });
  }
}
