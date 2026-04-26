import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * GET /api/obhliadky/pdf?id=X — stiahnutie PDF obhliadkového listu
 * POST /api/obhliadky/pdf — odoslanie emailu kupujúcemu
 *   body: { obhliadkaId, to, maklerMeno? }
 */

type CompanyInfo = { nazov?: string; sidlo?: string; ico?: string; registracia?: string };

async function loadCompany(): Promise<CompanyInfo> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("makleri").select("firma").eq("email", "ales@vianema.sk").single();
    if (data?.firma) {
      const c = typeof data.firma === "string" ? JSON.parse(data.firma) : data.firma;
      return c as CompanyInfo;
    }
  } catch { /* ignore */ }
  return { nazov: "Vianema s. r. o." };
}

function esc(s: string): string {
  return (s || "").replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, c => {
    const map: Record<string, string> = {
      "á":"a","ä":"a","č":"c","ď":"d","é":"e","ě":"e","í":"i","ĺ":"l","ľ":"l","ň":"n","ó":"o","ô":"o","ŕ":"r","ř":"r","š":"s","ť":"t","ú":"u","ů":"u","ý":"y","ž":"z",
      "Á":"A","Ä":"A","Č":"C","Ď":"D","É":"E","Ě":"E","Í":"I","Ĺ":"L","Ľ":"L","Ň":"N","Ó":"O","Ô":"O","Ŕ":"R","Ř":"R","Š":"S","Ť":"T","Ú":"U","Ů":"U","Ý":"Y","Ž":"Z",
      "€":"EUR","–":"-","—":"-","„":"\"","“":"\"","‚":"'","‘":"'","\u00A0":" ",
    };
    return map[c] || "?";
  });
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric" }); } catch { return iso; }
}

function fmtDateTime(iso: string): string {
  try { return new Date(iso).toLocaleString("sk", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

function buildPdf(lines: string[], title: string): Buffer {
  // Minimalistický 1-stránkový PDF, A4, font Helvetica
  const pageW = 595, pageH = 842, margin = 64;
  let stream = "BT\n/F1 18 Tf\n";
  stream += `${margin} ${pageH - 80} Td\n(${esc(title)}) Tj\nET\n`;

  let yPos = pageH - 120;
  for (const line of lines) {
    if (yPos < margin) break;
    if (line === "") { yPos -= 8; continue; }
    if (line.startsWith("# ")) {
      stream += `BT\n/F1 13 Tf\n${margin} ${yPos} Td\n(${esc(line.slice(2))}) Tj\nET\n`;
      yPos -= 22;
      continue;
    }
    // Wrap dlhé riadky na ~80 znakov
    const maxChars = 80;
    let remaining = line;
    while (remaining.length > 0) {
      let chunk = remaining.slice(0, maxChars);
      if (remaining.length > maxChars) {
        const lastSpace = chunk.lastIndexOf(" ");
        if (lastSpace > 40) chunk = chunk.slice(0, lastSpace);
      }
      stream += `BT\n/F1 11 Tf\n${margin} ${yPos} Td\n(${esc(chunk)}) Tj\nET\n`;
      yPos -= 16;
      if (yPos < margin) break;
      remaining = remaining.slice(chunk.length).trimStart();
    }
  }

  // Manual PDF assembly — replicate naber-pdf style
  const objs: string[] = [];
  objs.push(`<</Type/Catalog/Pages 2 0 R>>`);
  objs.push(`<</Type/Pages/Kids[3 0 R]/Count 1>>`);
  objs.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pageW} ${pageH}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>`);
  objs.push(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
  objs.push(`<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>`);

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

async function fetchObhliadkaContext(id: string) {
  const sb = getSupabaseAdmin();
  const { data: ob } = await sb.from("obhliadky").select("*").eq("id", id).single();
  if (!ob) return null;
  const [nehn, predKlient] = await Promise.all([
    ob.nehnutelnost_id ? sb.from("nehnutelnosti").select("*").eq("id", ob.nehnutelnost_id).maybeSingle() : { data: null },
    ob.predavajuci_klient_id ? sb.from("klienti").select("*").eq("id", ob.predavajuci_klient_id).maybeSingle() : { data: null },
  ]);
  const company = await loadCompany();
  return { ob, nehn: nehn?.data || null, predKlient: predKlient?.data || null, company };
}

function buildLines(ctx: NonNullable<Awaited<ReturnType<typeof fetchObhliadkaContext>>>): string[] {
  const { ob, nehn, predKlient, company } = ctx;
  const lines: string[] = [];

  lines.push(`Spolocnost: ${company.nazov || "Vianema s. r. o."}`);
  if (company.sidlo) lines.push(`Sidlo: ${company.sidlo}`);
  if (company.ico) lines.push(`ICO: ${company.ico}`);
  lines.push("");
  lines.push(`Datum a cas obhliadky: ${fmtDateTime(String(ob.datum))}`);
  if (ob.miesto) lines.push(`Miesto stretnutia: ${String(ob.miesto)}`);
  lines.push("");

  lines.push("# Predavajuci klient");
  lines.push(`Meno: ${predKlient?.meno || "—"}`);
  if (predKlient?.telefon) lines.push(`Telefon: ${predKlient.telefon}`);
  if (predKlient?.email) lines.push(`Email: ${predKlient.email}`);
  lines.push("");

  lines.push("# Predmet obhliadky (nehnutelnost)");
  if (nehn) {
    lines.push(`Nazov: ${String(nehn.nazov || "—")}`);
    lines.push(`Lokalita: ${String(nehn.lokalita || "—")}`);
    if (nehn.cena) lines.push(`Cena: ${Number(nehn.cena).toLocaleString("sk")} EUR`);
    if (nehn.plocha) lines.push(`Plocha: ${nehn.plocha} m2`);
    if (nehn.izby) lines.push(`Izby: ${nehn.izby}`);
  } else {
    lines.push("Nehnutelnost neurcena.");
  }
  lines.push("");

  lines.push("# Kupujuci");
  lines.push(`Meno: ${ob.kupujuci_meno || "—"}`);
  if (ob.kupujuci_telefon) lines.push(`Telefon: ${ob.kupujuci_telefon}`);
  if (ob.kupujuci_email) lines.push(`Email: ${ob.kupujuci_email}`);
  lines.push("");

  lines.push("# Vyhlasenie kupujuceho");
  lines.push("Tymto potvrdzujem, ze nehnutelnost som obhliadol/a v sprievode realitneho maklera spolocnosti Vianema.");
  lines.push("Beriem na vedomie, ze akekolvek dalsie rokovanie ohladom predaja tejto nehnutelnosti budem viest");
  lines.push("vyhradne prostrednictvom tejto realitnej kancelarie. Suhlasim so spracovanim osobnych udajov v zmysle");
  lines.push("GDPR pre ucely evidencie obhliadok.");
  lines.push("");

  if (ob.podpis_data) {
    lines.push(`Podpisane: ${fmtDateTime(String(ob.podpis_datum || ob.created_at))}`);
    lines.push("(Elektronicky podpis kupujuceho je ulozeny v elektronickej evidencii Vianema.)");
  } else {
    lines.push("Status: Neodpisane");
  }
  if (ob.poznamka) {
    lines.push("");
    lines.push(`Poznamka: ${String(ob.poznamka)}`);
  }
  lines.push("");
  lines.push("");
  lines.push(`Vystavene: ${fmtDate(new Date().toISOString())}`);
  lines.push("");
  // Tier 1 patička: AMGD whisper pod Vianema dokumentom
  lines.push("Powered by AMGD");

  return lines;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ctx = await fetchObhliadkaContext(id);
  if (!ctx) return NextResponse.json({ error: "Obhliadka not found" }, { status: 404 });

  const lines = buildLines(ctx);
  const pdf = buildPdf(lines, "Obhliadkovy list");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="obhliadkovy-list-${id.slice(0, 8)}.pdf"`,
    },
  });
}

export async function POST(req: NextRequest) {
  let body: { obhliadkaId?: string; to?: string; maklerMeno?: string; maklerEmail?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  if (!body.obhliadkaId || !body.to) return NextResponse.json({ error: "obhliadkaId and to required" }, { status: 400 });

  const RESEND = process.env.RESEND_API_KEY;
  if (!RESEND) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const ctx = await fetchObhliadkaContext(body.obhliadkaId);
  if (!ctx) return NextResponse.json({ error: "Obhliadka not found" }, { status: 404 });

  const pdf = buildPdf(buildLines(ctx), "Obhliadkovy list");
  const pdfBase64 = pdf.toString("base64");

  const lokalita = String(ctx.nehn?.lokalita || ctx.nehn?.nazov || "nehnutelnost");
  const kupMeno = String(ctx.ob.kupujuci_meno || "klient");

  // FROM adresa: ak je v env nastavený verifikovaný RESEND_FROM (napr.
  // "VIANEMA <noreply@vianema.sk>" po overení domény), použi ho. Inak fallback
  // na Resend default (vždy doručiteľný). replyTo nasmerujeme na makléra,
  // takže odpovede idú jemu.
  const fromAddr = process.env.RESEND_FROM || "VIANEMA <onboarding@resend.dev>";
  const replyTo = body.maklerEmail || undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddr,
      ...(replyTo ? { reply_to: replyTo } : {}),
      to: body.to,
      subject: `Obhliadkovy list — ${esc(lokalita)}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:600px; margin:0 auto;">
          <!-- Tier 1: Vianema dominantná hlavička -->
          <div style="background:#0A0A0A; color:#fff; padding:24px 32px; border-radius:12px 12px 0 0; text-align:center;">
            <div style="font-size:24px; font-weight:500; letter-spacing:-0.03em; line-height:1;">VIANEMA</div>
            <div style="font-size:9px; letter-spacing:0.4em; opacity:0.55; margin-top:4px;">REAL</div>
          </div>
          <div style="background:#f9fafb; padding:32px; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 12px 12px;">
            <p style="margin:0 0 14px; font-size:15px; color:#374151;">Dobry den ${esc(kupMeno)},</p>
            <p style="margin:0 0 14px; font-size:14px; color:#6b7280; line-height:1.6;">
              v prilohe najdete obhliadkovy list pre nehnutelnost <strong>${esc(lokalita)}</strong>, ktoru ste si u nas obhliadli.
            </p>
            <p style="margin:24px 0 0; font-size:14px; color:#374151;">
              S pozdravom,<br/><strong>${esc(body.maklerMeno || "VIANEMA Real")}</strong>
            </p>
            <!-- Tier 1 patička: AMGD whisper -->
            <div style="text-align:center; margin-top:28px; padding-top:16px; border-top:1px solid #e5e7eb; opacity:0.55;">
              <span style="font-size:9px; letter-spacing:0.12em; color:#6b7280;">POWERED BY</span>
              <span style="font-size:11px; font-weight:500; letter-spacing:-0.02em; color:#374151; margin-left:8px;">AMGD</span>
            </div>
          </div>
        </div>
      `,
      attachments: [{ filename: "obhliadkovy-list.pdf", content: pdfBase64 }],
    }),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    return NextResponse.json({ error: `Resend ${res.status}: ${errTxt.slice(0, 200)}` }, { status: 500 });
  }

  // Update obhliadka — email_sent_at
  const sb = getSupabaseAdmin();
  await sb.from("obhliadky").update({
    email_sent_at: new Date().toISOString(),
    email_sent_to: body.to,
    list_pdf_base64: pdfBase64,
  }).eq("id", body.obhliadkaId);

  return NextResponse.json({ ok: true, sent_to: body.to });
}
