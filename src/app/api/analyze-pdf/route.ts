import { NextRequest } from "next/server";
import { jsPDF } from "jspdf";

export const runtime = "nodejs";

/**
 * POST /api/analyze-pdf
 * Body: { extracted, analysis, url? }
 *
 * Vyrobí jednostranový (alebo dvojstranový) PDF reportu analýzy nehnuteľnosti.
 * Použitie: po analýze cez /api/analyze-url alebo deep dive z portfólia
 * frontend pošle ten istý JSON do tohto endpointu a dostane PDF na stiahnutie.
 *
 * Pozn.: jsPDF má štandardné fonty (Helvetica) ktoré nepokrývajú všetky SK
 * diakritiky bezchybne — preto pre niektoré znaky používame transliteráciu
 * cestou stripDiacritics. Pre 99% prípadov to vyzerá dobre; ak by vznikla
 * potreba plnej diakritiky, treba doplniť TTF font (napr. DejaVu Sans).
 */

interface Analysis {
  zaklad?: { cena?: number; plocha?: number; eurM2?: number; benchmark?: number; odchylka?: number; stav?: string };
  benchmark_zdroj?: string;
  hypoteka?: {
    istina?: number; mesacna_splatka?: number; celkova_nakup?: number;
    hotovost_potrebna?: number; potrebny_prijem?: number;
    ltv?: string; urok?: string; roky?: number;
  } | null;
  ai?: {
    verdikt?: string;
    silne_stranky?: string[];
    slabe_stranky?: string[];
    odporucanie?: string;
    cielova_skupina?: string;
    cas_predaja?: string;
    vyjednavacie_argumenty?: string[];
  };
}

interface Extracted {
  nazov?: string | null;
  typ_nehnutelnosti?: string | null;
  lokalita?: string | null;
  cena?: number | null;
  plocha?: number | null;
  izby?: number | null;
  stav?: string | null;
  popis?: string | null;
  predajca?: string | null;
}

const VERDIKT_LABELS: Record<string, string> = {
  podhodnotene: "PODHODNOTENA",
  trhova_cena: "TRHOVA CENA",
  nadhodnotene: "NADHODNOTENA",
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("sk-SK");
}
function eur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${fmt(n)} EUR`;
}

export async function POST(req: NextRequest) {
  let body: { extracted?: Extracted; analysis?: Analysis; url?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Neplatný JSON" }, { status: 400 }); }

  const e: Extracted = body.extracted || {};
  const a: Analysis = body.analysis || {};
  const url = body.url || "";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18;
  let y = M;

  // ── Hlavička
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("VIANEMA REAL", M, y);
  y += 6;
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(stripDiacritics("Analyza nehnutelnosti"), M, y);
  doc.setTextColor(0);
  y += 4;
  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 8;

  // ── Identifikácia inzerátu
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(stripDiacritics(e.nazov || e.typ_nehnutelnosti || "Nehnutelnost"), M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  if (e.lokalita) { doc.text(stripDiacritics(e.lokalita), M, y); y += 5; }
  if (url) {
    const splittedUrl = doc.splitTextToSize(url, W - 2 * M);
    doc.setTextColor(60, 90, 180);
    doc.text(splittedUrl, M, y);
    y += splittedUrl.length * 4 + 2;
    doc.setTextColor(0);
  }
  doc.setTextColor(0);
  y += 4;

  // ── Verdikt box (full width)
  const verdiktKey = a.ai?.verdikt || a.zaklad?.stav || "trhova_cena";
  const verdiktLabel = VERDIKT_LABELS[verdiktKey] || verdiktKey.toUpperCase();
  const verdiktColor: [number, number, number] =
    verdiktKey === "podhodnotene" ? [76, 175, 80] :
    verdiktKey === "nadhodnotene" ? [244, 67, 54] :
    [120, 120, 120];
  doc.setFillColor(...verdiktColor);
  doc.rect(M, y, W - 2 * M, 12, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(verdiktLabel, M + 4, y + 8);
  const odch = a.zaklad?.odchylka ?? 0;
  doc.setFontSize(11);
  const odchTxt = `${odch > 0 ? "+" : ""}${odch}% voci trhu`;
  doc.text(odchTxt, W - M - 4 - doc.getTextWidth(odchTxt), y + 8);
  doc.setTextColor(0);
  y += 18;

  // ── Základné údaje (2-stĺpcová tabuľka)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(stripDiacritics("Zakladne udaje"), M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const rows1: [string, string][] = [
    ["Cena", eur(a.zaklad?.cena ?? e.cena ?? null)],
    ["Plocha", e.plocha ? `${fmt(e.plocha)} m2` : "—"],
    ["EUR/m2", eur(a.zaklad?.eurM2 ?? null)],
    ["Trhovy benchmark", `${eur(a.zaklad?.benchmark ?? null)}/m2`],
    ["Pocet izieb", e.izby != null ? String(e.izby) : "—"],
    ["Stav", stripDiacritics(e.stav || "—")],
  ];
  const colW = (W - 2 * M) / 2;
  rows1.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * colW;
    const yy = y + row * 7;
    doc.setTextColor(120);
    doc.text(stripDiacritics(r[0]), x, yy);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(stripDiacritics(r[1]), x + 38, yy);
    doc.setFont("helvetica", "normal");
  });
  y += Math.ceil(rows1.length / 2) * 7 + 4;

  if (a.benchmark_zdroj) {
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(stripDiacritics(`Zdroj benchmarku: ${a.benchmark_zdroj}`), M, y);
    doc.setTextColor(0);
    y += 6;
  }

  // ── Hypotéka box
  if (a.hypoteka) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(stripDiacritics(`Hypoteka (${a.hypoteka.ltv} LTV, ${a.hypoteka.urok} urok, ${a.hypoteka.roky} rokov)`), M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const rows2: [string, string][] = [
      ["Mesacna splatka", eur(a.hypoteka.mesacna_splatka)],
      ["Potrebna hotovost", eur(a.hypoteka.hotovost_potrebna)],
      ["Potrebny prijem", `${eur(a.hypoteka.potrebny_prijem)}/mesiac`],
      ["Celkova suma za uver", eur(a.hypoteka.celkova_nakup)],
    ];
    rows2.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = M + col * colW;
      const yy = y + row * 7;
      doc.setTextColor(120);
      doc.text(stripDiacritics(r[0]), x, yy);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(stripDiacritics(r[1]), x + 45, yy);
      doc.setFont("helvetica", "normal");
    });
    y += Math.ceil(rows2.length / 2) * 7 + 6;
  }

  // ── AI hodnotenie (page break ak treba)
  if (y > 220) { doc.addPage(); y = M; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(stripDiacritics("AI hodnotenie"), M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const renderBulletList = (title: string, items: string[] | undefined, color: [number, number, number]) => {
    if (!items || items.length === 0) return;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(stripDiacritics(title), M, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    y += 5;
    items.forEach(it => {
      const lines = doc.splitTextToSize(`• ${stripDiacritics(it)}`, W - 2 * M - 4);
      doc.text(lines, M + 2, y);
      y += lines.length * 4 + 1;
    });
    y += 2;
  };

  renderBulletList("Silne stranky", a.ai?.silne_stranky, [56, 142, 60]);
  renderBulletList("Slabe stranky", a.ai?.slabe_stranky, [211, 47, 47]);
  renderBulletList("Vyjednavacie argumenty", a.ai?.vyjednavacie_argumenty, [25, 118, 210]);

  if (a.ai?.odporucanie) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.text(stripDiacritics("Odporucanie"), M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(stripDiacritics(a.ai.odporucanie), W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 4 + 4;
  }

  // ── Compact info riadky
  if (a.ai?.cielova_skupina || a.ai?.cas_predaja) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    if (a.ai?.cielova_skupina) {
      doc.text(stripDiacritics(`Cielova skupina: ${a.ai.cielova_skupina}`), M, y);
      y += 4;
    }
    if (a.ai?.cas_predaja) {
      doc.text(stripDiacritics(`Odhad casu predaja: ${a.ai.cas_predaja}`), M, y);
      y += 4;
    }
    doc.setTextColor(0);
  }

  // ── Päta
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    const ts = new Date().toLocaleString("sk-SK", { dateStyle: "long", timeStyle: "short" });
    doc.text(stripDiacritics(`Vygenerovane ${ts} • VIANEMA Real CRM • Strana ${p}/${pageCount}`), M, 290);
    doc.setTextColor(0);
  }

  const pdfBytes = doc.output("arraybuffer");
  const fname = `analyza_${stripDiacritics((e.nazov || e.lokalita || "nehnutelnost").toLowerCase().replace(/[^a-z0-9]+/g, "_")).slice(0, 40)}.pdf`;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
