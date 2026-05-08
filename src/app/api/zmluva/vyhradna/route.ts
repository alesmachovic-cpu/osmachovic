import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// ── Slovak number-to-words ──────────────────────────────────────────────────
function numberToWords(n: number): string {
  if (n === 0) return "nula";
  if (n < 0) return "mínus " + numberToWords(-n);
  const ones = ["", "jeden", "dva", "tri", "štyri", "päť", "šesť", "sedem", "osem", "deväť",
    "desať", "jedenásť", "dvanásť", "trinásť", "štrnásť", "pätnásť", "šestnásť",
    "sedemnásť", "osemnásť", "devätnásť"];
  const tens = ["", "", "dvadsať", "tridsať", "štyridsat", "päťdesiat",
    "šesťdesiat", "sedemdesiat", "osemdesiat", "deväťdesiat"];
  const h = ["", "sto", "dvesto", "tristo", "štyri sto", "päťsto",
    "šesťsto", "sedemsto", "osemsto", "deväťsto"];
  function below1000(x: number): string {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ones[x % 10] : "");
    return h[Math.floor(x / 100)] + (x % 100 ? below1000(x % 100) : "");
  }
  if (n < 1000) return below1000(n);
  if (n < 2000) return "tisíc" + (n % 1000 ? below1000(n % 1000) : "");
  if (n < 1000000) {
    const t = Math.floor(n / 1000), r = n % 1000;
    return below1000(t) + "tisíc" + (r ? below1000(r) : "");
  }
  const m = Math.floor(n / 1000000), r = n % 1000000;
  const ms = m === 1 ? "milión" : m < 5 ? below1000(m) + " milióny" : below1000(m) + " miliónov";
  return ms + (r ? " " + numberToWords(r) : "");
}

function valueToSlovakWords(val: string): string {
  if (!val) return "";
  const pct = val.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (pct) {
    const n = parseFloat(pct[1].replace(",", "."));
    const pctOnes = ["nula", "jedno", "dve", "tri", "štyri", "päť", "šesť", "sedem",
      "osem", "deväť", "desať", "jedenásť", "dvanásť", "trinásť", "štrnásť", "pätnásť",
      "šestnásť", "sedemnásť", "osemnásť", "devätnásť"];
    if (Number.isInteger(n) && n >= 0 && n < 20) return pctOnes[n] + " percent";
    return val;
  }
  const num = val.replace(/\s/g, "").replace(",", ".");
  const parsed = parseFloat(num);
  if (!isNaN(parsed) && parsed === Math.floor(parsed)) {
    return numberToWords(Math.floor(parsed)) + " eur";
  }
  return "";
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const body = await req.json();
    const { klient_id, naber_id, overrides } = body as {
      klient_id: string;
      naber_id?: string;
      overrides: Record<string, string>;
    };

    // Načítaj klienta (bez join — zvlášť makler)
    const { data: klient, error: kErr } = await supabase
      .from("klienti")
      .select("*")
      .eq("id", klient_id)
      .single();
    if (kErr || !klient) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });

    // Makler meno
    let maklerMeno = "";
    if (klient.makler_id) {
      const { data: maklerData } = await supabase
        .from("makleri").select("meno").eq("id", klient.makler_id).single();
      maklerMeno = maklerData?.meno ?? "";
    }

    // Náberový list
    let naber: Record<string, unknown> | null = null;
    if (naber_id) {
      const { data } = await supabase.from("naberove_listy").select("*").eq("id", naber_id).single();
      naber = data;
    } else {
      const { data } = await supabase.from("naberove_listy").select("*")
        .eq("klient_id", klient_id).order("created_at", { ascending: false }).limit(1).single();
      naber = data;
    }
    if (!maklerMeno) maklerMeno = (naber?.makler as string | null) ?? "";

    // lv_data — owners
    const lv = (klient.lv_data ?? {}) as Record<string, unknown>;
    const majitelia = (lv.majitelia as Array<{
      meno?: string; podiel?: string; datum_narodenia?: string; adresa?: string;
    }> | undefined) ?? [];

    function ownerLine(i: number) {
      const m = majitelia[i]; if (!m) return "";
      return m.podiel ? `${m.meno} (podiel: ${m.podiel})` : (m.meno ?? "");
    }
    function ownerDate(i: number) { return majitelia[i]?.datum_narodenia ?? ""; }
    function ownerBytom(i: number) { return majitelia[i]?.adresa ?? ""; }

    const obec = String(lv.obec ?? naber?.obec ?? "");
    const katUzemie = String(lv.katastralneUzemie ?? naber?.kat_uzemie ?? "");
    const okres = String(lv.okres ?? naber?.okres ?? "");
    const predajnaCena = naber?.predajna_cena ? String(naber.predajna_cena) : "";
    const provizia = naber?.provizia ? String(naber.provizia) : "";
    const dnes = new Date().toLocaleDateString("sk-SK", { day: "numeric", month: "long", year: "numeric" });

    // Vlastníci — z1 až z6
    const ownerData: Record<string, string> = {};
    for (let i = 0; i < 6; i++) {
      const n = i + 1;
      ownerData[`z${n}_meno`] = ownerLine(i);
      ownerData[`z${n}_datum_nar`] = ownerDate(i);
      ownerData[`z${n}_rodne_cislo`] = "";
      ownerData[`z${n}_bytom`] = ownerBytom(i);
      ownerData[`z${n}_kontakt`] = i === 0
        ? `${klient.email ?? ""}, ${klient.telefon ?? ""}`.replace(/^, |, $/, "")
        : "";
    }

    const data: Record<string, string> = {
      ...ownerData,
      makler_zastupena: maklerMeno,
      ok_urad: `Okresný úrad ${okres}`,
      ok_okres: okres,
      ok_obec: obec,
      ok_kat_uzemie: katUzemie,
      pozadovana_cena: predajnaCena,
      zmluva_mesiacov: "6",
      predlzenie_mesiacov: "3",
      provizia: provizia,
      provizia_slovom: valueToSlovakWords(provizia),
      znizenie_dni: "30",
      znizenie_cena: "",
      dodatocna_provizia: "",
      miesto_podpisu: obec || "Bratislava",
      datum_podpisu: dnes,
      rovnopisy: String(1 + (majitelia.filter(m => m.meno).length || 1)),
      ...overrides,
    };

    // Ak provizia_slovom stále prázdna, auto-generuj
    if (!data.provizia_slovom && data.provizia) {
      data.provizia_slovom = valueToSlovakWords(data.provizia);
    }

    const templatePath = path.join(process.cwd(), "public/templates/vyhradna-zmluva-template.docx");
    const templateBuf = readFileSync(templatePath);
    const zip = new PizZip(templateBuf);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{", end: "}" },
    });
    doc.render(data);

    const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
    const filename = `Vyhradna_zmluva_${(klient.meno as string ?? "klient").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.docx`;

    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("zmluva/vyhradna error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
