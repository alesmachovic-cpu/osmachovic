import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const DRUHY_MAP: Record<string, string> = {
  byt: "Byt", rodinny_dom: "Rodinny dom", pozemok: "Pozemok",
  kancelaria: "Kancelaria", obchodny_priestor: "Obchodny priestor",
  chata: "Chata / rekreacna nehnutelnost",
};

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
    .replace(/š/g, "s").replace(/Š/g, "S")
    .replace(/ť/g, "t").replace(/Ť/g, "T")
    .replace(/ú/g, "u").replace(/Ú/g, "U")
    .replace(/ý/g, "y").replace(/Ý/g, "Y")
    .replace(/ž/g, "z").replace(/Ž/g, "Z")
    .replace(/ä/g, "a").replace(/[^\x20-\x7E]/g, "");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatCena(v: number): string {
  return v.toLocaleString("sk") + " EUR";
}

function generateObjednavkaPdf(obj: Record<string, unknown>, klient: Record<string, unknown>): Buffer {
  const pageW = 595, pageH = 842;
  const margin = 50;
  const contentW = pageW - margin * 2;

  const klientMeno = (klient?.meno as string) || "Klient";
  const klientTelefon = klient?.telefon as string | undefined;
  const klientEmail = klient?.email as string | undefined;

  const druhRaw = (obj.druh as string | string[] | null) || "";
  const druhArr = Array.isArray(druhRaw) ? druhRaw : String(druhRaw).split(/[,/]/).map((s: string) => s.trim()).filter(Boolean);
  const druhLabel = druhArr.map((d: string) => DRUHY_MAP[d] || d).join(", ") || "—";

  const lokalita = (obj.lokalita || {}) as Record<string, unknown>;
  const lokArr: string[] = [];
  if ((lokalita.kraje as string[] | undefined)?.length) lokArr.push((lokalita.kraje as string[]).join(", "));
  else if (lokalita.kraj) lokArr.push(String(lokalita.kraj));
  if ((lokalita.okresy as string[] | undefined)?.length) lokArr.push((lokalita.okresy as string[]).join(", "));
  else if (lokalita.okres) lokArr.push(String(lokalita.okres));
  if (lokalita.obec) lokArr.push(String(lokalita.obec));
  const lokalitaLabel = lokArr.join(" / ") || "—";

  const poziadavky = (obj.poziadavky || {}) as Record<string, unknown>;
  const cenaDo = obj.cena_do as number | null;
  const cenaOd = obj.cena_od as number | null;
  const createdAt = obj.created_at as string | undefined;
  const isPodpisana = !!obj.podpis;
  const podpisAt = obj.podpis_created_at as string | undefined;

  type Row = [string, string];
  type Section = { title: string; rows: Row[] };
  const sections: Section[] = [];

  // 1. KLIENT
  const klientRows: Row[] = [["Meno", esc(klientMeno)]];
  if (klientTelefon) klientRows.push(["Telefon", esc(klientTelefon)]);
  if (klientEmail) klientRows.push(["Email", esc(klientEmail)]);
  sections.push({ title: "KUPUJUCI", rows: klientRows });

  // 2. CO HLADA
  const hladaRows: Row[] = [["Typ nehnutelnosti", esc(druhLabel)]];
  hladaRows.push(["Lokalita", esc(lokalitaLabel)]);
  if (poziadavky.pocet_izieb) hladaRows.push(["Pocet izieb", esc(String(poziadavky.pocet_izieb))]);
  if (cenaOd || cenaDo) {
    const cenaStr = cenaOd && cenaDo
      ? `${formatCena(cenaOd)} - ${formatCena(cenaDo)}`
      : cenaDo ? `max. ${formatCena(cenaDo)}` : `od ${formatCena(cenaOd!)}`;
    hladaRows.push(["Cenove rozpatje", esc(cenaStr)]);
  }
  if (poziadavky.plocha_od) hladaRows.push(["Plocha min.", esc(String(poziadavky.plocha_od)) + " m2"]);
  if (poziadavky.plocha_do) hladaRows.push(["Plocha max.", esc(String(poziadavky.plocha_do)) + " m2"]);
  sections.push({ title: "CO HLADA", rows: hladaRows });

  // 3. POZIADAVKY (ďalšie polia z JSONB)
  const pozRows: Row[] = [];
  const skipKeys = new Set(["pocet_izieb", "plocha_od", "plocha_do"]);
  for (const [k, v] of Object.entries(poziadavky)) {
    if (skipKeys.has(k) || !v) continue;
    pozRows.push([esc(k.replace(/_/g, " ")), esc(typeof v === "object" ? JSON.stringify(v) : String(v))]);
  }
  if (pozRows.length > 0) sections.push({ title: "DALSIE POZIADAVKY", rows: pozRows });

  // 4. PODPIS
  const podpisRows: Row[] = [];
  if (isPodpisana) {
    podpisRows.push(["Stav", "Podpisana"]);
    if (podpisAt) podpisRows.push(["Datum podpisu", esc(formatDate(podpisAt))]);
  } else {
    podpisRows.push(["Stav", "Caka na podpis"]);
  }
  if (createdAt) podpisRows.push(["Datum vystavenia", esc(formatDate(createdAt))]);
  sections.push({ title: "PODPIS", rows: podpisRows });

  // --- build PDF content stream ---
  let stream = "";
  let yPos = pageH - 60;

  // Title
  stream += `BT\n/F2 18 Tf\n0.1 0.12 0.15 rg\n${margin} ${yPos} Td\n(OBJEDNAVKA — KUPUJUCI) Tj\nET\n`;
  yPos -= 8;
  stream += `${margin} ${yPos} m ${pageW - margin} ${yPos} l S\n`;
  yPos -= 20;

  // Subtitle
  stream += `BT\n/F1 10 Tf\n0.45 0.48 0.52 rg\n${margin} ${yPos} Td\n(Vianema, s.r.o. | www.vianema.sk) Tj\nET\n`;
  yPos -= 28;

  const pageStreams: string[] = [];

  function checkPage() {
    if (yPos < 80) {
      pageStreams.push(stream);
      stream = "";
      yPos = pageH - 50;
    }
  }

  for (const sec of sections) {
    checkPage();
    // Section header
    stream += `${margin} ${yPos - 4} m ${pageW - margin} ${yPos - 4} l\n0.88 0.90 0.93 RG\nS\n`;
    stream += `0.95 0.96 0.97 rg\n${margin} ${yPos - 18} ${contentW} 22 re f\n`;
    stream += `BT\n/F2 9 Tf\n0.2 0.22 0.26 rg\n${margin + 6} ${yPos - 12} Td\n(${esc(sec.title)}) Tj\nET\n`;
    yPos -= 28;
    stream += "0 g\n0 G\n";

    for (const [label, val] of sec.rows) {
      checkPage();
      stream += `BT\n/F2 8 Tf\n0.45 0.48 0.52 rg\n${margin} ${yPos} Td\n(${esc(label)}) Tj\nET\n`;
      stream += `BT\n/F1 9 Tf\n0.1 0.12 0.15 rg\n${margin + 120} ${yPos} Td\n(${esc(val)}) Tj\nET\n`;
      yPos -= 15;
    }
    yPos -= 8;
  }

  // Signature image if signed
  if (isPodpisana && obj.podpis) {
    checkPage();
    stream += `BT\n/F2 9 Tf\n0.2 0.22 0.26 rg\n${margin} ${yPos} Td\n(Elektronicky podpis klienta:) Tj\nET\n`;
    yPos -= 40;
    stream += `${margin} ${yPos} m ${margin + 160} ${yPos} l\n0.3 0.35 0.4 RG\nS\n`;
    yPos -= 12;
    stream += `BT\n/F1 8 Tf\n0.55 0.58 0.62 rg\n${margin} ${yPos} Td\n`;
    stream += `(Podpisany elektronicky - ${esc(podpisAt ? formatDate(podpisAt) : "")}) Tj\nET\n`;
    yPos -= 14;
    stream += `BT\n/F1 7 Tf\n0.65 0.67 0.70 rg\n${margin} ${yPos} Td\n`;
    stream += `(Tento dokument bol podpisany elektronicky a je pravne zavazny.) Tj\nET\n`;
  }

  // Footer
  stream += `BT\n/F1 8 Tf\n0.65 0.67 0.70 rg\n${margin} 30 Td\n`;
  stream += `(Objednavka kupujuceho | Vianema, s.r.o. | www.vianema.sk) Tj\nET\n`;

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

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj("");
  addObj("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj");
  addObj("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj");

  const pageObjIds: number[] = [];
  for (let i = 0; i < pageStreams.length; i++) {
    const ps = pageStreams[i];
    const streamObjId = addObj(`${objCount + 1} 0 obj\n<< /Length ${Buffer.byteLength(ps, "latin1")} >>\nstream\n${ps}endstream\nendobj`);
    const pageObjId = addObj(`${objCount + 1} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${streamObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj`);
    pageObjIds.push(pageObjId);
  }

  const kids = pageObjIds.map(id => `${id} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageStreams.length} >>\nendobj`;

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

  return Buffer.from(pdf, "latin1");
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: obj, error } = await sb
    .from("objednavky")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !obj) return NextResponse.json({ error: "not found" }, { status: 404 });

  let klient: Record<string, unknown> = {};
  if (obj.klient_id) {
    const { data: k } = await sb.from("klienti").select("meno,telefon,email").eq("id", obj.klient_id).single();
    if (k) klient = k as Record<string, unknown>;
  }
  const pdfBuffer = generateObjednavkaPdf(obj as Record<string, unknown>, klient);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="objednavka-${id.slice(0, 8)}.pdf"`,
    },
  });
}
