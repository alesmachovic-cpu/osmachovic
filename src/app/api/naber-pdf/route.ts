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
  invest_zamer: "Investicny zamer", projekt: "Projekt", vystavba: "Vystavba",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatCena(v: number): string {
  return v.toLocaleString("sk") + " EUR";
}

// Generate minimal PDF manually (no external lib) using PDF spec
function generatePdfBytes(naber: Record<string, unknown>, klient: Record<string, unknown>): Buffer {
  const lines: string[] = [];
  const klientMeno = (klient?.meno as string) || "Klient";
  const klientTelefon = klient?.telefon as string;
  const klientEmail = klient?.email as string;

  lines.push("VIANEMA - Naberovy list");
  lines.push("");

  if (naber.datum_naberu) lines.push("Datum: " + formatDate(naber.datum_naberu as string));
  lines.push("");

  lines.push("--- KLIENT ---");
  lines.push("Meno: " + klientMeno);
  if (klientTelefon) lines.push("Telefon: " + klientTelefon);
  if (klientEmail) lines.push("Email: " + klientEmail);
  lines.push("");

  lines.push("--- NEHNUTELNOST ---");
  lines.push("Typ: " + (TYP_LABELS[naber.typ_nehnutelnosti as string] || naber.typ_nehnutelnosti));
  const adresa = [naber.ulica, naber.cislo_orientacne, naber.obec, naber.okres, naber.kraj].filter(Boolean).join(", ");
  if (adresa) lines.push("Adresa: " + adresa);
  if (naber.plocha) lines.push("Plocha: " + naber.plocha + " m2");
  if (naber.stav) lines.push("Stav: " + (STAV_LABELS[naber.stav as string] || naber.stav));
  if (naber.predajna_cena) lines.push("Predajna cena: " + formatCena(Number(naber.predajna_cena)));

  const params = naber.parametre as Record<string, unknown> | null;
  if (params) {
    if (params.pocet_izieb) lines.push("Pocet izieb: " + params.pocet_izieb);
    if (params.poschodie) lines.push("Poschodie: " + params.poschodie + (params.z_kolko ? "/" + params.z_kolko : ""));
    if (params.kurenie) lines.push("Kurenie: " + params.kurenie);
    if (params.pozemok_plocha) lines.push("Pozemok: " + params.pozemok_plocha + " m2");
  }
  lines.push("");

  if (naber.zmluva) {
    lines.push("--- ZMLUVA ---");
    if (naber.typ_zmluvy) lines.push("Typ zmluvy: " + naber.typ_zmluvy);
    if (naber.datum_podpisu) lines.push("Datum podpisu: " + formatDate(naber.datum_podpisu as string));
    if (naber.zmluva_do) lines.push("Platnost do: " + formatDate(naber.zmluva_do as string));
    if (naber.provizia) lines.push("Provizia: " + naber.provizia);
    lines.push("");
  }

  lines.push("--- MAKLER ---");
  if (naber.makler) lines.push("Makler: " + naber.makler);
  lines.push("");
  lines.push("---");
  lines.push("VIANEMA s.r.o. | www.vianema.sk");

  // Build a minimal valid PDF
  const text = lines.join("\n");
  return buildSimplePdf(text, klientMeno, naber);
}

function buildSimplePdf(text: string, title: string, naber: Record<string, unknown>): Buffer {
  // Minimal PDF 1.4 generator
  const textLines = text.split("\n");
  const pageW = 595.28; // A4
  const pageH = 841.89;
  const margin = 50;
  const lineHeight = 16;
  const fontSize = 11;
  const headerFontSize = 22;

  const objects: string[] = [];
  let objCount = 0;
  const offsets: number[] = [];

  function addObj(content: string): number {
    objCount++;
    objects.push(content);
    return objCount;
  }

  // Obj 1: Catalog
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  // Obj 2: Pages
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");

  // Build page content stream
  let streamContent = "";

  // Dark header background
  streamContent += "q\n0.216 0.255 0.318 rg\n"; // #374151
  streamContent += `0 ${pageH - 60} ${pageW} 60 re f\nQ\n`;

  // Header text (white)
  streamContent += "BT\n";
  streamContent += `/F1 ${headerFontSize} Tf\n`;
  streamContent += "1 1 1 rg\n"; // white
  streamContent += `${margin} ${pageH - 35} Td\n`;
  streamContent += `(VIANEMA) Tj\n`;
  streamContent += `/F1 10 Tf\n`;
  streamContent += `0 -16 Td\n`;
  streamContent += `(Naberovy list) Tj\n`;
  streamContent += "ET\n";

  // Date in header (right side)
  if (naber.datum_naberu) {
    streamContent += "BT\n1 1 1 rg\n/F1 10 Tf\n";
    streamContent += `${pageW - margin - 150} ${pageH - 40} Td\n`;
    streamContent += `(${escPdf(formatDate(naber.datum_naberu as string))}) Tj\nET\n`;
  }

  // Body text
  let yPos = pageH - 90;
  streamContent += "BT\n";
  streamContent += `0.216 0.255 0.318 rg\n`; // dark gray
  streamContent += `/F1 ${fontSize} Tf\n`;
  streamContent += `${margin} ${yPos} Td\n`;

  for (const line of textLines) {
    if (yPos < margin) break; // simple: stop at page end

    const isSectionHeader = line.startsWith("---") && line.endsWith("---") && line.length > 6;
    const isMainTitle = line === "VIANEMA - Naberovy list";

    if (isMainTitle) continue; // skip, already in header

    if (isSectionHeader) {
      const sectionName = line.replace(/---/g, "").trim();
      streamContent += `0 -${lineHeight + 4} Td\n`;
      streamContent += `/F2 12 Tf\n`;
      streamContent += `0.216 0.255 0.318 rg\n`;
      streamContent += `(${escPdf(sectionName)}) Tj\n`;
      streamContent += `/F1 ${fontSize} Tf\n`;
      yPos -= lineHeight + 4;
    } else if (line === "---") {
      streamContent += `0 -${lineHeight} Td\n`;
      yPos -= lineHeight;
    } else if (line === "") {
      streamContent += `0 -${lineHeight / 2} Td\n`;
      yPos -= lineHeight / 2;
    } else {
      // Check if it's a label: value pair
      const colonIdx = line.indexOf(": ");
      if (colonIdx > 0 && colonIdx < 20) {
        const label = line.substring(0, colonIdx + 1);
        const value = line.substring(colonIdx + 2);
        streamContent += `0 -${lineHeight} Td\n`;
        streamContent += `0.42 0.45 0.50 rg\n`; // muted
        streamContent += `(${escPdf(label)}) Tj\n`;
        streamContent += `0.216 0.255 0.318 rg\n`; // dark
        streamContent += `/F2 ${fontSize} Tf\n`;
        streamContent += `( ${escPdf(value)}) Tj\n`;
        streamContent += `/F1 ${fontSize} Tf\n`;
      } else {
        streamContent += `0 -${lineHeight} Td\n`;
        streamContent += `(${escPdf(line)}) Tj\n`;
      }
      yPos -= lineHeight;
    }
  }

  // Footer
  streamContent += `0 -${Math.max(0, yPos - margin - 20)} Td\n`;
  streamContent += `0.61 0.64 0.69 rg\n`;
  streamContent += `/F1 8 Tf\n`;
  streamContent += `(VIANEMA s.r.o. | www.vianema.sk) Tj\n`;

  streamContent += "ET\n";

  // Signature if present
  if (naber.podpis_data && typeof naber.podpis_data === "string" && (naber.podpis_data as string).startsWith("data:image")) {
    // We skip embedding image in minimal PDF for now - too complex
    // Just add text
    streamContent += "BT\n0.42 0.45 0.50 rg\n/F1 10 Tf\n";
    streamContent += `${margin} ${Math.max(80, yPos - 30)} Td\n`;
    streamContent += `(Podpis: [podpisany elektronicky]) Tj\nET\n`;
  }

  const streamBytes = Buffer.from(streamContent, "latin1");

  // Obj 3: Page
  addObj(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>\nendobj`);
  // Obj 4: Font (Helvetica)
  addObj("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj");
  // Obj 5: Font Bold
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj");
  // Obj 6: Content stream
  addObj(`6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamContent}endstream\nendobj`);

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

  void title; // used for context
  return Buffer.from(pdf, "latin1");
}

function escPdf(s: string): string {
  // Escape special PDF string chars and convert Slovak chars to ASCII
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Slovak diacritics → ASCII (for Helvetica font compatibility)
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
    .replace(/[^\x20-\x7E]/g, ""); // remove any remaining non-ASCII
}

// GET: Download PDF for a naber
export async function GET(req: NextRequest) {
  const naberId = req.nextUrl.searchParams.get("id");
  if (!naberId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: naber } = await supabase.from("naberove_listy").select("*").eq("id", naberId).single();
  if (!naber) return NextResponse.json({ error: "Naber not found" }, { status: 404 });

  const { data: klient } = naber.klient_id
    ? await supabase.from("klienti").select("*").eq("id", naber.klient_id).single()
    : { data: null };

  const pdfBuffer = generatePdfBytes(naber, klient || {});
  const lokalita = [naber.obec, naber.okres].filter(Boolean).join("-") || "naber";

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="naberovy-list-${lokalita}.pdf"`,
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

    const { data: klient } = naber.klient_id
      ? await supabase.from("klienti").select("*").eq("id", naber.klient_id).single()
      : { data: null };

    const pdfBuffer = generatePdfBytes(naber, klient || {});
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
        subject: `Naberovy list - ${escPdf(lokalita)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #374151; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700;">VIANEMA</h1>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">Realitna kancelaria</p>
            </div>
            <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">
                Dobry den <strong>${escPdf(klientMeno)}</strong>,
              </p>
              <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280; line-height: 1.6;">
                v prilohe najdete kopiu naberoveho listu pre nehnutelnost <strong>${escPdf(lokalita)}</strong>.
              </p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                V pripade otazok ma nevahajte kontaktovat.
              </p>
              <p style="margin: 24px 0 0; font-size: 14px; color: #374151;">
                S pozdravom,<br/>
                <strong>${escPdf(maklerMeno || "VIANEMA")}</strong>
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
