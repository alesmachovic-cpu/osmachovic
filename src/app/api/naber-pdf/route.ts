import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TYP_LABELS: Record<string, string> = {
  byt: "Byt", rodinny_dom: "Rodinny dom", pozemok: "Pozemok",
};
const STAV_LABELS: Record<string, string> = {
  velmi_dobry: "Velmi dobry", dobry: "Dobry", zly: "Zly",
  kompletna_rekonstrukcia: "Kompletna rekonstrukcia", novostavba: "Novostavba",
  schatralý: "Schatralny", invest_zamer: "Investicny zamer", projekt: "Projekt", vystavba: "Vystavba",
};
const VLASTNICTVO_LABELS: Record<string, string> = {
  osobne: "Osobne vlastnictvo", druzstevne: "Druzstevne vlastnictvo",
};
const ZMLUVA_LABELS: Record<string, string> = {
  exkluzivna: "Exkluzivna", neexkluzivna: "Neexkluzivna",
};
const INZERCIA_LABELS: Record<string, string> = {
  inkognito: "Inkognito (len databaza)", online_web: "Online — nas web",
  online: "Online (web + portaly)", vyhradne: "Vyhradne (exkluzivna inzercia)",
};
const TARCHA_LABELS: Record<string, string> = {
  z_kupnej: "Vyplatenie z kupnej ceny",
  prenos: "Prenos na inu nehnutelnost",
  pred_podpisom: "Vyplatenie pred podpisom KZ",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatCena(v: number): string {
  return v.toLocaleString("sk") + " EUR";
}

type CompanyInfo = { nazov?: string; sidlo?: string; ico?: string; registracia?: string };
type Section = { title: string; icon: string; rows: [string, string][] };

async function loadCompanyInfo(): Promise<CompanyInfo> {
  try {
    const { data } = await supabase.from("makleri").select("firma").eq("email", "ales@vianema.sk").single();
    if (data?.firma) {
      const c = typeof data.firma === "string" ? JSON.parse(data.firma) : data.firma;
      return c as CompanyInfo;
    }
  } catch { /* ignore */ }
  return { nazov: "Vianema s. r. o." };
}

function generatePdfBytes(naber: Record<string, unknown>, klient: Record<string, unknown>, company: CompanyInfo): Buffer {
  const klientMeno = (klient?.meno as string) || "Klient";
  const klientTelefon = klient?.telefon as string;
  const klientEmail = klient?.email as string;
  const params = naber.parametre as Record<string, unknown> | null;
  const vybavenie = naber.vybavenie as Record<string, unknown> | null;
  const oznacenie = naber.oznacenie as Record<string, unknown> | null;
  const lv = klient?.lv_data as Record<string, unknown> | null;

  const sections: Section[] = [];

  // 0. SPROSTREDKOVATEL
  const sRows: [string, string][] = [];
  sRows.push(["Sprostredkovatel", company.nazov || "Vianema s. r. o."]);
  if (company.sidlo) sRows.push(["Sidlo", company.sidlo]);
  if (company.ico) sRows.push(["ICO", company.ico]);
  const maklerName = (naber.makler as string) || "";
  sRows.push(["Zastupena", maklerName || "..........................................."]);
  if (company.registracia) sRows.push(["", company.registracia]);
  sRows.push(["", "(dalej ako \"Sprostredkovatel\")"]);
  sections.push({ title: "SPROSTREDKOVATEL", icon: "S", rows: sRows });

  // 1. KLIENT
  const klientRows: [string, string][] = [];
  klientRows.push(["Meno", klientMeno]);
  if (klientTelefon) klientRows.push(["Telefon", klientTelefon]);
  if (klientEmail) klientRows.push(["Email", klientEmail]);
  sections.push({ title: "KLIENT", icon: "1", rows: klientRows });

  // 2. VLASTNIK / MAJITEL
  const vlastnikRows: [string, string][] = [];
  if (naber.majitel) vlastnikRows.push(["Majitel", String(naber.majitel)]);
  if (naber.kontakt_majitel) vlastnikRows.push(["Kontakt majitela", String(naber.kontakt_majitel)]);
  if (naber.konatel) vlastnikRows.push(["Konatel", String(naber.konatel)]);
  if (naber.jednatel) vlastnikRows.push(["Jednatel", String(naber.jednatel)]);
  if (naber.uzivatel) vlastnikRows.push(["Uzivatel", String(naber.uzivatel)]);
  if (naber.kontakt_uzivatel) vlastnikRows.push(["Kontakt uzivatela", String(naber.kontakt_uzivatel)]);
  // LV majitelia
  const majitelia = lv?.majitelia as Array<{ meno?: string; podiel?: string; datum_narodenia?: string }> | undefined;
  if (majitelia?.length) {
    majitelia.forEach((m, i) => {
      if (m.meno) {
        let val = m.meno;
        if (m.podiel) val += ` — podiel ${m.podiel}`;
        if (m.datum_narodenia) val += `, nar. ${m.datum_narodenia}`;
        vlastnikRows.push([`Vlastnik ${i + 1} (LV)`, val]);
      }
    });
  }
  if (vlastnikRows.length > 0) sections.push({ title: "VLASTNIK", icon: "2", rows: vlastnikRows });

  // 3. LOKALITA
  const lokalitaRows: [string, string][] = [];
  if (naber.kraj) lokalitaRows.push(["Kraj", String(naber.kraj)]);
  if (naber.okres) lokalitaRows.push(["Okres", String(naber.okres)]);
  if (naber.obec) lokalitaRows.push(["Obec", String(naber.obec)]);
  if (naber.cast_obce) lokalitaRows.push(["Cast obce", String(naber.cast_obce)]);
  if (naber.kat_uzemie) lokalitaRows.push(["Katastralne uzemie", String(naber.kat_uzemie)]);
  if (naber.ulica) lokalitaRows.push(["Ulica", String(naber.ulica)]);
  if (naber.cislo_orientacne) lokalitaRows.push(["Cislo orientacne", String(naber.cislo_orientacne)]);
  if (naber.supisne_cislo) lokalitaRows.push(["Supisne cislo", String(naber.supisne_cislo)]);
  if (lokalitaRows.length > 0) sections.push({ title: "LOKALITA", icon: "3", rows: lokalitaRows });

  // 4. NEHNUTELNOST
  const nehnutRows: [string, string][] = [];
  nehnutRows.push(["Typ", TYP_LABELS[naber.typ_nehnutelnosti as string] || String(naber.typ_nehnutelnosti || "")]);
  if (naber.plocha) nehnutRows.push(["Plocha", naber.plocha + " m2"]);
  if (naber.stav) nehnutRows.push(["Stav", STAV_LABELS[naber.stav as string] || String(naber.stav)]);
  if (params?.pocet_izieb) nehnutRows.push(["Pocet izieb", String(params.pocet_izieb)]);
  if (params?.byt_cislo) nehnutRows.push(["Cislo bytu", String(params.byt_cislo)]);
  if (params?.poschodie != null) {
    let posch = String(params.poschodie);
    if (params.z_kolko) posch += " / " + params.z_kolko;
    nehnutRows.push(["Poschodie", posch]);
  }
  if (params?.vlastnictvo) nehnutRows.push(["Vlastnictvo", VLASTNICTVO_LABELS[params.vlastnictvo as string] || String(params.vlastnictvo)]);
  if (params?.druzstvo) nehnutRows.push(["Druzstvo", String(params.druzstvo)]);
  if (params?.typ_domu) nehnutRows.push(["Typ domu", String(params.typ_domu)]);
  if (params?.rok_vystavby) nehnutRows.push(["Rok vystavby", String(params.rok_vystavby)]);
  if (params?.kurenie) nehnutRows.push(["Kurenie", String(params.kurenie)]);
  if (params?.typ_podlahy) nehnutRows.push(["Typ podlahy", String(params.typ_podlahy)]);
  if (params?.mesacne_poplatky) nehnutRows.push(["Mesacne poplatky", params.mesacne_poplatky + " EUR"]);
  if (params?.anuita) nehnutRows.push(["Anuita / hypoteka", String(params.anuita)]);
  if (params?.vyhlad) nehnutRows.push(["Vyhlad", String(params.vyhlad)]);
  // Rodinny dom extras
  if (params?.pocet_podlazi) nehnutRows.push(["Pocet podlazi", String(params.pocet_podlazi)]);
  if (params?.pozemok_plocha) nehnutRows.push(["Plocha pozemku", params.pozemok_plocha + " m2"]);
  if (params?.zahrada) nehnutRows.push(["Zahrada", "Ano"]);
  // Pozemok extras
  if (params?.druh_pozemku) nehnutRows.push(["Druh pozemku", String(params.druh_pozemku)]);
  if (params?.pristupova_cesta) nehnutRows.push(["Pristupova cesta", String(params.pristupova_cesta)]);
  if (params?.siete) nehnutRows.push(["Inzinierske siete", String(params.siete)]);
  if (params?.ucelove_urcenie) nehnutRows.push(["Ucelove urcenie", String(params.ucelove_urcenie)]);
  sections.push({ title: "NEHNUTELNOST", icon: "4", rows: nehnutRows });

  // 5. OZNACENIE NEHNUTELNOSTI
  if (oznacenie) {
    const ozRows: [string, string][] = [];
    if (oznacenie.list_vlastnictva) ozRows.push(["List vlastnictva", String(oznacenie.list_vlastnictva)]);
    if (oznacenie.cislo_parcely) ozRows.push(["Parcela", String(oznacenie.cislo_parcely)]);
    if (oznacenie.katastralne_uzemie) ozRows.push(["Kat. uzemie", String(oznacenie.katastralne_uzemie)]);
    if (ozRows.length > 0) sections.push({ title: "OZNACENIE NEHNUTELNOSTI", icon: "5", rows: ozRows });
  }

  // 6. VYBAVENIE
  if (vybavenie) {
    const vybRows: [string, string][] = [];
    const items = Object.entries(vybavenie).filter(([k, v]) => v && k !== "zariadeny");
    if (items.length > 0) vybRows.push(["Vybavenie", items.map(([k]) => k).join(", ")]);
    if (vybavenie.zariadeny) vybRows.push(["Zariadeny", String(vybavenie.zariadeny)]);
    if (naber.poznamky_vybavenie) vybRows.push(["Poznamky k vybaveniu", String(naber.poznamky_vybavenie)]);
    if (vybRows.length > 0) sections.push({ title: "VYBAVENIE", icon: "6", rows: vybRows });
  }

  // 7. POZEMKY Z LV
  const pozemky = lv?.pozemky as Array<{ cislo_parcely?: string; druh?: string; vymera?: number }> | undefined;
  if (pozemky?.length) {
    const pozRows: [string, string][] = [];
    pozemky.forEach((p, i) => {
      let val = `parc. ${p.cislo_parcely || "?"}`;
      if (p.druh) val += ` — ${p.druh}`;
      if (p.vymera) val += `, ${p.vymera} m2`;
      pozRows.push([`Pozemok ${i + 1}`, val]);
    });
    sections.push({ title: "POZEMKY", icon: "7", rows: pozRows });
  }

  // 8. TARCHA / PRAVNE VADY
  if (params?.tarcha_text) {
    const tRows: [string, string][] = [];
    tRows.push(["Tarcha", String(params.tarcha_text)]);
    if (params.tarcha_riesenie) tRows.push(["Riesenie", TARCHA_LABELS[params.tarcha_riesenie as string] || String(params.tarcha_riesenie)]);
    sections.push({ title: "TARCHA / PRAVNE VADY", icon: "!", rows: tRows });
  }

  // 9. PREDAJ A ZMLUVA
  const zmlRows: [string, string][] = [];
  if (naber.predajna_cena) zmlRows.push(["Predajna cena", formatCena(Number(naber.predajna_cena))]);
  if (naber.provizia) zmlRows.push(["Provizia", String(naber.provizia)]);
  if (naber.zmluva) {
    if (naber.typ_zmluvy) zmlRows.push(["Typ zmluvy", ZMLUVA_LABELS[naber.typ_zmluvy as string] || String(naber.typ_zmluvy)]);
    if (naber.datum_podpisu) zmlRows.push(["Datum podpisu", formatDate(naber.datum_podpisu as string)]);
    if (naber.zmluva_do) zmlRows.push(["Platnost do", formatDate(naber.zmluva_do as string)]);
  }
  if (naber.typ_inzercie) zmlRows.push(["Typ inzercie", INZERCIA_LABELS[naber.typ_inzercie as string] || String(naber.typ_inzercie)]);
  if (zmlRows.length > 0) sections.push({ title: "PREDAJ A ZMLUVA", icon: "8", rows: zmlRows });

  // 10. MAKLER
  const makRows: [string, string][] = [];
  if (naber.makler) makRows.push(["Makler", String(naber.makler)]);
  if (naber.popis) makRows.push(["Poznamka", String(naber.popis)]);
  sections.push({ title: "MAKLER", icon: "9", rows: makRows });

  return buildPdf(sections, naber, company.nazov || "VIANEMA");
}

function buildPdf(sections: Section[], naber: Record<string, unknown>, title: string): Buffer {
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 50;
  const rightMargin = 50;
  const contentW = pageW - margin - rightMargin;
  const lineHeight = 15;
  const fontSize = 10;
  const sectionGap = 10;

  // Collect all pages' content streams
  const pageStreams: string[] = [];
  let stream = "";
  let yPos = pageH - 90; // start after header

  function newPage() {
    pageStreams.push(stream);
    stream = "";
    yPos = pageH - 40;
  }

  function checkSpace(needed: number) {
    if (yPos - needed < margin + 30) newPage();
  }

  // Header on first page
  stream += "q\n0.216 0.255 0.318 rg\n";
  stream += `0 ${pageH - 65} ${pageW} 65 re f\nQ\n`;
  stream += "BT\n/F2 22 Tf\n1 1 1 rg\n";
  stream += `${margin} ${pageH - 38} Td\n(${esc(title)}) Tj\n`;
  stream += `/F1 10 Tf\n0 -15 Td\n(Naberovy list) Tj\nET\n`;
  if (naber.datum_naberu) {
    stream += `BT\n1 1 1 rg\n/F1 10 Tf\n${pageW - margin - 130} ${pageH - 42} Td\n`;
    stream += `(${esc(formatDate(naber.datum_naberu as string))}) Tj\nET\n`;
  }

  // Render sections
  for (const section of sections) {
    if (section.rows.length === 0) continue;

    // Space needed: title + rows
    const needed = 24 + section.rows.length * lineHeight + sectionGap;
    checkSpace(Math.min(needed, 80)); // at least check for title + 3 rows

    // Section title with line
    yPos -= sectionGap + 6;
    // Gray line
    stream += `q\n0.85 0.87 0.89 rg\n${margin} ${yPos} ${contentW} 0.5 re f\nQ\n`;
    yPos -= 16;
    stream += `BT\n/F2 11 Tf\n0.216 0.255 0.318 rg\n`;
    stream += `${margin} ${yPos} Td\n(${esc(section.title)}) Tj\nET\n`;
    yPos -= 6;

    // Rows
    for (const [label, value] of section.rows) {
      checkSpace(lineHeight + 4);
      yPos -= lineHeight;

      // Label (muted)
      stream += `BT\n/F1 ${fontSize} Tf\n0.45 0.48 0.52 rg\n`;
      stream += `${margin} ${yPos} Td\n(${esc(label + ":")}) Tj\nET\n`;

      // Value (bold, dark) — wrap long text
      const valueX = margin + 140;
      const maxW = pageW - rightMargin - valueX;
      const maxChars = Math.floor(maxW / (fontSize * 0.5));

      if (value.length > maxChars) {
        // Multi-line value
        const words = value.split(/\s+/);
        let currentLine = "";
        let firstLine = true;
        for (const word of words) {
          if ((currentLine + " " + word).length > maxChars && currentLine) {
            stream += `BT\n/F2 ${fontSize} Tf\n0.216 0.255 0.318 rg\n`;
            stream += `${valueX} ${yPos} Td\n(${esc(currentLine)}) Tj\nET\n`;
            if (!firstLine) { /* already accounted */ } else firstLine = false;
            yPos -= lineHeight;
            checkSpace(lineHeight);
            currentLine = word;
          } else {
            currentLine = currentLine ? currentLine + " " + word : word;
          }
        }
        if (currentLine) {
          stream += `BT\n/F2 ${fontSize} Tf\n0.216 0.255 0.318 rg\n`;
          stream += `${valueX} ${yPos} Td\n(${esc(currentLine)}) Tj\nET\n`;
        }
      } else {
        stream += `BT\n/F2 ${fontSize} Tf\n0.216 0.255 0.318 rg\n`;
        stream += `${valueX} ${yPos} Td\n(${esc(value)}) Tj\nET\n`;
      }
    }
  }

  // Signature
  if (naber.podpis_data && typeof naber.podpis_data === "string") {
    checkSpace(50);
    yPos -= 24;
    stream += `BT\n/F1 9 Tf\n0.45 0.48 0.52 rg\n${margin} ${yPos} Td\n`;
    stream += `(Podpis: [podpisany elektronicky]) Tj\nET\n`;
  }

  // Footer
  stream += `BT\n/F1 8 Tf\n0.65 0.67 0.70 rg\n${margin} 30 Td\n`;
  stream += `(${esc(title)} | www.vianema.sk) Tj\nET\n`;

  pageStreams.push(stream);

  // Build PDF objects
  const objects: string[] = [];
  let objCount = 0;
  const offsets: number[] = [];

  function addObj(content: string): number {
    objCount++;
    objects.push(content);
    return objCount;
  }

  const pageCount = pageStreams.length;

  // Obj 1: Catalog
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  // Obj 2: Pages (filled later)
  addObj(""); // placeholder
  // Obj 3: Font Helvetica
  addObj("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj");
  // Obj 4: Font Helvetica-Bold
  addObj("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj");

  // Create page + stream objects
  const pageObjIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    const streamBytes = Buffer.from(pageStreams[i], "latin1");
    const streamObjId = addObj(`${objCount + 1} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${pageStreams[i]}endstream\nendobj`);

    // Add header to non-first pages
    let pageStream = pageStreams[i];
    if (i > 0) {
      // Add mini header
      let hdr = `BT\n/F2 10 Tf\n0.45 0.48 0.52 rg\n${margin} ${pageH - 25} Td\n`;
      hdr += `(VIANEMA — Naberovy list) Tj\nET\n`;
      pageStream = hdr + pageStream;
      // Re-create stream object
      const newBytes = Buffer.from(pageStream, "latin1");
      objects[streamObjId - 1] = `${streamObjId} 0 obj\n<< /Length ${newBytes.length} >>\nstream\n${pageStream}endstream\nendobj`;
    }

    const pageObjId = addObj(`${objCount + 1} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${streamObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj`);
    pageObjIds.push(pageObjId);
  }

  // Fix Pages object
  const kids = pageObjIds.map(id => `${id} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj`;

  // Build PDF file
  let pdf = "%PDF-1.4\n";
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += objects[i] + "\n";
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += "xref\n";
  pdf += `0 ${objCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 0; i < objCount; i++) {
    pdf += offsets[i].toString().padStart(10, "0") + " 00000 n \n";
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${objCount + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += xrefOffset + "\n";
  pdf += "%%EOF";

  void title;
  return Buffer.from(pdf, "latin1");
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/á/g, "a").replace(/Á/g, "A")
    .replace(/č/g, "c").replace(/Č/g, "C")
    .replace(/ď/g, "d").replace(/Ď/g, "D")
    .replace(/é/g, "e").replace(/É/g, "E")
    .replace(/í/g, "i").replace(/Í/g, "I")
    .replace(/ľ/g, "l").replace(/Ľ/g, "L")
    .replace(/ĺ/g, "l").replace(/Ĺ/g, "L")
    .replace(/ň/g, "n").replace(/Ň/g, "N")
    .replace(/ó/g, "o").replace(/Ó/g, "O")
    .replace(/ô/g, "o").replace(/Ô/g, "O")
    .replace(/ŕ/g, "r").replace(/Ŕ/g, "R")
    .replace(/š/g, "s").replace(/Š/g, "S")
    .replace(/ť/g, "t").replace(/Ť/g, "T")
    .replace(/ú/g, "u").replace(/Ú/g, "U")
    .replace(/ý/g, "y").replace(/Ý/g, "Y")
    .replace(/ž/g, "z").replace(/Ž/g, "Z")
    .replace(/ä/g, "a").replace(/Ä/g, "A")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/[^\x20-\x7E]/g, "");
}

// GET: Download PDF
export async function GET(req: NextRequest) {
  const naberId = req.nextUrl.searchParams.get("id");
  if (!naberId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: naber } = await supabase.from("naberove_listy").select("*").eq("id", naberId).single();
  if (!naber) return NextResponse.json({ error: "Naber not found" }, { status: 404 });

  const [{ data: klient }, company] = await Promise.all([
    naber.klient_id
      ? supabase.from("klienti").select("*").eq("id", naber.klient_id).single()
      : Promise.resolve({ data: null }),
    loadCompanyInfo(),
  ]);

  const pdfBuffer = generatePdfBytes(naber, klient || {}, company);
  const lokalita = [naber.obec, naber.okres].filter(Boolean).join("-") || "naber";

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="naberovy-list-${esc(lokalita)}.pdf"`,
    },
  });
}

// POST: Send PDF via email
export async function POST(req: NextRequest) {
  try {
    const { naberId, to, maklerMeno } = await req.json();
    if (!naberId || !to) return NextResponse.json({ error: "naberId and to required" }, { status: 400 });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

    const { data: naber } = await supabase.from("naberove_listy").select("*").eq("id", naberId).single();
    if (!naber) return NextResponse.json({ error: "Naber not found" }, { status: 404 });

    const [{ data: klient }, company] = await Promise.all([
      naber.klient_id
        ? supabase.from("klienti").select("*").eq("id", naber.klient_id).single()
        : Promise.resolve({ data: null }),
      loadCompanyInfo(),
    ]);

    const pdfBuffer = generatePdfBytes(naber, klient || {}, company);
    const pdfBase64 = pdfBuffer.toString("base64");

    const lokalita = [naber.ulica, naber.obec, naber.okres].filter(Boolean).join(", ") || "nehnutelnost";
    const klientMeno = (klient?.meno as string) || "";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VIANEMA <noreply@vianema.sk>",
        to,
        subject: `Naberovy list — ${esc(lokalita)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #374151; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700;">VIANEMA</h1>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">Realitna kancelaria</p>
            </div>
            <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                Dobry den <strong>${esc(klientMeno)}</strong>,
              </p>
              <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280; line-height: 1.6;">
                v prilohe najdete kopiu naberoveho listu pre nehnutelnost <strong>${esc(lokalita)}</strong>.
              </p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                V pripade otazok ma nevahajte kontaktovat.
              </p>
              <p style="margin: 24px 0 0; font-size: 14px; color: #374151;">
                S pozdravom,<br/>
                <strong>${esc(maklerMeno || "VIANEMA")}</strong>
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `naberovy-list.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[naber-pdf] Resend error:", err);
      return NextResponse.json({ error: "Odoslanie zlyhalo" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[naber-pdf]", e);
    return NextResponse.json({ error: "Interna chyba" }, { status: 500 });
  }
}
