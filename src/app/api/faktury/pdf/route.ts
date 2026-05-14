import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import QRCode from "qrcode";

export const runtime = "nodejs";

type Polozka = {
  popis: string | null;
  mnozstvo: number | null;
  jednotka: string | null;
  cena_jednotka: number | null;
  spolu: number | null;
  poradie: number | null;
};

type OdberatelSnapshot = {
  nazov?: string;
  adresa?: string;
  ico?: string;
  dic?: string;
  ic_dph?: string;
};

type Dodavatel = {
  nazov: string; adresa: string; ico: string; dic: string; ic_dph: string;
  iban: string; banka: string; swift: string; obch_register: string; konst_symbol: string;
  email: string; telefon: string; uvodny_text: string; vystavil: string;
  podpis_data?: string | null;
};

const EMPTY_DODAVATEL: Dodavatel = {
  nazov: "", adresa: "", ico: "", dic: "", ic_dph: "",
  iban: "", banka: "", swift: "", obch_register: "", konst_symbol: "",
  email: "", telefon: "", uvodny_text: "", vystavil: "", podpis_data: null,
};

function esc(s: string): string {
  return (s || "").replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, c => {
    const map: Record<string, string> = {
      "á":"a","ä":"a","č":"c","ď":"d","é":"e","ě":"e","í":"i","ĺ":"l","ľ":"l","ň":"n","ó":"o","ô":"o","ŕ":"r","ř":"r","š":"s","ť":"t","ú":"u","ů":"u","ý":"y","ž":"z",
      "Á":"A","Ä":"A","Č":"C","Ď":"D","É":"E","Ě":"E","Í":"I","Ĺ":"L","Ľ":"L","Ň":"N","Ó":"O","Ô":"O","Ŕ":"R","Ř":"R","Š":"S","Ť":"T","Ú":"U","Ů":"U","Ý":"Y","Ž":"Z",
      "€":"EUR","–":"-","—":"-","„":"\"","\u201C":"\"","‚":"'","'":"'"," ":" ",
    };
    return map[c] || "?";
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric" }); } catch { return iso; }
}

function fmtMoney(n: number | null | undefined): string {
  return `${Number(n || 0).toFixed(2)} EUR`;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line ? line + " " + word : word).length <= maxChars) {
      line = line ? `${line} ${word}` : word;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [text];
}

// Approximate right-aligned x for Helvetica (0.55 × size per char)
function xRight(text: string, size: number, rightEdge: number): number {
  return rightEdge - text.length * size * 0.55;
}

type PdfOp =
  | { kind: "text"; x: number; y: number; size: number; text: string }
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill: [number, number, number] }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; gray: number }
  | { kind: "path"; points: [number, number][]; color: [number, number, number]; width: number };

function buildPdf(ops: PdfOp[], pageW = 595, pageH = 842): Buffer {
  let stream = "0 g\n";
  for (const op of ops) {
    if (op.kind === "text") {
      stream += `0 g\nBT\n/F1 ${op.size} Tf\n${op.x} ${op.y} Td\n(${esc(op.text)}) Tj\nET\n`;
    } else if (op.kind === "rect") {
      const [r, g, b] = op.fill;
      stream += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n${op.x} ${op.y} ${op.w} ${op.h} re\nf\n`;
    } else if (op.kind === "line") {
      stream += `${op.gray.toFixed(3)} G\n${op.x1} ${op.y1} m\n${op.x2} ${op.y2} l\nS\n`;
    } else if (op.kind === "path" && op.points.length >= 2) {
      const [r, g, b] = op.color;
      stream += `q\n${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n${op.width} w\n1 J\n1 j\n`;
      stream += `${op.points[0][0].toFixed(2)} ${op.points[0][1].toFixed(2)} m\n`;
      for (let i = 1; i < op.points.length; i++) {
        stream += `${op.points[i][0].toFixed(2)} ${op.points[i][1].toFixed(2)} l\n`;
      }
      stream += `S\nQ\n`;
    }
  }

  const objs: string[] = [];
  objs.push(`<</Type/Catalog/Pages 2 0 R>>`);
  objs.push(`<</Type/Pages/Kids[3 0 R]/Count 1>>`);
  objs.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pageW} ${pageH}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>>>`);
  objs.push(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
  objs.push(`<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>`);
  objs.push(`<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>`);

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objs.length; i++) {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += String(off).padStart(10, "0") + " 00000 n \n";
  body += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body, "binary");
}

/** Generuje Pay by Square / SEPA QR string pre slovenské banky */
function buildPaymentQrString(iban: string, swift: string, nazov: string, amount: number, vs: string): string {
  const ibanClean = iban.replace(/\s/g, "");
  // SPD formát (Pay by Square) — akceptujú ho slovenské bankové aplikácie
  const acc = swift ? `${ibanClean}+${swift}` : ibanClean;
  return `SPD*1.0*ACC:${acc}*AM:${amount.toFixed(2)}*CC:EUR*X-VS:${vs}*MSG:Faktura ${vs}*RN:${nazov}`;
}

/** Konvertuje QR kód na PDF rect operácie */
async function qrCodeToOps(data: string, x: number, y: number, size: number): Promise<PdfOp[]> {
  try {
    const qr = QRCode.create(data, { errorCorrectionLevel: "M" });
    const modules = qr.modules;
    const n = modules.size;
    const cell = size / n;
    const ops: PdfOp[] = [];
    // Biely podklad
    ops.push({ kind: "rect", x, y: y - size, w: size, h: size, fill: [1, 1, 1] });
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (modules.get(row, col)) {
          ops.push({
            kind: "rect",
            x: x + col * cell,
            y: y - size + (n - 1 - row) * cell,
            w: cell + 0.3,
            h: cell + 0.3,
            fill: [0, 0, 0],
          });
        }
      }
    }
    return ops;
  } catch {
    return [];
  }
}

type StrokePoint = [number, number];

/** Vykreslí podpis (uložený ako JSON strokes) ako modré čiary v PDF */
function signatureToOps(
  podpisData: string,
  x: number, y: number,
  maxW: number, maxH: number,
): PdfOp[] {
  try {
    const parsed = JSON.parse(podpisData) as { strokes: StrokePoint[][]; w: number; h: number };
    const { strokes, w: cw, h: ch } = parsed;
    if (!strokes?.length) return [];
    const scaleX = maxW / cw;
    const scaleY = maxH / ch;
    const ops: PdfOp[] = [];
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      const points: [number, number][] = stroke.map(([sx, sy]) => [
        x + sx * scaleX,
        y + maxH - sy * scaleY, // canvas y→down, PDF y→up
      ]);
      ops.push({ kind: "path", points, color: [0.1, 0.2, 0.8], width: 1.5 });
    }
    return ops;
  } catch {
    return [];
  }
}

async function buildOps(
  faktura: Record<string, unknown>,
  polozky: Polozka[],
  dodavatel: Dodavatel,
  odb: OdberatelSnapshot,
): Promise<PdfOp[]> {
  const pageW = 595, pageH = 842;
  const margin = 56;
  const ops: PdfOp[] = [];

  let y = pageH - margin;

  ops.push({ kind: "text", x: margin, y: y - 4, size: 10, text: "FAKTURA" });
  ops.push({ kind: "text", x: margin, y: y - 24, size: 22, text: String(faktura.cislo_faktury || "") });
  ops.push({ kind: "text", x: margin, y: y - 40, size: 9, text: `VS: ${String(faktura.variabilny_symbol || "")}` });

  let dy = y - 4;
  const right = pageW - margin;
  if (dodavatel.nazov) {
    ops.push({ kind: "text", x: right - 200, y: dy, size: 11, text: dodavatel.nazov });
    dy -= 14;
  }
  if (dodavatel.adresa) {
    for (const ln of wrapText(dodavatel.adresa, 36)) {
      ops.push({ kind: "text", x: right - 200, y: dy, size: 9, text: ln }); dy -= 12;
    }
  }
  if (dodavatel.ico)    { ops.push({ kind: "text", x: right - 200, y: dy, size: 9, text: `ICO: ${dodavatel.ico}` }); dy -= 12; }
  if (dodavatel.dic)    { ops.push({ kind: "text", x: right - 200, y: dy, size: 9, text: `DIC: ${dodavatel.dic}` }); dy -= 12; }
  if (dodavatel.ic_dph) { ops.push({ kind: "text", x: right - 200, y: dy, size: 9, text: `IC DPH: ${dodavatel.ic_dph}` }); dy -= 12; }
  if (dodavatel.obch_register) { ops.push({ kind: "text", x: right - 200, y: dy, size: 8, text: dodavatel.obch_register }); dy -= 11; }

  y -= 90;

  ops.push({ kind: "text", x: margin, y, size: 9, text: "ODBERATEL" });
  let oy = y - 14;
  ops.push({ kind: "text", x: margin, y: oy, size: 11, text: String(odb.nazov || "—") }); oy -= 14;
  if (odb.adresa) { ops.push({ kind: "text", x: margin, y: oy, size: 9, text: odb.adresa }); oy -= 12; }
  ops.push({ kind: "text", x: margin, y: oy, size: 9, text: `ICO: ${odb.ico || "—"}    DIC: ${odb.dic || "—"}` }); oy -= 12;
  if (odb.ic_dph) { ops.push({ kind: "text", x: margin, y: oy, size: 9, text: `IC DPH: ${odb.ic_dph}` }); oy -= 12; }

  let ry = y;
  const rightCol = pageW - margin - 220;
  const rowL = (label: string, value: string) => {
    ops.push({ kind: "text", x: rightCol, y: ry, size: 9, text: label });
    ops.push({ kind: "text", x: rightCol + 110, y: ry, size: 9, text: value });
    ry -= 12;
  };
  rowL("Datum vystavenia:", fmtDate(faktura.datum_vystavenia as string));
  rowL("Datum dodania:", fmtDate(faktura.datum_dodania as string));
  rowL("Datum splatnosti:", fmtDate(faktura.datum_splatnosti as string));
  rowL("Forma uhrady:", String(faktura.forma_uhrady || "Prevodom"));
  rowL("Variabilny symbol:", String(faktura.variabilny_symbol || ""));
  if (dodavatel.konst_symbol) rowL("Konst. symbol:", dodavatel.konst_symbol);
  if (dodavatel.iban)         rowL("IBAN:", dodavatel.iban);
  if (dodavatel.banka)        rowL("Banka:", dodavatel.banka);
  if (dodavatel.swift)        rowL("SWIFT:", dodavatel.swift);

  y = Math.min(oy, ry) - 16;

  // Položky — header
  const colX = { popis: margin, mnozstvo: margin + 280, cena: margin + 360, spolu: margin + 440 };
  ops.push({ kind: "rect", x: margin - 4, y: y - 18, w: pageW - 2 * margin + 8, h: 20, fill: [0.96, 0.96, 0.97] });
  ops.push({ kind: "text", x: colX.popis,    y: y - 12, size: 9, text: "POPIS" });
  ops.push({ kind: "text", x: colX.mnozstvo, y: y - 12, size: 9, text: "MNOZSTVO" });
  ops.push({ kind: "text", x: colX.cena,     y: y - 12, size: 9, text: "CENA/J" });
  ops.push({ kind: "text", x: xRight("SPOLU", 9, pageW - margin), y: y - 12, size: 9, text: "SPOLU" });
  y -= 28;

  for (const p of polozky.sort((a, b) => (a.poradie ?? 0) - (b.poradie ?? 0))) {
    if (y < 240) break;
    const popis = String(p.popis || "");
    const popisChunks: string[] = [];
    let rest = popis;
    const maxChars = 48;
    while (rest.length > 0) {
      let chunk = rest.slice(0, maxChars);
      if (rest.length > maxChars) {
        const sp = chunk.lastIndexOf(" ");
        if (sp > 24) chunk = chunk.slice(0, sp);
      }
      popisChunks.push(chunk);
      rest = rest.slice(chunk.length).trimStart();
    }
    ops.push({ kind: "text", x: colX.popis, y, size: 10, text: popisChunks[0] || "" });
    ops.push({ kind: "text", x: colX.mnozstvo, y, size: 10, text: `${Number(p.mnozstvo || 0)} ${p.jednotka || ""}` });
    ops.push({ kind: "text", x: colX.cena, y, size: 10, text: fmtMoney(p.cena_jednotka) });
    ops.push({ kind: "text", x: xRight(fmtMoney(p.spolu), 10, pageW - margin), y, size: 10, text: fmtMoney(p.spolu) });
    y -= 14;
    for (let i = 1; i < popisChunks.length; i++) {
      ops.push({ kind: "text", x: colX.popis, y, size: 10, text: popisChunks[i] });
      y -= 14;
    }
    y -= 4;
  }

  // Súčet
  y -= 8;
  ops.push({ kind: "line", x1: margin, y1: y, x2: pageW - margin, y2: y, gray: 0.2 });
  y -= 16;
  ops.push({ kind: "text", x: margin, y, size: 12, text: "Celkom k uhrade" });
  ops.push({ kind: "text", x: xRight(fmtMoney(faktura.suma_celkom as number), 14, pageW - margin), y, size: 14, text: fmtMoney(faktura.suma_celkom as number) });

  if (faktura.poznamka) {
    y -= 20;
    ops.push({ kind: "text", x: margin, y, size: 9, text: "Poznamka:" }); y -= 12;
    let restPoz = String(faktura.poznamka);
    while (restPoz.length > 0 && y > 200) {
      let chunk = restPoz.slice(0, 90);
      if (restPoz.length > 90) {
        const sp = chunk.lastIndexOf(" ");
        if (sp > 40) chunk = chunk.slice(0, sp);
      }
      ops.push({ kind: "text", x: margin, y, size: 9, text: chunk });
      y -= 12;
      restPoz = restPoz.slice(chunk.length).trimStart();
    }
  }

  // Podpis vľavo + QR kód vpravo — FIXED position ~4cm from bottom
  const signatureX = margin;
  const signatureY = 120;
  const signatureW = 160;
  const signatureH = 60;
  const qrSize = signatureH; // 60px — rovnaká výška ako signature box
  const qrX = pageW - margin - qrSize;
  const qrY = signatureY + signatureH; // QR top = signature top → rovnaké zarovnanie

  // QR kód na platbu
  const hasQrData = dodavatel.iban;
  if (hasQrData) {
    const qrString = buildPaymentQrString(
      dodavatel.iban,
      dodavatel.swift,
      dodavatel.nazov,
      Number(faktura.suma_celkom || 0),
      String(faktura.variabilny_symbol || ""),
    );
    const qrOps = await qrCodeToOps(qrString, qrX, qrY, qrSize);
    ops.push(...qrOps);
    ops.push({ kind: "text", x: qrX, y: qrY - qrSize - 10, size: 7, text: "QR platba" });
  }

  // Podpis — bottom edge je signatureY, top je signatureY + signatureH
  if (dodavatel.podpis_data) {
    const signOps = signatureToOps(dodavatel.podpis_data, signatureX, signatureY, signatureW, signatureH);
    ops.push(...signOps);
  }
  // Linka priamo pod dolnou hranou podpisu (signatureY = bottom of signature box)
  ops.push({ kind: "line", x1: signatureX, y1: signatureY - 4, x2: signatureX + signatureW, y2: signatureY - 4, gray: 0.7 });

  // Vystavil tesne pod čiarou
  const vystavilY = signatureY - 18;
  if (dodavatel.vystavil) {
    ops.push({ kind: "text", x: signatureX, y: vystavilY, size: 9, text: "Vystavil:" });
    ops.push({ kind: "text", x: signatureX, y: vystavilY - 12, size: 10, text: dodavatel.vystavil });
    let vy = vystavilY - 24;
    if (dodavatel.telefon) { ops.push({ kind: "text", x: signatureX, y: vy, size: 9, text: `Mobil: ${dodavatel.telefon}` }); vy -= 12; }
  }

  ops.push({ kind: "text", x: margin, y: 20, size: 8, text: "Powered by AMGD" });

  return ops;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: f, error: fErr } = await sb.from("faktury").select("*").eq("id", id).maybeSingle();
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
  if (!f) return NextResponse.json({ error: "Faktura not found" }, { status: 404 });

  const { data: polozky } = await sb
    .from("faktura_polozky")
    .select("popis, mnozstvo, jednotka, cena_jednotka, spolu, poradie")
    .eq("faktura_id", id);

  let dodavatel: Dodavatel = EMPTY_DODAVATEL;
  if (f.user_id) {
    const { data: dod } = await sb.from("makler_dodavatel").select("*").eq("user_id", f.user_id).maybeSingle();
    if (dod) dodavatel = { ...EMPTY_DODAVATEL, ...dod };
  }

  const odb: OdberatelSnapshot = (f.odberatel_snapshot as OdberatelSnapshot) || {};
  const ops = await buildOps(f as Record<string, unknown>, (polozky as Polozka[]) || [], dodavatel, odb);
  const pdf = buildPdf(ops);

  const filename = `faktura-${String(f.cislo_faktury || id.slice(0, 8))}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
