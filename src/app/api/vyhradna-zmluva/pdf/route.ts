import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getFirmaInfo } from "@/lib/getFirmaInfo";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

type Majitel = { meno?: string; datum_narodenia?: string; rc?: string; bydlisko?: string; email?: string; telefon?: string };
type Stavba = { druh?: string; supisne_cislo?: string; cislo_bytu?: string; lv_cislo?: string; podiel?: string };
type Pozemok = { cislo_parcely?: string; vymera?: string; druh?: string; lv_cislo?: string; podiel?: string };

function esc(s: string): string {
  return (s || "").replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, c => {
    const map: Record<string, string> = {
      "á":"a","ä":"a","č":"c","ď":"d","é":"e","ě":"e","í":"i","ĺ":"l","ľ":"l","ň":"n","ó":"o","ô":"o","ŕ":"r","ř":"r","š":"s","ť":"t","ú":"u","ů":"u","ý":"y","ž":"z",
      "Á":"A","Ä":"A","Č":"C","Ď":"D","É":"E","Ě":"E","Í":"I","Ĺ":"L","Ľ":"L","Ň":"N","Ó":"O","Ô":"O","Ŕ":"R","Ř":"R","Š":"S","Ť":"T","Ú":"U","Ů":"U","Ý":"Y","Ž":"Z",
      "€":"EUR","–":"-","—":"-","„":"\"","“":"\"","‚":"'","'":"'"," ":" ","°":"°",
    };
    return map[c] || "?";
  });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "....................";
  try { return new Date(iso).toLocaleDateString("sk", { day: "numeric", month: "long", year: "numeric" }); } catch { return iso; }
}

function fmtMoney(n?: number | null): string {
  if (!n) return "....................";
  return n.toLocaleString("sk") + ",-";
}

// ── Raw PDF builder ──────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LH = 14;

interface Page { stream: string; y: number }

function newPage(): Page {
  return { stream: "", y: PAGE_H - MARGIN - 10 };
}

function checkSpace(page: Page, pages: Page[], needed: number) {
  if (page.y - needed < MARGIN + 20) {
    pages.push(page);
    const p = newPage();
    page.stream = p.stream;
    page.y = p.y;
  }
}

function text(page: Page, x: number, y: number, size: number, s: string, bold = false) {
  const font = bold ? "/F2" : "/F1";
  page.stream += `BT\n${font} ${size} Tf\n${x} ${y} Td\n(${esc(s)}) Tj\nET\n`;
}

function grayText(page: Page, x: number, y: number, size: number, s: string, gray: number) {
  page.stream += `BT\n/F1 ${size} Tf\n${gray} g\n${x} ${y} Td\n(${esc(s)}) Tj\n0 g\nET\n`;
}

function line(page: Page, x1: number, y1: number, x2: number, y2: number, gray = 0.7) {
  page.stream += `q\n${gray} g\n${x1} ${y1} m\n${x2} ${y2} l\nS\nQ\n`;
}

function rect(page: Page, x: number, y: number, w: number, h: number, gray: number) {
  page.stream += `q\n${gray} g\n${x} ${y} ${w} ${h} re\nf\nQ\n`;
}

function sectionHeading(page: Page, pages: Page[], title: string) {
  checkSpace(page, pages, 30);
  page.y -= 10;
  rect(page, MARGIN, page.y - 2, CONTENT_W, LH + 6, 0.93);
  text(page, MARGIN + 4, page.y + 2, 9, title, true);
  page.y -= LH + 8;
}

function labelValue(page: Page, pages: Page[], label: string, value: string) {
  checkSpace(page, pages, LH + 2);
  grayText(page, MARGIN, page.y, 8, label + ":", 0.55);
  text(page, MARGIN + 130, page.y, 9, value, false);
  page.y -= LH + 2;
}

function paragraph(page: Page, pages: Page[], lines: string[], size = 9) {
  for (const ln of lines) {
    checkSpace(page, pages, LH);
    text(page, MARGIN, page.y, size, ln);
    page.y -= LH + 1;
  }
}

function wrapText(s: string, maxChars: number): string[] {
  const words = s.split(/\s+/);
  const result: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      result.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) result.push(cur);
  return result;
}

// ── Build PDF ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: z, error } = await sb.from("vyhradne_zmluvy").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!z) return NextResponse.json({ error: "Nenájdená" }, { status: 404 });

  const firma = await getFirmaInfo();

  const majitelia = (z.majitelia as Majitel[]) || [];
  const stavby = (z.stavby as Stavba[]) || [];
  const pozemky = (z.pozemky as Pozemok[]) || [];

  const pages: Page[] = [];
  const page = newPage();
  page.y = PAGE_H - MARGIN;

  // ── HLAVIČKA ──
  rect(page, 0, PAGE_H - 52, PAGE_W, 52, 0.14);
  text(page, MARGIN, PAGE_H - 22, 14, "ZMLUVA O VYHRADNOM SPROSTREDKOVANI", true);
  page.stream += `BT\n/F1 8 Tf\n1 g\n${MARGIN} ${PAGE_H - 36} Td\n(PREDAJA NEHNUTELNOSTI) Tj\n0 g\nET\n`;
  page.stream += `BT\n/F1 8 Tf\n1 g\n${MARGIN} ${PAGE_H - 47} Td\n(v zmysle zakona c. 40/1964 Zb. Obciansky zakonnik) Tj\n0 g\nET\n`;
  const datumStr = fmtDate(z.datum_zacatia);
  grayText(page, PAGE_W - MARGIN - 130, PAGE_H - 36, 8, datumStr, 0.5);
  page.y = PAGE_H - 70;

  // ── ZÁUJEMCOVIA ──
  const mCount = majitelia.length || 1;
  for (let i = 0; i < mCount; i++) {
    const m = majitelia[i] || {};
    sectionHeading(page, pages, `ZAUJEMCA ${mCount > 1 ? i + 1 : ""}`.trim());
    labelValue(page, pages, "Meno a priezvisko", m.meno || "..................................");
    labelValue(page, pages, "Datum narodenia", m.datum_narodenia || "..................................");
    labelValue(page, pages, "Rodne cislo", m.rc || "..................................");
    labelValue(page, pages, "Bytom (trvaly pobyt)", m.bydlisko || "..................................");
    labelValue(page, pages, "Mail / telefon", [m.email, m.telefon].filter(Boolean).join("  |  ") || "..................................");
    grayText(page, MARGIN + 130, page.y + 2, 8, "obcan SR    (dalej ako \"Zaujemca\")", 0.55);
    page.y -= LH + 4;
  }

  // ── SPROSTREDKOVATEĽ ──
  sectionHeading(page, pages, "SPROSTREDKOVATEL");
  labelValue(page, pages, "Obchodne meno", firma.nazov || "Vianema s. r. o.");
  labelValue(page, pages, "Sidlo", firma.sidlo);
  labelValue(page, pages, "ICO", firma.ico);
  labelValue(page, pages, "Zastupena", z.zastupena_meno || "............................................");
  labelValue(page, pages, "Zapisana v OR", "OR " + (firma.registracia || "MS Bratislava III, odd. Sro, vl. c. 123596/B"));
  grayText(page, MARGIN + 130, page.y + 2, 8, "(dalej ako \"Sprostredkovatel\")", 0.55);
  page.y -= LH + 6;

  // ── ČL. I — NEHNUTEĽNOSŤ ──
  sectionHeading(page, pages, "CL. I — PREDMET ZMLUVY / NEHNUTELNOST");
  if (z.okres) labelValue(page, pages, "Okresny urad / okres", z.okres);
  if (z.obec) labelValue(page, pages, "Obec", z.obec);
  if (z.kat_uzemie) labelValue(page, pages, "Katastralne uzemie", z.kat_uzemie);

  // Tabuľka stavby
  if (stavby.length > 0) {
    checkSpace(page, pages, 20 + stavby.length * (LH + 2));
    page.y -= 4;
    grayText(page, MARGIN, page.y, 7, "DRUH", 0.5);
    grayText(page, MARGIN + 80, page.y, 7, "SUPISNE C.", 0.5);
    grayText(page, MARGIN + 155, page.y, 7, "BYT", 0.5);
    grayText(page, MARGIN + 210, page.y, 7, "LV", 0.5);
    grayText(page, MARGIN + 270, page.y, 7, "PODIEL", 0.5);
    page.y -= LH;
    line(page, MARGIN, page.y + LH - 2, PAGE_W - MARGIN, page.y + LH - 2, 0.8);
    for (const s of stavby) {
      checkSpace(page, pages, LH + 2);
      text(page, MARGIN, page.y, 8, s.druh || "Byt");
      text(page, MARGIN + 80, page.y, 8, s.supisne_cislo || "—");
      text(page, MARGIN + 155, page.y, 8, s.cislo_bytu || "—");
      text(page, MARGIN + 210, page.y, 8, s.lv_cislo || "—");
      text(page, MARGIN + 270, page.y, 8, s.podiel || "1/1");
      page.y -= LH + 2;
    }
    page.y -= 4;
  }

  // Tabuľka pozemky
  if (pozemky.length > 0) {
    checkSpace(page, pages, 20 + pozemky.length * (LH + 2));
    page.y -= 4;
    grayText(page, MARGIN, page.y, 7, "PARCELA", 0.5);
    grayText(page, MARGIN + 90, page.y, 7, "VYMERA (m2)", 0.5);
    grayText(page, MARGIN + 180, page.y, 7, "DRUH POZEMKU", 0.5);
    grayText(page, MARGIN + 310, page.y, 7, "LV", 0.5);
    grayText(page, MARGIN + 360, page.y, 7, "PODIEL", 0.5);
    page.y -= LH;
    line(page, MARGIN, page.y + LH - 2, PAGE_W - MARGIN, page.y + LH - 2, 0.8);
    for (const p of pozemky) {
      checkSpace(page, pages, LH + 2);
      text(page, MARGIN, page.y, 8, p.cislo_parcely || "—");
      text(page, MARGIN + 90, page.y, 8, p.vymera || "—");
      text(page, MARGIN + 180, page.y, 8, p.druh || "—");
      text(page, MARGIN + 310, page.y, 8, p.lv_cislo || "—");
      text(page, MARGIN + 360, page.y, 8, p.podiel || "1/1");
      page.y -= LH + 2;
    }
    page.y -= 4;
  }

  // Požadovaná cena
  page.y -= 6;
  checkSpace(page, pages, 50);
  text(page, MARGIN, page.y, 9, "Pozadovana cena:", true);
  page.y -= LH + 2;
  const cenaTxt = z.pozadovana_cena ? fmtMoney(z.pozadovana_cena) + " EUR" : "...........................,- EUR";
  text(page, MARGIN + 6, page.y, 9, "a) Suma, ktora ma byt Zaujemcovi vyplatena: " + cenaTxt);
  page.y -= LH + 1;

  if (z.moznost_znizenia_dni && z.suma_znizenia) {
    text(page, MARGIN + 6, page.y, 9, `b) Ak do ${z.moznost_znizenia_dni} dni nebude uzavreta Rezervacna zmluva, moznost znizenia o ${fmtMoney(z.suma_znizenia)} EUR`);
    page.y -= LH + 1;
  }
  page.y -= 4;

  // ── ČL. II — TERMÍN ──
  sectionHeading(page, pages, "CL. II — TERMIN PLNENIA");
  text(page, MARGIN, page.y, 9, `Tato Zmluva sa uzatvara na dobu uritu ${z.trvanie_mesiacov || "..."} mesiacov s platnostou odo dna podpisu.`);
  page.y -= LH + 2;
  text(page, MARGIN, page.y, 9, `Automaticke predlzenie o ${z.predlzenie_mesiacov || "..."} mesiace, ak Zmluvna strana pisomne neoznami opak 1 mesiac pred uplynutim.`);
  page.y -= LH + 8;

  // ── ČL. III — ODMENA ──
  sectionHeading(page, pages, "CL. III — ODMENA ZA SPROSTREDKOVANIE");
  const provText = z.provizna_text || ".....................";
  const provSlovom = z.provizna_slovom ? ` (slovom: ${z.provizna_slovom})` : "";
  text(page, MARGIN, page.y, 9, `1. Zaujemca sa zavazuje zaplatit Sprostredkovatelovi Provizju vo vyske ${provText}${provSlovom}.`);
  page.y -= LH + 2;
  if (z.dodatocna_provizna) {
    text(page, MARGIN, page.y, 9, `2. Dodatocna provizja: ${z.dodatocna_provizna} z rozdielu Kupnej ceny a suctu Pozadovanej ceny a Provizje.`);
    page.y -= LH + 2;
  }
  text(page, MARGIN, page.y, 9, "3. Narok na Provizju vznikne po uzavreti Rezervacnej zmluvy alebo Sprostredkuvanej zmluvy.");
  page.y -= LH + 8;

  // ── ČL. IV–VIII — BOILERPLATE ──
  sectionHeading(page, pages, "CL. IV — PRAVA A POVINNOSTI ZAUJEMCU");
  const cl4 = [
    "Zaujemca sa zavazuje poskytnout sucinnost (osobna ucast, doklady, spravnost udajov). Suhlasi so zriadenim",
    "zalozneho prava ak je kupna cena financovana hypotekarnym uverom banky. Dava suhlas na vizualne",
    "zdokumentovanie Nehnutelnosti (video, fotografie, dron).",
    "Zaujemca je povinny zpristupnit Nehnutelnost na obhliadky a bezodkladne informovat Sprostredkovatela",
    "o vsetkych skutocnostiach rozhodujucich pre plnenie Zmluvy.",
  ];
  paragraph(page, pages, cl4);
  page.y -= 4;

  sectionHeading(page, pages, "CL. V — PRAVA A POVINNOSTI SPROSTREDKOVATELA");
  const cl5 = [
    "Sprostredkovatel zabezpeci kompletny pravny servis vratan: navrhu Sprostredkuvanej zmluvy, navrhu na",
    "vklad vlastnickeho prava do katastra a uhradi poplatky za zapis v nezrychlenom konani.",
    "Sprostredkovatel sa zavazuje riadne vykonavat sprostredkovanie a priebezne informovat Zaujemcu.",
    "Sprostredkovatel prezentuje Nehnutelnost vhodnou formou propagacie na vlastne naklady.",
  ];
  paragraph(page, pages, cl5);
  page.y -= 4;

  sectionHeading(page, pages, "CL. VI — VSEOBECNE USTANOVENIA");
  const cl6 = [
    "Ak Sprostredkovatel sprostredkuje uzavretie zmluvy podla poziadaviek Zaujemcu, je Zaujemca povinny",
    "uzavriet Sprostredkuvanu zmluvu. Zaujemca suhlasi so zverejnenim udajov o Nehnutelnosti vo verejnych",
    "mediach. Tarchy a zalozne prava vporiadane pred vkladom do katastra (ak nie je dohodou ine).",
    "Zaujemca splnomocnuje Sprostredkovatela na vykony potrebne na naplnenie ucelu Zmluvy (komunikacia",
    "s uradmi, podavanie ziadosti) — bez prava prevodu alebo zatazenia Nehnutelnosti.",
  ];
  paragraph(page, pages, cl6);
  page.y -= 4;

  sectionHeading(page, pages, "CL. VII — ZMLUVNE POKUTY");
  const cl7 = [
    "Pri predcasnom ukonceni z dovodov na strane Zaujemcu: zmluvna pokuta = vyska Provizje.",
    "Ak Zaujemca preda Nehnutelnost bez spolupusobenia Sprostredkovatela pocas platnosti Zmluvy:",
    "  zmluvna pokuta = vyska Provizje (splatna do 5 dni od vyuctovania).",
    "Narok na Provizju trvá aj po ukonceni Zmluvy (do 1 roka) ak kupujuceho zaistil Sprostredkovatel.",
    "Omeskanie: 0,05 % z dlznej sumy za kazdy zacaty den omeskania.",
  ];
  paragraph(page, pages, cl7);
  page.y -= 4;

  sectionHeading(page, pages, "CL. VIII — ZAVERECNE USTANOVENIA");
  const cl8 = [
    "Zaujemca ako dotknutá osoba potvrdzuje, ze bol informovany o spracuvani osobnych udajov a jeho pravach",
    "podla zakona c. 18/2018 Z.z. (prava na pristup, opravu, vymazanie, obmedzenie, prenositelnost, namietanie).",
    "Zmluva nadobuda platnost a ucinnost dnom podpisu vsetkymi Zmluvnymi stranami.",
    `Vyhotovuje sa v ${z.pocet_rovnopisov || 2} rovnopisoch, kazdy ma platnost originálu.`,
    "Zmeny a doplnky mozno robit len pisomnymi a cronologicky ocislovanymi dodatkami.",
    "Zaujemca, ak je spotrebitelom, potvrdzuje ze bol informovany o prave odstupit podla § 19 zakona",
    "c. 108/2024 Z.z. a ze dostal formular na odstupenie od Zmluvy.",
    "Zaujemca vyhlasuje, ze jeho sposobilosť na pravne ukony nie je nicom obmedzena, Zmluva obsahuje",
    "jeho slobodnu, vaznu a zrozumitelnu volu uzatvoritú nie v tiesni ani za napadne nevyhodnych podmienok.",
  ];
  paragraph(page, pages, cl8);
  page.y -= 8;

  // ── PODPISY ──
  checkSpace(page, pages, 100);
  page.y -= 10;
  line(page, MARGIN, page.y, PAGE_W - MARGIN, page.y, 0.85);
  page.y -= 16;

  const lokalita = [z.obec, "dna"].filter(Boolean).join(", ") + " " + fmtDate(z.datum_zacatia);
  text(page, MARGIN, page.y, 9, "V " + lokalita);
  page.y -= LH + 16;

  // Podpis záujemcu
  const podpisY = page.y;
  for (let i = 0; i < mCount; i++) {
    const m = majitelia[i] || {};
    const xOff = MARGIN + i * 160;
    if (xOff + 120 > PAGE_W - MARGIN) break;
    line(page, xOff, podpisY - 10, xOff + 120, podpisY - 10, 0.5);
    text(page, xOff, podpisY - 22, 8, "Zaujemca");
    if (m.meno) text(page, xOff, podpisY - 34, 8, m.meno);
  }

  // Podpis Sprostredkovateľa
  const spX = PAGE_W - MARGIN - 140;
  if (z.podpis_data) {
    text(page, spX, podpisY + 4, 7, "[Podpisane elektronicky]", false);
  }
  line(page, spX, podpisY - 10, spX + 130, podpisY - 10, 0.5);
  text(page, spX, podpisY - 22, 8, "Sprostredkovatel");
  text(page, spX, podpisY - 34, 8, firma.nazov || "Vianema s. r. o.");
  if (z.zastupena_meno) text(page, spX, podpisY - 46, 7, z.zastupena_meno);

  page.y = podpisY - 60;

  // Elektronický podpis blok
  if (z.podpisane_at) {
    page.y -= 8;
    checkSpace(page, pages, 50);
    line(page, MARGIN, page.y + 4, PAGE_W - MARGIN, page.y + 4, 0.85);
    page.y -= 14;
    text(page, MARGIN, page.y, 8, "Podpisane elektronicky cez OTP overenie:", true);
    page.y -= LH;
    const meta = z.podpis_meta as Record<string, string> | null;
    text(page, MARGIN, page.y, 8, `Datum: ${fmtDate(z.podpisane_at)}   Metoda: ${meta?.method || "email_otp"}   IP: ${meta?.ip || "—"}`);
    page.y -= LH;
    grayText(page, MARGIN, page.y, 7, "Tento dokument bol podpisany elektronicky a je pravne zavazny.", 0.5);
    page.y -= LH + 4;
  }

  // ── PRÍLOHA 1 — KĽÚČE ──
  pages.push(page);
  const priloha = newPage();
  priloha.y = PAGE_H - MARGIN;

  rect(priloha, 0, PAGE_H - 40, PAGE_W, 40, 0.14);
  priloha.stream += `BT\n/F2 13 Tf\n1 g\n${MARGIN} ${PAGE_H - 26} Td\n(PRILOHA C. 1 — PREVZATE KLUCE) Tj\n0 g\nET\n`;
  priloha.y = PAGE_H - 60;

  text(priloha, MARGIN, priloha.y, 9, "Sprostredkovatel potvrdzuje, ze od Zaujemcu prevzal:");
  priloha.y -= LH + 4;
  text(priloha, MARGIN, priloha.y, 9, `Kluce: ${z.kluče_ks ? z.kluče_ks + " ks" : ".......... ks"}`);
  priloha.y -= LH + 4;
  if (z.kluče_poznamka) {
    for (const ln of wrapText(z.kluče_poznamka, 90)) {
      text(priloha, MARGIN, priloha.y, 9, ln);
      priloha.y -= LH + 1;
    }
  } else {
    for (let i = 0; i < 5; i++) {
      line(priloha, MARGIN, priloha.y, PAGE_W - MARGIN, priloha.y, 0.8);
      priloha.y -= LH + 8;
    }
  }
  pages.push(priloha);

  // Footer na každej strane
  for (const p of pages) {
    p.stream += `BT\n/F1 7 Tf\n0.65 g\n${MARGIN} 20 Td\n(${esc(firma.nazov)} | Zmluva o vyhradnom sprostredkovani | www.vianema.sk) Tj\n0 g\nET\n`;
  }

  // ── Zostavenie PDF ──────────────────────────────────────────────────────────
  const objects: string[] = [];
  let oc = 0;
  const offsets: number[] = [];

  function addObj(content: string): number {
    oc++;
    objects.push(content);
    return oc;
  }

  const pageCount = pages.length;
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj(""); // pages dict placeholder
  // Font objs
  addObj("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj");
  addObj("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj");

  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];

  for (let i = 0; i < pageCount; i++) {
    const contentId = addObj("");
    contentObjIds.push(contentId);
    const pageId = addObj("");
    pageObjIds.push(pageId);
  }

  // Fill content streams
  for (let i = 0; i < pageCount; i++) {
    const stream = pages[i].stream;
    const bytes = Buffer.from(stream, "binary");
    objects[contentObjIds[i] - 1] = `${contentObjIds[i]} 0 obj\n<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream\nendobj`;
  }

  // Fill page objs
  for (let i = 0; i < pageCount; i++) {
    objects[pageObjIds[i] - 1] = `${pageObjIds[i]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentObjIds[i]} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj`;
  }

  // Fill pages dict
  const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageCount} >>\nendobj`;

  // Build byte output
  const header = "%PDF-1.4\n";
  const parts: Buffer[] = [Buffer.from(header)];
  let offset = header.length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    const obj = objects[i] + "\n";
    const buf = Buffer.from(obj, "binary");
    parts.push(buf);
    offset += buf.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, "0") + " 00000 n \n";

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref + trailer, "binary"));

  const pdf = Buffer.concat(parts);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vyhradna-zmluva.pdf"`,
    },
  });
}
