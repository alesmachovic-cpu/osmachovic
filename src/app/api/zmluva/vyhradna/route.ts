import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

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
      // Polia ktoré makler doplní v modali (rodné čísla, bytom, atď.)
      overrides: Record<string, string>;
    };

    // Načítaj klienta + makléra
    const { data: klient, error: kErr } = await supabase
      .from("klienti")
      .select("*, makleri(meno)")
      .eq("id", klient_id)
      .single();
    if (kErr || !klient) return NextResponse.json({ error: "Klient nenájdený" }, { status: 404 });

    // Náberový list — vyber posledný alebo konkrétny
    let naber: Record<string, unknown> | null = null;
    if (naber_id) {
      const { data } = await supabase.from("naberove_listy").select("*").eq("id", naber_id).single();
      naber = data;
    } else {
      const { data } = await supabase
        .from("naberove_listy")
        .select("*")
        .eq("klient_id", klient_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      naber = data;
    }

    // lv_data — owners
    const lv = (klient.lv_data ?? {}) as Record<string, unknown>;
    const majitelia = (lv.majitelia as Array<{ meno?: string; podiel?: string; datum_narodenia?: string }> | undefined) ?? [];

    // Formát: meno (podiel) alebo len meno
    function ownerLine(i: number) {
      const m = majitelia[i];
      if (!m) return "";
      return m.podiel ? `${m.meno} (podiel: ${m.podiel})` : (m.meno ?? "");
    }
    function ownerDate(i: number) {
      return majitelia[i]?.datum_narodenia ?? "";
    }

    // Makler meno — z JOIN alebo priamo z naberaku
    const maklerMeno =
      (klient.makleri as { meno?: string } | null)?.meno ??
      (naber?.makler as string | null) ??
      "";

    // Nehnuteľnosť — preferuj lv_data, fallback naberák
    const obec = String(lv.obec ?? naber?.obec ?? "");
    const ulica = String(lv.ulica ?? naber?.ulica ?? "");
    const supisneCislo = String(lv.supisne_cislo ?? naber?.supisne_cislo ?? "");
    const katUzemie = String(lv.katastralneUzemie ?? naber?.kat_uzemie ?? "");
    const okres = String(lv.okres ?? naber?.okres ?? "");

    // Cena a provízia z náberáku
    const predajnaCena = naber?.predajna_cena ? String(naber.predajna_cena) : "";
    const provizia = naber?.provizia ? String(naber.provizia) : "";

    // Dátum podpisu = dnes
    const dnes = new Date().toLocaleDateString("sk-SK", {
      day: "numeric", month: "long", year: "numeric",
    });

    // Zostaviť dáta pre template (overrides majú prednosť)
    const data: Record<string, string> = {
      z1_meno: ownerLine(0),
      z1_datum_nar: ownerDate(0),
      z1_rodne_cislo: "",
      z1_bytom: "",
      z1_kontakt: `${klient.email ?? ""}, ${klient.telefon ?? ""}`.replace(/^, |, $/, ""),
      z2_meno: ownerLine(1),
      z2_datum_nar: ownerDate(1),
      z2_rodne_cislo: "",
      z2_bytom: "",
      z2_kontakt: "",
      z3_meno: ownerLine(2),
      z3_datum_nar: ownerDate(2),
      z3_rodne_cislo: "",
      z3_bytom: "",
      z3_kontakt: "",
      makler_zastupena: maklerMeno,
      ok_urad: `Okresný úrad ${okres}`,
      ok_okres: okres,
      ok_obec: obec,
      ok_kat_uzemie: katUzemie,
      pozadovana_cena: predajnaCena,
      zmluva_mesiacov: "6",
      predlzenie_mesiacov: "3",
      provizia: provizia,
      provizia_slovom: "",
      miesto_podpisu: obec || "Bratislava",
      datum_podpisu: dnes,
      rovnopisy: String(1 + (majitelia.filter(m => m.meno).length || 1)),
      ...overrides,
    };

    // Načítaj template
    const templatePath = path.join(process.cwd(), "public/templates/vyhradna-zmluva-template.docx");
    const templateBuf = readFileSync(templatePath);

    // Docxtemplater — vlastný parser pre jednoduché {tag} nahradenie
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
