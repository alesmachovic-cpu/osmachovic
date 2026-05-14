"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { KRAJE } from "@/lib/database.types";
import type { Klient, TypInzercie } from "@/lib/database.types";
import SignatureCanvas from "@/components/SignatureCanvas";
import { useAuth } from "@/components/AuthProvider";
import { getUserItem } from "@/lib/userStorage";
import { getMaklerUuid } from "@/lib/maklerMap";
import { saveKlientDokument } from "@/lib/klientDokumenty";
import { naberInsert, klientUpdate as klientApiUpdate } from "@/lib/klientApi";
import DocumentScannerModal from "@/components/DocumentScannerModal";

const OKRESY: Record<string, string[]> = {
  "Bratislavský kraj": ["Bratislava I","Bratislava II","Bratislava III","Bratislava IV","Bratislava V","Malacky","Pezinok","Senec"],
  "Trnavský kraj": ["Dunajská Streda","Galanta","Hlohovec","Piešťany","Senica","Skalica","Trnava"],
  "Trenčínsky kraj": ["Bánovce nad Bebravou","Ilava","Myjava","Nové Mesto nad Váhom","Partizánske","Považská Bystrica","Prievidza","Púchov","Trenčín"],
  "Nitriansky kraj": ["Komárno","Levice","Nitra","Nové Zámky","Šaľa","Topoľčany","Zlaté Moravce"],
  "Žilinský kraj": ["Bytča","Čadca","Dolný Kubín","Kysucké Nové Mesto","Liptovský Mikuláš","Martin","Námestovo","Ružomberok","Turčianske Teplice","Tvrdošín","Žilina"],
  "Banskobystrický kraj": ["Banská Bystrica","Banská Štiavnica","Brezno","Detva","Krupina","Lučenec","Poltár","Revúca","Rimavská Sobota","Veľký Krtíš","Zvolen","Žarnovica","Žiar nad Hronom"],
  "Prešovský kraj": ["Bardejov","Humenné","Kežmarok","Levoča","Medzilaborce","Poprad","Prešov","Sabinov","Snina","Stará Ľubovňa","Stropkov","Svidník","Vranov nad Topľou"],
  "Košický kraj": ["Gelnica","Košice I","Košice II","Košice III","Košice IV","Košice-okolie","Michalovce","Rožňava","Sobrance","Spišská Nová Ves","Trebišov"],
};

type TypNaber = "byt" | "rodinny_dom" | "pozemok";

const STAV_OPTIONS = [
  { value: "velmi_dobry", label: "Veľmi dobrý" },
  { value: "dobry", label: "Dobrý" },
  { value: "zly", label: "Zlý" },
  { value: "kompletna_rekonstrukcia", label: "Kompletná rekonštrukcia" },
  { value: "novostavba", label: "Novostavba" },
  { value: "schatralý", label: "Schátralý" },
  { value: "invest_zamer", label: "Investičný zámer" },
  { value: "projekt", label: "Projekt" },
  { value: "vystavba", label: "Výstavba" },
];

const AMENITY_ITEMS = [
  "Výťah", "Balkón", "Lodžia", "Terasa", "Garáž", "Parking",
  "Pivnica", "Komora", "Káblová TV", "Satelit", "Internet",
  "Klimatizácia", "Alarm", "Telefón",
];

// Priradí ku každej položke vybavenia kľúč + jednotku (m² alebo ks)
// Položky ktoré nie sú tu vrátia null (nepotrebujú dodatočný input)
function getAmenitySpec(name: string): { key: string; unit: "m²" | "ks" } | null {
  const map: Record<string, { key: string; unit: "m²" | "ks" }> = {
    "Balkón":       { key: "balkon",   unit: "m²" },
    "Lodžia":       { key: "loggia",   unit: "m²" },
    "Terasa":       { key: "terasa",   unit: "m²" },
    "Garáž":        { key: "garaz",    unit: "m²" },
    "Pivnica":      { key: "pivnica",  unit: "m²" },
    "Komora":       { key: "komora",   unit: "m²" },
    "Výťah":        { key: "vytah",    unit: "ks" },
    "Parking":      { key: "parking",  unit: "ks" },
    "Klimatizácia": { key: "klima",    unit: "ks" },
  };
  return map[name] || null;
}

const DISPOZICIA_BYT = [
  { value: "garzonka", label: "Garzónka" },
  { value: "1kk", label: "1+kk" },
  { value: "1_1", label: "1+1" },
  { value: "2kk", label: "2+kk" },
  { value: "2_1", label: "2+1" },
  { value: "3kk", label: "3+kk" },
  { value: "3_1", label: "3+1" },
  { value: "4_1", label: "4+1" },
  { value: "5_plus", label: "5+" },
];

const KURENIE_CHIPS = [
  { value: "centralne", label: "Centrálne" },
  { value: "plynove", label: "Plynové" },
  { value: "elektricke", label: "Elektrické" },
  { value: "vlastna_kotolna", label: "Vl. kotolňa" },
  { value: "podlahove", label: "Podlahové" },
  { value: "tepelne_cerpadlo", label: "Tep. čerpadlo" },
];

const PODLAHY_CHIPS = ["Parkety", "Plávajúca", "Dlažba", "Koberec", "PVC", "Drevená", "Vinyl"];

const KUPELNA_CHIPS = ["Vaňa", "Sprchový kút", "Bidet", "2× kúpeľňa"];

const VLHKOST_CHIPS = [
  { value: "suchy", label: "Suchý" },
  { value: "ciastocne", label: "Čiastočne zavlhnutý" },
  { value: "vlhky", label: "Vlhký" },
];

const ELEKTRINA_CHIPS = [
  { value: "230v", label: "230 V" },
  { value: "400v", label: "400 V" },
  { value: "elektromer", label: "Elektromer" },
  { value: "vlastny_zdroj", label: "Vlastný zdroj" },
  { value: "dvojtarif", label: "Dvojtarif VT, NT" },
  { value: "nie_je", label: "Nie je" },
];

const KANALIZACIA_CHIPS = [
  { value: "verejna", label: "Verejná" },
  { value: "spolocna", label: "Spoločná" },
  { value: "vlastna_cov", label: "Vlastná ČOV" },
  { value: "zumpa", label: "Žumpa" },
  { value: "septik", label: "Septik" },
  { value: "nie_je", label: "Nie je" },
];

const KUCHYNA_CHIPS = [
  "Linka", "Sporák", "Rúra", "Umývačka", "Chladnička", "Mikrovlnka",
];

const DOM_TYP_CHIPS = [
  { value: "rodinny_dom", label: "Rodinný dom" },
  { value: "vila", label: "Vila" },
  { value: "chalupa", label: "Chalupa" },
  { value: "chata", label: "Chata" },
  { value: "komercny", label: "Komerčný" },
  { value: "iny", label: "Iné" },
];

const KONSTRUKCIA_CHIPS = [
  { value: "murovana", label: "Murovaná" },
  { value: "tehlova", label: "Tehlová" },
  { value: "tvarnice", label: "Z tvárnic" },
  { value: "drevena", label: "Drevená" },
  { value: "ocelova", label: "Oceľová" },
  { value: "ina", label: "Iná" },
];

const TYP_INZERCIE_OPTIONS: { value: TypInzercie; label: string; desc: string }[] = [
  { value: "inkognito", label: "Inkognito", desc: "Neinzeruje sa, iba databáza" },
  { value: "online_web", label: "Online — náš web", desc: "Len na webe Vianema" },
  { value: "online", label: "Online", desc: "Web + realitné portály" },
  { value: "vyhradne", label: "Výhradné", desc: "Exkluzívna inzercia" },
];

const DOKUMENTY_CHECKLIST = [
  { key: "lv", label: "List vlastníctva (LV)" },
  { key: "energeticky_certifikat", label: "Energetický certifikát" },
  { key: "podorys", label: "Pôdorys" },
  { key: "nahlad_katastra", label: "Náhľad z katastra" },
  { key: "znalecky_posudok", label: "Znalecký posudok" },
  { key: "ine", label: "Iné dokumenty" },
];

interface Props {
  typ: TypNaber;
  klient: Klient;
  onBack: () => void;
  onSubmit: (data: { id: string }) => void;
  /** Ak nastavený, nový záznam sa uloží ako DODATOK k existujúcemu náberáku.
   *  Originál zostáva nedotknutý — tak vyžaduje model (audit / legalita). */
  parentNaberakId?: string | null;
}

export default function NaberyForm({ typ, klient, onBack, onSubmit, parentNaberakId }: Props) {
  const { user: authUser } = useAuth();
  const uid = authUser?.id || "";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [typInzercie, setTypInzercie] = useState<TypInzercie>("online");

  const klientNotes = klient.poznamka || "";
  function parseNote(patterns: RegExp[]): string {
    for (const p of patterns) { const m = klientNotes.match(p); if (m) return m[1].trim(); }
    return "";
  }
  function parseNoteBool(patterns: RegExp[]): boolean {
    for (const p of patterns) { const m = klientNotes.match(p); if (m) return /áno|ano|yes|1|true/i.test(m[1]); }
    return false;
  }

  const [kraj, setKraj] = useState(() => {
    const lok = (klient.lokalita || "").trim().toLowerCase();
    if (!lok) return "";
    const all: { kraj: string; okres: string }[] = [];
    for (const [k, okresy] of Object.entries(OKRESY)) for (const o of okresy) all.push({ kraj: k, okres: o });
    all.sort((a, b) => b.okres.length - a.okres.length);
    return (all.find(x => lok === x.okres.toLowerCase()) || all.find(x => lok.includes(x.okres.toLowerCase())))?.kraj || "";
  });
  const [okres, setOkres] = useState(() => {
    const lok = (klient.lokalita || "").trim().toLowerCase();
    if (!lok) return "";
    const all: string[] = []; for (const o of Object.values(OKRESY)) all.push(...o);
    all.sort((a, b) => b.length - a.length);
    return all.find(x => lok === x.toLowerCase()) || all.find(x => lok.includes(x.toLowerCase())) || "";
  });
  const [obec, setObec] = useState(() => parseNote([/Obec:\s*(.+)/i, /Mesto:\s*(.+)/i]) || klient.lokalita || "");
  const [castObce, setCastObce] = useState(() => parseNote([/Časť obce:\s*(.+)/i, /Mestská časť:\s*(.+)/i, /MČ:\s*(.+)/i]));
  const [katUzemie, setKatUzemie] = useState(() => parseNote([/Kat(?:astrálne)?\s*územie:\s*(.+)/i, /KÚ:\s*(.+)/i]));
  const [ulica, setUlica] = useState(() => parseNote([/Ulica:\s*(.+)/i, /Adresa:\s*(.+)/i]));
  const [supisneCislo, setSupisneCislo] = useState(() => parseNote([/Súpisné\s*č(?:íslo)?\.?:\s*(.+)/i]));
  const [cisloOrientacne, setCisloOrientacne] = useState(() => parseNote([/Orientačné\s*č(?:íslo)?\.?:\s*(.+)/i]));

  const [plocha, setPlocha] = useState(() => parseNote([/Plocha:\s*(\d+[\.,]?\d*)/i, /(\d+)\s*m[²2]/i]));
  const [stav, setStav] = useState(() => {
    const s = parseNote([/Stav:\s*(.+)/i]); if (!s) return "";
    const found = STAV_OPTIONS.find(o => o.label.toLowerCase().includes(s.toLowerCase()));
    return found?.value || "";
  });
  const [poznamkyVybavenie, setPoznamkyVybavenie] = useState(() => parseNote([/Vybavenie:\s*(.+)/i]));

  const [pocetIzieb, setPocetIzieb] = useState(() => parseNote([/(?:Počet izieb|Izby|izieb):\s*(\d+)/i]) || parseNote([/(\d+)\s*-?\s*izb/i]));
  const [vlastnictvo, setVlastnictvo] = useState(() => {
    const v = parseNote([/Vlastníctvo:\s*(.+)/i]);
    return /družstevn/i.test(v) ? "druzstevne" : "osobne";
  });
  const [druzstvo, setDruzstvo] = useState("");
  const [typDomu, setTypDomu] = useState(() => parseNote([/Typ\s*domu:\s*(.+)/i, /Konštrukcia:\s*(.+)/i, /Materiál:\s*(.+)/i]));
  const [bytCislo, setBytCislo] = useState(() => parseNote([/Byt\s*č(?:íslo)?\.?:\s*(.+)/i, /Číslo bytu:\s*(.+)/i]));
  const [poschodie, setPoschodie] = useState(() => parseNote([/Poschodie:\s*(\d+)/i]));
  const [zKolko, setZKolko] = useState(() => parseNote([/[Zz]\s*(?:celkom|kolko):\s*(\d+)/i, /(?:celkom|spolu)\s*(\d+)\s*poscho/i]));
  const [kurenie, setKurenie] = useState(() => parseNote([/[Kk]úrenie:\s*(.+)/i, /[Vv]ykurovanie:\s*(.+)/i]));
  const [typPodlahy, setTypPodlahy] = useState(() => parseNote([/Podlah[ay]:\s*(.+)/i, /Typ podlahy:\s*(.+)/i]));
  const [anuita, setAnuita] = useState(() => parseNote([/Anuita:\s*(.+)/i, /Hypotéka:\s*(.+)/i]));
  const [vyhlad, setVyhlad] = useState(() => parseNote([/Výhľad:\s*(.+)/i]));
  const [mesacnePoplatky, setMesacnePoplatky] = useState(() => parseNote([/Mesačné\s*(?:poplatky|náklady):\s*(\d+[\.,]?\d*)/i]));

  // Stav bytového domu — checkboxy
  const [stupackyMenene, setStupackyMenene] = useState(false);
  const [zatepleny, setZatepleny] = useState(false);
  const [strechaRobena, setStrechaRobena] = useState(false);
  const [plastyOkna, setPlastyOkna] = useState(false);
  const [rozvodyMenene, setRozvodyMenene] = useState(false);
  const [stavDomuPoznamka, setStavDomuPoznamka] = useState("");
  const [dispozicia, setDispozicia] = useState("");
  const [energCertifikat, setEnergCertifikat] = useState(false);
  const [podlahy, setPodlahy] = useState<string[]>([]);
  const [kupelnaItems, setKupelnaItems] = useState<string[]>([]);
  const [typDomuDom, setTypDomuDom] = useState("");  // pre rodinny dom subtyp
  // Stav bytu — nové polia
  const [rokRekonstrukcie, setRokRekonstrukcie] = useState(() => parseNote([/Rok\s*(?:poslednej\s*)?rekonštrukcie:\s*(\d{4})/i, /Rekonštrukcia:\s*(\d{4})/i]));
  const [pocetMiestnosti, setPocetMiestnosti] = useState(() => parseNote([/Počet miestností:\s*(\d+)/i]) || parseNote([/(?:Počet izieb|Izby|izieb):\s*(\d+)/i]) || parseNote([/(\d+)\s*-?\s*izb/i]));
  const [vlhkost, setVlhkost] = useState("");
  const [kuchynaItems, setKuchynaItems] = useState<string[]>([]);
  const [krytina, setKrytina] = useState("");
  // Inžinierske siete (byt)
  const [elektrina, setElektrina] = useState<string[]>([]);
  const [kanalizacia, setKanalizacia] = useState("");
  const [vodaByt, setVodaByt] = useState("");
  const [plynByt, setPlynByt] = useState("");
  const [teplaVoda, setTeplaVoda] = useState("");

  const [pocetPodlazi, setPocetPodlazi] = useState(() => parseNote([/Počet podlaží:\s*(\d+)/i, /Podlaží:\s*(\d+)/i]));
  const [rokVystavby, setRokVystavby] = useState(() => parseNote([/Rok\s*(?:výstavby|kolaudácie):\s*(\d{4})/i]));
  const [pozemokPlocha, setPozemokPlocha] = useState(() => parseNote([/Pozemok\s*(?:plocha)?:\s*(\d+)/i]));
  const [zahrada, setZahrada] = useState(() => parseNoteBool([/Záhrada:\s*(\S+)/i]));

  const [druhPozemku, setDruhPozemku] = useState(() => parseNote([/Druh pozemku:\s*(.+)/i]));
  const [pristupovaCesta, setPristupovaCesta] = useState(() => parseNoteBool([/Prístupová cesta:\s*(\S+)/i]));
  const [siete, setSiete] = useState(() => ({
    voda: /\bvoda\b/i.test(klientNotes), plyn: /\bplyn\b/i.test(klientNotes),
    elektrina: /elektr/i.test(klientNotes), kanal: /kanal/i.test(klientNotes),
  }));
  const [ucelovyUrcenie, setUcelovyUrcenie] = useState(() => parseNote([/Účel(?:ové určenie)?:\s*(.+)/i]));

  const [oznacenie, setOznacenie] = useState("ziadne");

  const [vybavenie, setVybavenie] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {};
    const map: Record<string, RegExp> = { "Výťah": /výťah/i, "Balkón": /balkón/i, "Lodžia": /lodžia|loggia/i, "Garáž": /garáž/i, "Pivnica": /pivnic/i, "Parking": /parking|parkov/i };
    for (const [key, regex] of Object.entries(map)) if (regex.test(klientNotes)) v[key] = true;
    return v;
  });

  // Výmery doplnkov (m²) — zobrazujú sa keď je checkbox zaškrtnutý
  // Kľúče: balkon, loggia, terasa, zahrada, garaz
  const [vymery, setVymery] = useState<Record<string, string>>(() => {
    const vm: Record<string, string> = {};
    // Parse from existing lv_data if any (auto-fill from LV)
    const lv = klient.lv_data as Record<string, unknown> | null | undefined;
    if (lv) {
      if (lv.balkon_plocha) vm.balkon = String(lv.balkon_plocha);
      if (lv.loggia_plocha) vm.loggia = String(lv.loggia_plocha);
      if (lv.terasa_plocha) vm.terasa = String(lv.terasa_plocha);
    }
    return vm;
  });
  const [zariadeny, setZariadeny] = useState(() => parseNote([/Zariadený:\s*(.+)/i]));

  const [majitel, setMajitel] = useState(klient.meno || "");
  const [konatel, setKonatel] = useState(() => parseNote([/Konateľ:\s*(.+)/i]));
  const [jednatel, setJednatel] = useState(() => parseNote([/Jednateľ:\s*(.+)/i]));
  const [kontaktMajitel, setKontaktMajitel] = useState(klient.telefon || "");
  const [uzivatel, setUzivatel] = useState(() => parseNote([/Užívateľ:\s*(.+)/i, /Nájomca:\s*(.+)/i]));
  const [kontaktUzivatel, setKontaktUzivatel] = useState(() => parseNote([/Kontakt užívateľ:\s*(.+)/i]));

  const [predajnaCena, setPredajnaCena] = useState(() =>
    parseNote([/(?:Predajná )?[Cc]ena:\s*([\d\s.,]+)/i]) || (klient.rozpocet_max ? String(klient.rozpocet_max) : "")
  );
  const [makler, setMakler] = useState("Aleš Machovič");
  const [zmluva, setZmluva] = useState(false);
  const [typZmluvy, setTypZmluvy] = useState("exkluzivna");
  const [datumPodpisu, setDatumPodpisu] = useState("");
  const [zmluvaDo, setZmluvaDo] = useState("");
  const [provizia, setProvizia] = useState(() => klient.proviziaeur ? String(klient.proviziaeur) : parseNote([/Provízia:\s*(.+)/i]));
  const [proviziaTyp, setProviziaTyp] = useState<"z_kupnej" | "nad_cenu" | "">("");
  const [popis, setPopis] = useState(() => parseNote([/Popis:\s*(.+)/i]) || "");

  const [podpisData, setPodpisData] = useState<string | null>(null);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [remoteSignMode, setRemoteSignMode] = useState(false);

  // Finančné kalkulačky
  const [urok, setUrok] = useState("3.5");
  type AnalyzaResult = {
    priemerna_cena_m2: number; odporucana_od: number; odporucana_do: number;
    hodnotenie: "V rozsahu" | "Mierne vysoká" | "Vysoká" | "Mierne nízka" | "Nízka";
    odchylka_pct: number; pocet_porovnani: number; zdroj: "monitor" | "benchmark"; komentar: string;
    porovnania?: { nazov: string; url: string | null; cena: number; plocha: number; eurM2: number }[];
  };
  const [analyza, setAnalyza] = useState<AnalyzaResult | null>(null);
  const [analyzaLoading, setAnalyzaLoading] = useState(false);

  async function triggerAnalyza(cena?: string) {
    const cenaNow = cena ?? predajnaCena;
    if (!obec || !plocha) return;
    setAnalyzaLoading(true);
    try {
      const res = await fetch("/api/naber-analyza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ, plocha: Number(plocha), obec, okres, predajnaCena: Number(cenaNow) || undefined, klientId: klient.id }),
      });
      if (res.ok) setAnalyza(await res.json());
    } catch { /* silent */ }
    setAnalyzaLoading(false);
  }

  const autoAnalyzaFired = useRef(false);
  useEffect(() => {
    if (!autoAnalyzaFired.current && obec && plocha) {
      autoAnalyzaFired.current = true;
      triggerAnalyza();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obec, plocha]);

  // TASK 11 — Auto-save draft do localStorage (každých 30s) + banner pri návrate
  const draftLsKey = `naber_draft_${klient.id}`;
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{ savedAt: string } | null>(null);

  // Detekcia draftu pri mounte
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(draftLsKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.savedAt) {
          setDraftMeta({ savedAt: d.savedAt });
          setShowDraftBanner(true);
        }
      }
    } catch { /* ignore */ }
  }, [draftLsKey]);

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftLsKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.obec !== undefined) setObec(d.obec);
      if (d.ulica !== undefined) setUlica(d.ulica);
      if (d.supisneCislo !== undefined) setSupisneCislo(d.supisneCislo);
      if (d.plocha !== undefined) setPlocha(d.plocha);
      if (d.pocetIzieb !== undefined) setPocetIzieb(d.pocetIzieb);
      if (d.predajnaCena !== undefined) setPredajnaCena(d.predajnaCena);
      if (d.provizia !== undefined) setProvizia(d.provizia);
      if (d.proviziaTyp !== undefined) setProviziaTyp(d.proviziaTyp);
      if (d.popis !== undefined) setPopis(d.popis);
      if (d.makler !== undefined) setMakler(d.makler);
      if (d.zmluva !== undefined) setZmluva(d.zmluva);
      if (d.typZmluvy !== undefined) setTypZmluvy(d.typZmluvy);
      if (d.datumPodpisu !== undefined) setDatumPodpisu(d.datumPodpisu);
      if (d.zmluvaDo !== undefined) setZmluvaDo(d.zmluvaDo);
      if (d.kurenie !== undefined) setKurenie(d.kurenie);
      if (d.mesacnePoplatky !== undefined) setMesacnePoplatky(d.mesacnePoplatky);
    } catch { /* ignore */ }
    setShowDraftBanner(false);
  }
  function discardDraft() {
    localStorage.removeItem(draftLsKey);
    setShowDraftBanner(false);
    setDraftMeta(null);
  }

  // Periodický autosave — každých 30s ulož snapshot fields
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => {
      // Ukladaj iba ak je niečo už zadané (aby sme nevytvorili draft prázdny formulár)
      const hasContent = obec.trim() || ulica.trim() || plocha || pocetIzieb || predajnaCena || provizia || popis.trim();
      if (!hasContent) return;
      try {
        const payload = {
          savedAt: new Date().toISOString(),
          obec, ulica, supisneCislo, plocha, pocetIzieb, predajnaCena,
          provizia, proviziaTyp, popis, makler, zmluva, typZmluvy,
          datumPodpisu, zmluvaDo, kurenie, mesacnePoplatky,
        };
        localStorage.setItem(draftLsKey, JSON.stringify(payload));
      } catch { /* quota exceeded etc. — ignore */ }
    };
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [draftLsKey, obec, ulica, supisneCislo, plocha, pocetIzieb, predajnaCena,
      provizia, proviziaTyp, popis, makler, zmluva, typZmluvy,
      datumPodpisu, zmluvaDo, kurenie, mesacnePoplatky]);

  // LV data + review
  const [lvMajitelia, setLvMajitelia] = useState<Array<{ meno: string; podiel?: string; datum_narodenia?: string }>>([]);
  const [lvPozemky, setLvPozemky] = useState<Array<{ cislo_parcely?: string; druh?: string; vymera?: number }>>([]);
  const [lvPravneVady, setLvPravneVady] = useState("");
  const [tarchyRiesenie, setTarchyRiesenie] = useState<"z_kupnej" | "prenos" | "pred_podpisom" | "">("");

  // Collapsible sekcie — minimalizované ak auto-vyplnené z LV
  const hasLvData = !!(klient.lv_data);
  const [lokalitaOpen, setLokalitaOpen] = useState(!hasLvData);
  const [majitelOpen, setMajitelOpen] = useState(!hasLvData);

  // AI cena
  const [aiOdhadOpen, setAiOdhadOpen] = useState(false);
  const [aiAnalyza, setAiAnalyza] = useState("");
  const [analyzujeAI, setAnalyzujeAI] = useState(false);
  // Podpis — výber vlastníkov
  const [podpisOwners, setPodpisOwners] = useState<string[]>([]);
  const [zastupca, setZastupca] = useState("");
  const [zastupca_za, setZastupca_za] = useState("");

  // Auto-fill z LV dát klienta
  useEffect(() => {
    const lv = klient.lv_data as Record<string, unknown> | null | undefined;
    if (!lv) return;
    if (lv.obec && !obec) setObec(String(lv.obec));
    // Ulica — len ulicu s orientačným číslom, bez súpisného a obce
    if (lv.ulica && !ulica) {
      let u = String(lv.ulica);
      // Odstráň súpisné číslo a obec ak sa tam dostali
      if (lv.supisne_cislo) u = u.replace(String(lv.supisne_cislo), "").trim();
      if (lv.obec) u = u.replace(String(lv.obec), "").trim();
      if (lv.katastralneUzemie) u = u.replace(String(lv.katastralneUzemie), "").trim();
      u = u.replace(/,\s*$/, "").replace(/^\s*,/, "").trim();
      setUlica(u);
    }
    if (lv.supisne_cislo && !supisneCislo) setSupisneCislo(String(lv.supisne_cislo));
    // Číslo orientačné — extrahuj číslo z vchodu/ulice (napr. "Továrenská 1" → "1")
    if (!cisloOrientacne) {
      const source = lv.vchod ? String(lv.vchod) : lv.ulica ? String(lv.ulica) : "";
      const numMatch = source.match(/(\d+[A-Za-z]?)\s*$/);
      if (numMatch) setCisloOrientacne(numMatch[1]);
    }
    if (lv.katastralneUzemie && !katUzemie) setKatUzemie(String(lv.katastralneUzemie));
    if (lv.plocha && !plocha) setPlocha(String(lv.plocha));
    if (lv.izby && !pocetIzieb) setPocetIzieb(String(lv.izby));
    // Poschodie — "prízemie" → 0, "1.p" → 1, etc.
    if (lv.poschodie != null && !poschodie) {
      const raw = String(lv.poschodie).trim().toLowerCase();
      if (raw === "prízemie" || raw === "prizemie" || raw === "0" || raw === "prízem") {
        setPoschodie("0");
      } else {
        const numMatch = raw.match(/(\d+)/);
        setPoschodie(numMatch ? numMatch[1] : String(lv.poschodie));
      }
    }
    // Byt číslo
    if (lv.cislo_bytu && !bytCislo) setBytCislo(String(lv.cislo_bytu));
    // Vchod
    if (lv.vchod && !ulica) {
      // Ak vchod obsahuje ulicu (napr. "Továrenská 1"), použi ho
      const vchod = String(lv.vchod);
      if (vchod.match(/[A-Za-zÁ-Ž]/)) setUlica(prev => prev || vchod);
    }
    // Z koľko poschodí
    if (lv.poschodia_vyssie && !zKolko) setZKolko(String(lv.poschodia_vyssie));
    if (lv.rok_vystavby && !rokVystavby) setRokVystavby(String(lv.rok_vystavby));
    if (lv.material && !typDomu) setTypDomu(String(lv.material));
    if (lv.vlastnictvo) {
      const v = String(lv.vlastnictvo).toLowerCase();
      if (v.includes("druz")) setVlastnictvo("druzstevne");
      else if (v.includes("osob")) setVlastnictvo("osobne");
    }
    // Kraj + Okres — auto-detect z LV alebo OKRESY mapy
    if (lv.okres && !okres) {
      const lvOkres = String(lv.okres);
      setOkres(lvOkres);
      // Nájdi kraj podľa okresu z OKRESY mapy
      if (!kraj) {
        const foundKraj = Object.entries(OKRESY).find(([, okresy]) =>
          okresy.some(o => o.toLowerCase() === lvOkres.toLowerCase())
        )?.[0];
        if (foundKraj) setKraj(foundKraj);
      }
    }
    if (lv.kraj && !kraj) {
      const lvKraj = String(lv.kraj);
      // Pridaj " kraj" ak chýba
      const krajVal = lvKraj.includes("kraj") ? lvKraj : `${lvKraj} kraj`;
      const matched = KRAJE.find(k => k.toLowerCase() === krajVal.toLowerCase());
      setKraj(matched || krajVal);
    }
    const majitelia = lv.majitelia as Array<{ meno?: string; podiel?: string; datum_narodenia?: string }> | undefined;
    if (majitelia?.length && majitelia[0].meno) {
      setMajitel(majitelia[0].meno);
      const allOwners = majitelia.filter(m => m.meno).map(m => ({ meno: m.meno!, podiel: m.podiel, datum_narodenia: m.datum_narodenia }));
      if (allOwners.length > 1) setLvMajitelia(allOwners.slice(1));
      setPodpisOwners(allOwners.map(m => m.meno!));
    }
    const pozemky = lv.pozemky as Array<{ cislo_parcely?: string; druh?: string; vymera?: number }> | undefined;
    if (pozemky?.length) setLvPozemky(pozemky);
    if (lv.pravne_vady) setLvPravneVady(String(lv.pravne_vady));
    // Auto-check LV v dokumentoch
    setDokumenty(prev => ({ ...prev, lv: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [odhadCenaM2, setOdhadCenaM2] = useState(2800);
  const [rekonstrukciaM2, setRekonstrukciaM2] = useState(500);
  const [marza, setMarza] = useState(15);

  useEffect(() => {
    if (!uid) return;
    try {
      const cm = getUserItem(uid, "odhad_cena_m2");
      const rm = getUserItem(uid, "rekonstrukcia_m2");
      const mp = getUserItem(uid, "marza_percent");
      if (cm) setOdhadCenaM2(Number(cm) || 2800);
      if (rm) setRekonstrukciaM2(Number(rm) || 500);
      if (mp) setMarza(Number(mp) || 15);
    } catch { /* ignore */ }
  }, [uid]);
  const [potrebujeReko, setPotrebujeReko] = useState(true);

  const [dokumenty, setDokumenty] = useState<Record<string, boolean>>({});
  const [dokumentyFotos, setDokumentyFotos] = useState<Record<string, string[]>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerDocKey, setScannerDocKey] = useState("");

  const typLabel = typ === "byt" ? "Byt" : typ === "rodinny_dom" ? "Rodinný dom" : "Pozemok";

  function handleDocFoto(key: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const labelMap: Record<string, string> = {
      lv: "List vlastníctva", energeticky_certifikat: "Energetický certifikát",
      podorys: "Pôdorys", nahlad_katastra: "Náhľad z katastra",
      znalecky_posudok: "Znalecký posudok", ine: "Iný dokument",
    };
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setDokumentyFotos(prev => ({ ...prev, [key]: [...(prev[key] || []), base64] }));
        if (klient?.id) {
          const b64Only = base64.split(",")[1] || "";
          saveKlientDokument({
            klient_id: klient.id, name: file.name,
            type: labelMap[key] || key, size: file.size,
            source: "naber", mime: file.type, data_base64: b64Only,
          }).catch(() => {});
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function removeDocFoto(key: string, index: number) {
    setDokumentyFotos(prev => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== index) }));
  }

  function handleScanSave(pdfBase64: string, name: string) {
    setDokumentyFotos(prev => ({
      ...prev,
      [scannerDocKey]: [...(prev[scannerDocKey] || []), `pdf:${name}`],
    }));
    setScannerOpen(false);
    if (klient?.id) {
      const labelMap: Record<string, string> = {
        lv: "List vlastnictva", energeticky_certifikat: "Energeticky certifikat",
        podorys: "Podorys", nahlad_katastra: "Nahlad z katastra",
        znalecky_posudok: "Znalecky posudok", ine: "Iny dokument",
      };
      saveKlientDokument({
        klient_id: klient.id, name,
        type: labelMap[scannerDocKey] || scannerDocKey,
        size: Math.round(pdfBase64.length * 0.75),
        source: "naber", mime: "application/pdf",
        data_base64: pdfBase64,
      }).catch(() => {});
    }
  }

  async function handleSubmit() {
    // 0 je platná hodnota provízie — kontrolujeme iba prázdny string / undefined / null
    const proviziaTrim = (provizia ?? "").toString().trim();
    if (proviziaTrim === "") { setError("Provízia je povinné pole"); return; }
    if (!remoteSignMode) {
      // Klasický mód — vyžaduje sa lokálny podpis a GDPR súhlas tu na zariadení
      if (!podpisData) { setError("Chýba podpis klienta"); return; }
      if (!gdprConsent) { setError("Súhlas so spracovaním osobných údajov je povinný"); return; }
    }
    // V remote-sign móde sa email klienta zadáva v modáli pri klikutí "📧 Poslať email"
    // (cez SmsSignButton). Tu žiadny hard-check nepotrebujeme — ak klient.email chýba,
    // maklér ho ručne zadá v modáli na step 4.

    // Kolízna kontrola — či nejaký iný maklér už eviduje rovnakú nehnuteľnosť
    // (rovnaká lokalita + typ + izby v aktívnych inzerátoch). Blokujeme save
    // kým maklér výslovne nepotvrdí.
    try {
      const izbyNum = typ === "byt" ? parseInt(pocetIzieb || "0", 10) : null;
      const collisionBody = {
        lokalita: obec || null,
        typ_nehnutelnosti: typ,
        izby: izbyNum || null,
        makler_email: authUser?.email || null,
        makler_meno: makler || null,
      };
      if (collisionBody.lokalita && izbyNum) {
        const res = await fetch("/api/kolize/nehnutelnosti", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(collisionBody),
        });
        const out = await res.json().catch(() => ({}));
        const high = (out.kolize || []).filter((k: { zavaznost?: string }) => k.zavaznost === "high");
        if (high.length > 0) {
          const names = high.map((k: { data?: { makler_a_meno?: string } }) => k.data?.makler_a_meno || "iný maklér").join(", ");
          const ok = window.confirm(
            `⚠️ KOLÍZIA\n\nRovnakú nehnuteľnosť (${obec}, ${typ}, ${izbyNum}-izb) už eviduje: ${names}.\n\nNapriek tomu pokračovať v nábere?`
          );
          if (!ok) return;
        }
      }
    } catch (e) {
      console.warn("[kolizia] check failed, pokračujem:", e);
    }

    setSaving(true);
    setError("");
    const parametre: Record<string, unknown> = {};
    // Stav domu
    const stavDomu: Record<string, unknown> = {};
    if (stupackyMenene) stavDomu.stupacky_menene = true;
    if (zatepleny) stavDomu.zatepleny = true;
    if (strechaRobena) stavDomu.strecha_robena = true;
    if (plastyOkna) stavDomu.plasty_okna = true;
    if (rozvodyMenene) stavDomu.rozvody_menene = true;
    if (stavDomuPoznamka) stavDomu.poznamka = stavDomuPoznamka;
    if (Object.keys(stavDomu).length > 0) parametre.stav_domu = stavDomu;

    if (typ === "byt") {
      // Stav bytu
      const stavBytu: Record<string, unknown> = {};
      if (rokRekonstrukcie) stavBytu.rok_rekonstrukcie = rokRekonstrukcie;
      if (pocetMiestnosti) stavBytu.pocet_miestnosti = pocetMiestnosti;
      if (vlhkost) stavBytu.vlhkost = vlhkost;
      if (kuchynaItems.length > 0) stavBytu.kuchyna = kuchynaItems;
      if (krytina) stavBytu.krytina = krytina;
      if (podlahy.length > 0) stavBytu.podlahy = podlahy;
      if (kupelnaItems.length > 0) stavBytu.kupelna = kupelnaItems;
      if (energCertifikat) stavBytu.energ_certifikat = true;
      if (Object.keys(stavBytu).length > 0) parametre.stav_bytu = stavBytu;
      // Inžinierske siete
      const inzSiete: Record<string, unknown> = {};
      if (elektrina.length > 0) inzSiete.elektrina = elektrina;
      if (kanalizacia) inzSiete.kanalizacia = kanalizacia;
      if (vodaByt) inzSiete.voda = vodaByt;
      if (plynByt) inzSiete.plyn = plynByt;
      if (teplaVoda) inzSiete.tepla_voda = teplaVoda;
      if (Object.keys(inzSiete).length > 0) parametre.inz_siete = inzSiete;
      Object.assign(parametre, { pocet_izieb: pocetIzieb, vlastnictvo, druzstvo, typ_domu: typDomu, byt_cislo: bytCislo, poschodie, z_kolko: zKolko, kurenie, typ_podlahy: typPodlahy, anuita, vyhlad, mesacne_poplatky: mesacnePoplatky });
    } else if (typ === "rodinny_dom") {
      Object.assign(parametre, { pocet_izieb: pocetIzieb, typ_domu: typDomu, pocet_podlazi: pocetPodlazi, rok_vystavby: rokVystavby, pozemok_plocha: pozemokPlocha, zahrada, kurenie, typ_podlahy: typPodlahy, anuita, vyhlad, mesacne_poplatky: mesacnePoplatky });
    } else {
      Object.assign(parametre, { druh_pozemku: druhPozemku, pristupova_cesta: pristupovaCesta, siete, ucelove_urcenie: ucelovyUrcenie });
    }
    // Ťarchy info do parametre
    if (lvPravneVady) parametre.tarcha_text = lvPravneVady;
    if (tarchyRiesenie) parametre.tarcha_riesenie = tarchyRiesenie;
    if (proviziaTyp) parametre.provizia_typ = proviziaTyp;
    const maklerUuid = authUser?.id ? await getMaklerUuid(authUser.id) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {
      typ_nehnutelnosti: typ, klient_id: klient.id,
      kraj: kraj || null, okres: okres || null, obec: obec || null,
      cast_obce: castObce || null, kat_uzemie: katUzemie || null,
      ulica: ulica || null, supisne_cislo: supisneCislo || null, cislo_orientacne: cisloOrientacne || null,
      plocha: plocha ? Number(plocha) : null, stav: stav || null,
      poznamky_vybavenie: poznamkyVybavenie || null,
      parametre, vybavenie: { ...vybavenie, zariadeny: zariadeny || null, vymery }, oznacenie,
      majitel: majitel || null, konatel: konatel || null, jednatel: jednatel || null,
      kontakt_majitel: kontaktMajitel || null, uzivatel: uzivatel || null, kontakt_uzivatel: kontaktUzivatel || null,
      predajna_cena: predajnaCena ? Number(predajnaCena) : null,
      makler: makler || null, zmluva, typ_zmluvy: zmluva ? typZmluvy : null,
      datum_podpisu: datumPodpisu || null, zmluva_do: zmluvaDo || null,
      provizia: provizia || null, popis: popis || null,
      // V remote-sign móde podpis aj GDPR vyplní endpoint /api/sign/verify keď klient potvrdí
      podpis_data: remoteSignMode ? null : podpisData,
      parent_naberak_id: parentNaberakId || null,
      gdpr_consent: !remoteSignMode,
      gdpr_consent_at: remoteSignMode ? null : new Date().toISOString(),
      podpis_meta: remoteSignMode
        ? { pending_remote_sign: true, requested_at: new Date().toISOString() }
        : {
            gdpr_version: "v1.0",
            consent_evidence: true,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : null,
            // IP doplní /api/naber-pdf alebo iný server-side proces; tu klient-side
          },
    };
    if (!authUser?.id) { setSaving(false); setError("Nie si prihlásený"); return; }
    const insertRes = await naberInsert<{ id: string }>(authUser.id, { ...record, klient_id: klient.id });
    if (insertRes.error) { setSaving(false); setError("Chyba pri ukladaní: " + insertRes.error.message); return; }
    const data = (insertRes.data?.[0] as { id: string }) ?? { id: "" };
    const klientPatch: Record<string, unknown> = { status: "nabrany" };
    if (maklerUuid && !klient.makler_id) klientPatch.makler_id = maklerUuid;
    await klientApiUpdate(authUser.id, klient.id, klientPatch);
    // Log do timeline
    try {
      await supabase.from("klient_udalosti").insert({
        klient_id: klient.id, typ: "status_zmena",
        popis: "Dohodnutý náber → Nabraný · Náberový list odovzdaný",
        autor: authUser.id,
      });
    } catch { /* neblokuj */ }

    // Auto-upload Náberového listu ako PDF do Dokumentov klienta
    try {
      const pdfRes = await fetch(`/api/naber-pdf?id=${data.id}`);
      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const reader = new FileReader();
        const base64: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const meno = (klient.meno || "klient").replace(/[^a-zA-Z0-9]+/g, "_");
        const datum = new Date().toISOString().split("T")[0];
        await saveKlientDokument({
          klient_id: klient.id,
          name: `naberovy_list_${meno}_${datum}.pdf`,
          type: "Náberový list",
          size: blob.size,
          source: "naber",
          mime: "application/pdf",
          data_base64: base64,
        });
      }
    } catch (e) {
      console.warn("[naber] auto-upload PDF failed:", e);
      // Nezrušíme save ak PDF upload zlyhá — náberak je uložený v DB
    }

    setSaving(false);
    // TASK 11 — po úspešnom uložení vyčisti draft
    try { localStorage.removeItem(draftLsKey); } catch { /* ignore */ }
    onSubmit({ id: data.id });
  }

  async function handleAiAnalyza() {
    setAnalyzujeAI(true);
    setAiAnalyza("");
    try {
      const allOwnerNames = [majitel, ...lvMajitelia.map(m => m.meno)].filter(Boolean);
      const vybavenieList = Object.entries(vybavenie).filter(([, v]) => v).map(([k]) => k).join(", ") || "neuvedené";
      const stavLabel = STAV_OPTIONS.find(s => s.value === stav)?.label || stav || "neznámy";
      const prompt = `Si expert na slovenský realitný trh. Na základe údajov z náberového listu urob reálnu cenovú analýzu.

NEHNUTEĽNOSŤ:
- Typ: ${typLabel}
- Lokalita: ${[obec, ulica, okres].filter(Boolean).join(", ")}
- Plocha: ${plocha || "neznáma"} m²
- Stav: ${stavLabel}${typ === "byt" ? `
- Počet izieb: ${pocetIzieb || "neznámy"}
- Poschodie: ${poschodie || "?"} z ${zKolko || "?"}
- Typ domu: ${typDomu || "neznámy"}
- Vlastníctvo: ${vlastnictvo === "druzstevne" ? "Družstevné" : "Osobné"}` : ""}${typ === "rodinny_dom" ? `
- Rok výstavby: ${rokVystavby || "neznámy"}
- Pozemok: ${pozemokPlocha || "?"} m²` : ""}
- Anuita/hypotéka: ${anuita || "žiadna"}
- Mesačné poplatky: ${mesacnePoplatky || "neznáme"} €
- Vybavenie: ${vybavenieList}
- Vlastníci: ${allOwnerNames.length}

Uveď:
1. Odporúčaná predajná cena v € (reálna trhová)
2. Výkupná cena v € (čo ponúkneme klientovi)
3. Zdôvodnenie (2-3 vety)
4. Hlavné faktory ovplyvňujúce cenu

Odpovedaj stručne po slovensky.`;
      const res = await fetch("/api/ai-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: "Si expert realitný analytik pre slovenský trh.", userMessage: prompt, maxTokens: 600 }),
      });
      const d = await res.json();
      setAiAnalyza(d.text || d.error || "Chyba pri analýze");
    } catch {
      setAiAnalyza("Chyba pri volaní AI");
    }
    setAnalyzujeAI(false);
  }

  // Styles
  const cardSt: React.CSSProperties = {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "14px", padding: "20px", marginBottom: "16px",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px",
    display: "flex", alignItems: "center", gap: "8px",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "12px", fontWeight: "600", color: "var(--text-muted)",
    marginBottom: "4px", display: "block",
  };
  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
    color: "var(--text-primary)", outline: "none",
  };
  const selectSt: React.CSSProperties = { ...inputSt, appearance: "auto" as React.CSSProperties["appearance"] };
  const gridSt: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
  const checkSt: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "8px", fontSize: "13px",
    color: "var(--text-primary)", cursor: "pointer", padding: "6px 0",
  };
  const radioSt: React.CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap" };

  function RadioGroup({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
      <div style={radioSt}>
        {options.map(o => (
          <label key={o.value} style={{
            ...checkSt, padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
            background: value === o.value ? "#374151" : "var(--bg-elevated)",
            color: value === o.value ? "#fff" : "var(--text-secondary)",
            border: "1px solid " + (value === o.value ? "#374151" : "var(--border)"),
            fontSize: "12px", fontWeight: "500", transition: "all 0.15s",
          }}>
            <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} style={{ display: "none" }} />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  const lv = klient.lv_data as Record<string, unknown> | null | undefined;
  const allLvOwners = lv?.majitelia
    ? (lv.majitelia as Array<{ meno?: string; podiel?: string; datum_narodenia?: string }>).filter(m => m.meno)
    : (majitel ? [{ meno: majitel }] : []);

  return (
    <div style={{ maxWidth: "700px" }} spellCheck autoCorrect="on">
      {/* Draft banner (TASK 11) */}
      {showDraftBanner && draftMeta && (
        <div style={{
          padding: "12px 16px", marginBottom: "16px", borderRadius: "12px",
          background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          flexWrap: "wrap",
        }}>
          <div style={{ fontSize: "13px", lineHeight: 1.4 }}>
            📝 Máš rozpracovaný náberák pre tohto klienta z{" "}
            <strong>{new Date(draftMeta.savedAt).toLocaleString("sk", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong>.
            Chceš pokračovať?
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={loadDraft} style={{
              padding: "6px 14px", borderRadius: "8px", border: "none",
              background: "#92400E", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer",
            }}>Pokračovať</button>
            <button onClick={discardDraft} style={{
              padding: "6px 14px", borderRadius: "8px", border: "1px solid #92400E",
              background: "transparent", color: "#92400E", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}>Zahodiť</button>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={onBack} style={{
          width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)",
          background: "var(--bg-surface)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0, color: "var(--text-primary)" }}>
            Náberový list — {typLabel}
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Klient: {klient.meno} {klient.telefon ? `· ${klient.telefon}` : ""}
          </p>
        </div>
      </div>

      {/* 1. Lokalita — collapsible */}
      <div style={cardSt}>
        <div
          style={{ ...sectionTitle, cursor: "pointer", justifyContent: "space-between", marginBottom: lokalitaOpen ? "16px" : 0 }}
          onClick={() => setLokalitaOpen(o => !o)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            📍 Lokalita
            {!lokalitaOpen && (obec || ulica) && (
              <span style={{ fontSize: "12px", fontWeight: "400", color: "var(--text-muted)" }}>
                — {[ulica, obec, okres].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
          <span style={{ fontSize: "18px", color: "var(--text-muted)", fontWeight: "300", lineHeight: 1 }}>{lokalitaOpen ? "−" : "+"}</span>
        </div>
        {lokalitaOpen && (
          <div className="naber-grid" style={gridSt}>
            <div>
              <label style={labelSt}>Kraj</label>
              <select value={kraj} onChange={e => { setKraj(e.target.value); setOkres(""); }} style={selectSt}>
                <option value="">— vyber —</option>
                {KRAJE.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Okres</label>
              <select value={okres} onChange={e => setOkres(e.target.value)} style={selectSt}>
                <option value="">— vyber —</option>
                {(OKRESY[kraj] || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Obec</label>
              <input value={obec} onChange={e => setObec(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Časť obce</label>
              <input value={castObce} onChange={e => setCastObce(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Kat. územie</label>
              <input value={katUzemie} onChange={e => setKatUzemie(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Ulica</label>
              <input value={ulica} onChange={e => setUlica(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Súpisné číslo</label>
              <input value={supisneCislo} onChange={e => setSupisneCislo(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Číslo orientačné</label>
              <input value={cisloOrientacne} onChange={e => setCisloOrientacne(e.target.value)} style={inputSt} />
            </div>
          </div>
        )}
      </div>

      {/* 2. Majiteľ — collapsible */}
      <div style={cardSt}>
        <div
          style={{ ...sectionTitle, cursor: "pointer", justifyContent: "space-between", marginBottom: majitelOpen ? "16px" : 0 }}
          onClick={() => setMajitelOpen(o => !o)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            👤 Majiteľ / Vlastník
            {!majitelOpen && majitel && (
              <span style={{ fontSize: "12px", fontWeight: "400", color: "var(--text-muted)" }}>
                — {majitel}{kontaktMajitel ? ` · ${kontaktMajitel}` : ""}
              </span>
            )}
          </div>
          <span style={{ fontSize: "18px", color: "var(--text-muted)", fontWeight: "300", lineHeight: 1 }}>{majitelOpen ? "−" : "+"}</span>
        </div>
        {majitelOpen && (
          <>
            <div className="naber-grid" style={gridSt}>
              <div>
                <label style={labelSt}>Majiteľ *</label>
                <input value={majitel} onChange={e => setMajitel(e.target.value)} style={inputSt} placeholder="Meno a priezvisko" />
              </div>
              <div>
                <label style={labelSt}>Kontakt *</label>
                <input value={kontaktMajitel} onChange={e => setKontaktMajitel(e.target.value)} style={inputSt} placeholder="+421..." />
              </div>
              <div>
                <label style={labelSt}>Konateľ</label>
                <input value={konatel} onChange={e => setKonatel(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Jednateľ</label>
                <input value={jednatel} onChange={e => setJednatel(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Užívateľ</label>
                <input value={uzivatel} onChange={e => setUzivatel(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Kontakt užívateľa</label>
                <input value={kontaktUzivatel} onChange={e => setKontaktUzivatel(e.target.value)} style={inputSt} />
              </div>
            </div>
            {lvMajitelia.length > 0 && (
              <div style={{ marginTop: "14px", padding: "12px 14px", background: "#F0FDF4", borderRadius: "10px", border: "1px solid #BBF7D0" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#059669", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Ďalší spoluvlastníci z LV
                </div>
                {lvMajitelia.map((m, i) => (
                  <div key={i} style={{ fontSize: "13px", color: "var(--text-primary)", paddingBottom: "4px" }}>
                    {m.meno}{m.podiel ? <span style={{ color: "var(--text-muted)" }}> — podiel {m.podiel}</span> : ""}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Nehnuteľnosť — BYT */}
      {typ === "byt" && (<>
        {/* ═══ 1. POD DOMOM — Bytový dom (čo vidíš zvonka + spoločné priestory) ═══ */}
        <div style={cardSt}>
          <div style={sectionTitle}>🏢 Bytový dom</div>

          {/* Konštrukcia */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Konštrukcia</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {[{ value: "tehlovy", label: "Tehlový" }, { value: "panelovy", label: "Panelový" }, { value: "skeletovy", label: "Skeletový" }].map(o => (
                <button type="button" key={o.value} onClick={() => setTypDomu(o.value)} style={{
                  padding: "10px 18px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: typDomu === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: typDomu === o.value ? "#374151" : "var(--bg-elevated)",
                  color: typDomu === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Rok výstavby + Výťah */}
          <div className="naber-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={labelSt}>Rok výstavby</label>
              <input type="number" value={rokVystavby} onChange={e => setRokVystavby(e.target.value)} style={inputSt} placeholder="napr. 1985" />
            </div>
            <div>
              <label style={labelSt}>Výťah</label>
              <label style={{ ...checkSt, minHeight: "42px", padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <input type="checkbox" checked={!!vybavenie["Výťah"]} onChange={e => setVybavenie(prev => ({ ...prev, "Výťah": e.target.checked }))} style={{ width: "20px", height: "20px" }} />
                {vybavenie["Výťah"] ? "Áno" : "Nie"}
              </label>
              {vybavenie["Výťah"] && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                  <input
                    type="number" min="0" step="1"
                    value={vymery.vytah || ""}
                    onChange={(e) => setVymery(prev => ({ ...prev, vytah: e.target.value }))}
                    placeholder="Počet"
                    style={{
                      width: "100px", padding: "8px 10px", fontSize: "13px",
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "8px", color: "var(--text-primary)",
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>ks</span>
                </div>
              )}
            </div>
          </div>

          {/* Technický stav domu */}
          <div>
            <label style={labelSt}>Technický stav domu</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginTop: "6px" }}>
              {[
                { checked: zatepleny, set: setZatepleny, label: "Zateplený" },
                { checked: strechaRobena, set: setStrechaRobena, label: "Strecha robená" },
                { checked: stupackyMenene, set: setStupackyMenene, label: "Stúpačky menené" },
                { checked: plastyOkna, set: setPlastyOkna, label: "Plastové okná" },
                { checked: rozvodyMenene, set: setRozvodyMenene, label: "Rozvody menené" },
                { checked: energCertifikat, set: setEnergCertifikat, label: "Energ. certifikát" },
              ].map(item => (
                <label key={item.label} style={{ ...checkSt, minHeight: "44px", padding: "8px 0" }}>
                  <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} style={{ width: "20px", height: "20px" }} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "10px" }}>
            <input value={stavDomuPoznamka} onChange={e => setStavDomuPoznamka(e.target.value)} style={inputSt} placeholder="Poznámka k domu..." />
          </div>
        </div>

        {/* ═══ 2. VSTÚPIŠ DO BYTU — základné info ═══ */}
        <div style={cardSt}>
          <div style={sectionTitle}>🏠 Byt</div>

          <div className="naber-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelSt}>Byt č.</label>
              <input value={bytCislo} onChange={e => setBytCislo(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Plocha m²</label>
              <input type="number" value={plocha} onChange={e => setPlocha(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Poschodie</label>
              <input type="number" value={poschodie} onChange={e => setPoschodie(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Z koľko</label>
              <input type="number" value={zKolko} onChange={e => setZKolko(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Počet miestností</label>
              <input type="number" value={pocetMiestnosti} onChange={e => setPocetMiestnosti(e.target.value)} style={inputSt} placeholder="napr. 4" />
            </div>
            <div>
              <label style={labelSt}>Rok rekonštrukcie</label>
              <input type="number" value={rokRekonstrukcie} onChange={e => setRokRekonstrukcie(e.target.value)} style={inputSt} placeholder="napr. 2018" />
            </div>
          </div>

          {/* Stav */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Stav bytu</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {STAV_OPTIONS.map(o => (
                <button type="button" key={o.value} onClick={() => {
                  const autoFillStavy = ["kompletna_rekonstrukcia", "novostavba"];
                  if (autoFillStavy.includes(o.value)) {
                    setKrytina("nove");
                    setRozvodyMenene(true);
                    setPlastyOkna(true);
                  } else if (autoFillStavy.includes(stav)) {
                    setKrytina("");
                    setRozvodyMenene(false);
                    setPlastyOkna(false);
                  }
                  setStav(o.value);
                }} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: stav === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: stav === o.value ? "#374151" : "var(--bg-elevated)",
                  color: stav === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Vlastníctvo */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Vlastníctvo</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {[{ value: "osobne", label: "Osobné" }, { value: "druzstevne", label: "Družstevné" }].map(o => (
                <button type="button" key={o.value} onClick={() => setVlastnictvo(o.value)} style={{
                  padding: "10px 18px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: vlastnictvo === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: vlastnictvo === o.value ? "#374151" : "var(--bg-elevated)",
                  color: vlastnictvo === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
            {vlastnictvo === "druzstevne" && (
              <input value={druzstvo} onChange={e => setDruzstvo(e.target.value)} style={{ ...inputSt, marginTop: "8px" }} placeholder="Názov družstva" />
            )}
          </div>
        </div>

        {/* ═══ 3. PRECHÁDZAŠ IZBAMI — čo vidíš v byte ═══ */}
        <div style={cardSt}>
          <div style={sectionTitle}>🔧 Stav bytu</div>

          {/* Elektrické rozvody + Vlhkosť */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Elektrické rozvody</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {[{ value: "povodne", label: "Pôvodné" }, { value: "ciastocne_menene", label: "Čiastočne menené" }, { value: "nove", label: "Nové / komplet" }].map(o => (
                <button type="button" key={o.value} onClick={() => setKrytina(krytina === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: krytina === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: krytina === o.value ? "#374151" : "var(--bg-elevated)",
                  color: krytina === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Vlhkosť */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Vlhkosť</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {VLHKOST_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setVlhkost(vlhkost === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: vlhkost === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: vlhkost === o.value ? "#374151" : "var(--bg-elevated)",
                  color: vlhkost === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Podlahy */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Podlahy</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {PODLAHY_CHIPS.map(p => (
                <button type="button" key={p} onClick={() => setPodlahy(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: podlahy.includes(p) ? "2px solid #374151" : "1px solid var(--border)",
                  background: podlahy.includes(p) ? "#374151" : "var(--bg-elevated)",
                  color: podlahy.includes(p) ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{p}</button>
              ))}
            </div>
          </div>

          {/* Kúpeľňa */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Kúpeľňa</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KUPELNA_CHIPS.map(k => (
                <button type="button" key={k} onClick={() => setKupelnaItems(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: kupelnaItems.includes(k) ? "2px solid #374151" : "1px solid var(--border)",
                  background: kupelnaItems.includes(k) ? "#374151" : "var(--bg-elevated)",
                  color: kupelnaItems.includes(k) ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{k}</button>
              ))}
            </div>
          </div>

          {/* Kuchyňa */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Kuchyňa</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KUCHYNA_CHIPS.map(k => (
                <button type="button" key={k} onClick={() => setKuchynaItems(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: kuchynaItems.includes(k) ? "2px solid #374151" : "1px solid var(--border)",
                  background: kuchynaItems.includes(k) ? "#374151" : "var(--bg-elevated)",
                  color: kuchynaItems.includes(k) ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{k}</button>
              ))}
            </div>
          </div>

          {/* Vykurovanie */}
          <div>
            <label style={labelSt}>Vykurovanie</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KURENIE_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setKurenie(kurenie === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: kurenie === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: kurenie === o.value ? "#374151" : "var(--bg-elevated)",
                  color: kurenie === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ 4. VYBAVENIE — čo je v byte ═══ */}
        <div style={cardSt}>
          <div style={sectionTitle}>🛋️ Vybavenie bytu</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            {AMENITY_ITEMS.filter(a => a !== "Výťah").map(a => {
              const spec = getAmenitySpec(a);
              const isChecked = !!vybavenie[a];
              return (
                <div key={a} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ ...checkSt, minHeight: "44px", padding: "8px 0" }}>
                    <input type="checkbox" checked={isChecked}
                      onChange={e => setVybavenie(prev => ({ ...prev, [a]: e.target.checked }))}
                      style={{ width: "20px", height: "20px" }} />
                    {a}
                  </label>
                  {spec && isChecked && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "30px", marginBottom: "4px" }}>
                      <input
                        type="number"
                        step={spec.unit === "m²" ? "0.1" : "1"}
                        min="0"
                        value={vymery[spec.key] || ""}
                        onChange={(e) => setVymery(prev => ({ ...prev, [spec.key]: e.target.value }))}
                        placeholder={spec.unit === "m²" ? "Výmera" : "Počet"}
                        style={{
                          width: "90px", padding: "6px 10px", fontSize: "13px",
                          background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          borderRadius: "8px", color: "var(--text-primary)",
                        }}
                      />
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{spec.unit}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Zariadený */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Zariadený</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {[{ value: "ano", label: "Áno" }, { value: "nie", label: "Nie" }, { value: "ciastocne", label: "Čiastočne" }].map(o => (
                <button type="button" key={o.value} onClick={() => setZariadeny(o.value)} style={{
                  padding: "10px 18px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: zariadeny === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: zariadeny === o.value ? "#374151" : "var(--bg-elevated)",
                  color: zariadeny === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Výhľad */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Výhľad</label>
            <input value={vyhlad} onChange={e => setVyhlad(e.target.value)} style={inputSt} placeholder="záhrada, ulica, panoráma..." />
          </div>

          {/* Označenie */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Označenie nehnuteľnosti</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {[{ value: "ziadne", label: "Žiadne" }, { value: "plachta", label: "Plachta" }].map(o => (
                <button type="button" key={o.value} onClick={() => setOznacenie(o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: oznacenie === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: oznacenie === o.value ? "#374151" : "var(--bg-elevated)",
                  color: oznacenie === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Poznámky */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Poznámky</label>
            <textarea value={poznamkyVybavenie} onChange={e => setPoznamkyVybavenie(e.target.value)} rows={3}
              style={{ ...inputSt, resize: "vertical" }} placeholder="Ďalšie info k bytu..." />
          </div>
        </div>
      </>)}

      {/* ═══ RODINNÝ DOM — prídeš k domu → vstúpiš → izby → pozemok ═══ */}
      {typ === "rodinny_dom" && (<>
        {/* 1. DOM ZVONKU */}
        <div style={cardSt}>
          <div style={sectionTitle}>🏡 Dom</div>

          {/* Typ domu */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Typ</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {DOM_TYP_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setTypDomuDom(o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: typDomuDom === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: typDomuDom === o.value ? "#374151" : "var(--bg-elevated)",
                  color: typDomuDom === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Konštrukcia */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Konštrukcia</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KONSTRUKCIA_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setTypDomu(typDomu === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: typDomu === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: typDomu === o.value ? "#374151" : "var(--bg-elevated)",
                  color: typDomu === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Technické info */}
          <div className="naber-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelSt}>Plocha domu m²</label>
              <input type="number" value={plocha} onChange={e => setPlocha(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Podlaží</label>
              <input type="number" value={pocetPodlazi} onChange={e => setPocetPodlazi(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Rok výstavby</label>
              <input type="number" value={rokVystavby} onChange={e => setRokVystavby(e.target.value)} style={inputSt} placeholder="napr. 1985" />
            </div>
            <div>
              <label style={labelSt}>Rok rekonštrukcie</label>
              <input type="number" value={rokRekonstrukcie} onChange={e => setRokRekonstrukcie(e.target.value)} style={inputSt} placeholder="napr. 2018" />
            </div>
            <div>
              <label style={labelSt}>Počet izieb</label>
              <input type="number" value={pocetIzieb} onChange={e => setPocetIzieb(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Počet miestností</label>
              <input type="number" value={pocetMiestnosti} onChange={e => setPocetMiestnosti(e.target.value)} style={inputSt} />
            </div>
          </div>

          {/* Stav */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Stav</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {STAV_OPTIONS.map(o => (
                <button type="button" key={o.value} onClick={() => {
                  const autoFillStavy = ["kompletna_rekonstrukcia", "novostavba"];
                  if (autoFillStavy.includes(o.value)) {
                    setKrytina("nove");
                    setRozvodyMenene(true);
                    setPlastyOkna(true);
                  } else if (autoFillStavy.includes(stav)) {
                    setKrytina("");
                    setRozvodyMenene(false);
                    setPlastyOkna(false);
                  }
                  setStav(o.value);
                }} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: stav === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: stav === o.value ? "#374151" : "var(--bg-elevated)",
                  color: stav === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Technický stav domu */}
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Technický stav</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginTop: "6px" }}>
              {[
                { checked: zatepleny, set: setZatepleny, label: "Zateplený" },
                { checked: strechaRobena, set: setStrechaRobena, label: "Strecha robená" },
                { checked: plastyOkna, set: setPlastyOkna, label: "Plastové okná" },
                { checked: rozvodyMenene, set: setRozvodyMenene, label: "Rozvody menené" },
                { checked: stupackyMenene, set: setStupackyMenene, label: "Inštalácie menené" },
                { checked: energCertifikat, set: setEnergCertifikat, label: "Energ. certifikát" },
              ].map(item => (
                <label key={item.label} style={{ ...checkSt, minHeight: "44px", padding: "8px 0" }}>
                  <input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} style={{ width: "20px", height: "20px" }} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 2. VNÚTRO DOMU */}
        <div style={cardSt}>
          <div style={sectionTitle}>🔧 Interiér</div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Elektrické rozvody</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {[{ value: "povodne", label: "Pôvodné" }, { value: "ciastocne_menene", label: "Čiastočne menené" }, { value: "nove", label: "Nové / komplet" }].map(o => (
                <button type="button" key={o.value} onClick={() => setKrytina(krytina === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: krytina === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: krytina === o.value ? "#374151" : "var(--bg-elevated)",
                  color: krytina === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Vlhkosť</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {VLHKOST_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setVlhkost(vlhkost === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: vlhkost === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: vlhkost === o.value ? "#374151" : "var(--bg-elevated)",
                  color: vlhkost === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Podlahy</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {PODLAHY_CHIPS.map(p => (
                <button type="button" key={p} onClick={() => setPodlahy(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: podlahy.includes(p) ? "2px solid #374151" : "1px solid var(--border)",
                  background: podlahy.includes(p) ? "#374151" : "var(--bg-elevated)",
                  color: podlahy.includes(p) ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{p}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Kúpeľňa</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KUPELNA_CHIPS.map(k => (
                <button type="button" key={k} onClick={() => setKupelnaItems(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: kupelnaItems.includes(k) ? "2px solid #374151" : "1px solid var(--border)",
                  background: kupelnaItems.includes(k) ? "#374151" : "var(--bg-elevated)",
                  color: kupelnaItems.includes(k) ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{k}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Kuchyňa</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KUCHYNA_CHIPS.map(k => (
                <button type="button" key={k} onClick={() => setKuchynaItems(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: kuchynaItems.includes(k) ? "2px solid #374151" : "1px solid var(--border)",
                  background: kuchynaItems.includes(k) ? "#374151" : "var(--bg-elevated)",
                  color: kuchynaItems.includes(k) ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{k}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelSt}>Vykurovanie</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KURENIE_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setKurenie(kurenie === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: kurenie === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: kurenie === o.value ? "#374151" : "var(--bg-elevated)",
                  color: kurenie === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. INŽINIERSKE SIETE */}
        <div style={cardSt}>
          <div style={sectionTitle}>⚡ Inžinierske siete</div>
          <div>
            <label style={labelSt}>Elektrina</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {ELEKTRINA_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setElektrina(prev => prev.includes(o.value) ? prev.filter(x => x !== o.value) : [...prev, o.value])} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: elektrina.includes(o.value) ? "2px solid #374151" : "1px solid var(--border)",
                  background: elektrina.includes(o.value) ? "#374151" : "var(--bg-elevated)",
                  color: elektrina.includes(o.value) ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Kanalizácia</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {KANALIZACIA_CHIPS.map(o => (
                <button type="button" key={o.value} onClick={() => setKanalizacia(kanalizacia === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: kanalizacia === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: kanalizacia === o.value ? "#374151" : "var(--bg-elevated)",
                  color: kanalizacia === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="naber-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
            <div>
              <label style={labelSt}>Voda</label>
              <input value={vodaByt} onChange={e => setVodaByt(e.target.value)} style={inputSt} placeholder="verejný vodovod, studňa..." />
            </div>
            <div>
              <label style={labelSt}>Plyn</label>
              <input value={plynByt} onChange={e => setPlynByt(e.target.value)} style={inputSt} placeholder="áno / nie je" />
            </div>
            <div>
              <label style={labelSt}>Teplá voda</label>
              <input value={teplaVoda} onChange={e => setTeplaVoda(e.target.value)} style={inputSt} placeholder="bojler, kotol..." />
            </div>
          </div>
        </div>

        {/* 4. POZEMOK PRI DOME */}
        <div style={cardSt}>
          <div style={sectionTitle}>🌿 Pozemok</div>
          <div className="naber-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelSt}>Pozemok m²</label>
              <input type="number" value={pozemokPlocha} onChange={e => setPozemokPlocha(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Záhrada</label>
              <label style={{ ...checkSt, minHeight: "42px", padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                <input type="checkbox" checked={zahrada} onChange={e => setZahrada(e.target.checked)} style={{ width: "20px", height: "20px" }} />
                {zahrada ? "Áno" : "Nie"}
              </label>
              {zahrada && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                  <input
                    type="number" step="0.1"
                    value={vymery.zahrada || ""}
                    onChange={(e) => setVymery(prev => ({ ...prev, zahrada: e.target.value }))}
                    placeholder="Výmera"
                    style={{
                      width: "100px", padding: "8px 10px", fontSize: "13px",
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "8px", color: "var(--text-primary)",
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>m²</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Charakter záhrady</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {[{ v: "okrasna", l: "Okrasná" }, { v: "park", l: "Park" }, { v: "predzahradka", l: "Predzáhradka" }, { v: "ovocny_sad", l: "Ovocný sad" }, { v: "zeleninova", l: "Zeleninová" }, { v: "nie_je", l: "Nie je" }].map(o => (
                <button type="button" key={o.v} onClick={() => setUcelovyUrcenie(ucelovyUrcenie === o.v ? "" : o.v)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: ucelovyUrcenie === o.v ? "2px solid #374151" : "1px solid var(--border)",
                  background: ucelovyUrcenie === o.v ? "#374151" : "var(--bg-elevated)",
                  color: ucelovyUrcenie === o.v ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. VYBAVENIE */}
        <div style={cardSt}>
          <div style={sectionTitle}>🛋️ Vybavenie</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            {AMENITY_ITEMS.map(a => {
              const spec = getAmenitySpec(a);
              const isChecked = !!vybavenie[a];
              return (
                <div key={a} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ ...checkSt, minHeight: "44px", padding: "8px 0" }}>
                    <input type="checkbox" checked={isChecked}
                      onChange={e => setVybavenie(prev => ({ ...prev, [a]: e.target.checked }))}
                      style={{ width: "20px", height: "20px" }} />
                    {a}
                  </label>
                  {spec && isChecked && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "30px", marginBottom: "4px" }}>
                      <input
                        type="number"
                        step={spec.unit === "m²" ? "0.1" : "1"}
                        min="0"
                        value={vymery[spec.key] || ""}
                        onChange={(e) => setVymery(prev => ({ ...prev, [spec.key]: e.target.value }))}
                        placeholder={spec.unit === "m²" ? "Výmera" : "Počet"}
                        style={{
                          width: "90px", padding: "6px 10px", fontSize: "13px",
                          background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          borderRadius: "8px", color: "var(--text-primary)",
                        }}
                      />
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{spec.unit}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Zariadený</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {[{ value: "ano", label: "Áno" }, { value: "nie", label: "Nie" }, { value: "ciastocne", label: "Čiastočne" }].map(o => (
                <button type="button" key={o.value} onClick={() => setZariadeny(o.value)} style={{
                  padding: "10px 18px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: zariadeny === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: zariadeny === o.value ? "#374151" : "var(--bg-elevated)",
                  color: zariadeny === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Označenie</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {[{ value: "ziadne", label: "Žiadne" }, { value: "plachta", label: "Plachta" }].map(o => (
                <button type="button" key={o.value} onClick={() => setOznacenie(o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: oznacenie === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: oznacenie === o.value ? "#374151" : "var(--bg-elevated)",
                  color: oznacenie === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Poznámky</label>
            <textarea value={poznamkyVybavenie} onChange={e => setPoznamkyVybavenie(e.target.value)} rows={3}
              style={{ ...inputSt, resize: "vertical" }} placeholder="Ďalšie info — garáž, prístavba, bazén..." />
          </div>
        </div>
      </>)}

      {/* ═══ POZEMOK — prídeš na miesto → terén → siete ═══ */}
      {typ === "pozemok" && (<>
        <div style={cardSt}>
          <div style={sectionTitle}>🌿 Pozemok</div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelSt}>Druh pozemku</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {[
                { value: "stavebny", label: "Stavebný" }, { value: "zahrada", label: "Záhrada" },
                { value: "orna_poda", label: "Orná pôda" }, { value: "lesny", label: "Lesný" },
                { value: "priemyselny", label: "Priemyselná zóna" }, { value: "pri_vode", label: "Pri vode" },
                { value: "iny", label: "Iné" },
              ].map(o => (
                <button type="button" key={o.value} onClick={() => setDruhPozemku(o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                  border: druhPozemku === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: druhPozemku === o.value ? "#374151" : "var(--bg-elevated)",
                  color: druhPozemku === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="naber-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelSt}>Výmera m²</label>
              <input type="number" value={plocha} onChange={e => setPlocha(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Účelové určenie</label>
              <input value={ucelovyUrcenie} onChange={e => setUcelovyUrcenie(e.target.value)} style={inputSt} placeholder="napr. IBV, záhradkárska..." />
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Charakter pozemku</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
              {[{ v: "zahrada", l: "Záhrada" }, { v: "stavebna_parcela", l: "Stavebná parcela" }, { v: "skladova_plocha", l: "Skladová plocha" }, { v: "mestska_zastavba", l: "Mestská zástavba" }].map(o => (
                <button type="button" key={o.v} onClick={() => setKrytina(krytina === o.v ? "" : o.v)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: krytina === o.v ? "2px solid #374151" : "1px solid var(--border)",
                  background: krytina === o.v ? "#374151" : "var(--bg-elevated)",
                  color: krytina === o.v ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.l}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Oplotenie</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {[{ value: "cely", label: "Celý pozemok" }, { value: "cast", label: "Časť pozemku" }, { value: "nie", label: "Nie je" }].map(o => (
                <button type="button" key={o.value} onClick={() => setVlhkost(vlhkost === o.value ? "" : o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: vlhkost === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: vlhkost === o.value ? "#374151" : "var(--bg-elevated)",
                  color: vlhkost === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={cardSt}>
          <div style={sectionTitle}>⚡ Siete a prístup</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
            {(["voda", "plyn", "elektrina", "kanal"] as const).map(s => (
              <label key={s} style={{ ...checkSt, minHeight: "44px", padding: "8px 0" }}>
                <input type="checkbox" checked={siete[s]} onChange={e => setSiete(prev => ({ ...prev, [s]: e.target.checked }))} style={{ width: "20px", height: "20px" }} />
                {{ voda: "Voda", plyn: "Plyn", elektrina: "Elektrina", kanal: "Kanalizácia" }[s]}
              </label>
            ))}
            <label style={{ ...checkSt, minHeight: "44px", padding: "8px 0" }}>
              <input type="checkbox" checked={pristupovaCesta} onChange={e => setPristupovaCesta(e.target.checked)} style={{ width: "20px", height: "20px" }} />
              Prístupová cesta
            </label>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Označenie</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              {[{ value: "ziadne", label: "Žiadne" }, { value: "plachta", label: "Plachta" }].map(o => (
                <button type="button" key={o.value} onClick={() => setOznacenie(o.value)} style={{
                  padding: "10px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                  border: oznacenie === o.value ? "2px solid #374151" : "1px solid var(--border)",
                  background: oznacenie === o.value ? "#374151" : "var(--bg-elevated)",
                  color: oznacenie === o.value ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <label style={labelSt}>Poznámky</label>
            <textarea value={poznamkyVybavenie} onChange={e => setPoznamkyVybavenie(e.target.value)} rows={3}
              style={{ ...inputSt, resize: "vertical" }} placeholder="Ďalšie info — svažitosť, orientácia, susedia..." />
          </div>
        </div>
      </>)}

      {/* 7. Financie */}
      <div style={cardSt}>
        <div style={sectionTitle}>💰 Financie</div>
        <div className="naber-grid" style={gridSt}>
          <div>
            <label style={labelSt}>Predajná cena (€) <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "400" }}>— automaticky Baťovská pri opustení políčka</span></label>
            <input
              type="number"
              value={predajnaCena}
              onChange={e => setPredajnaCena(e.target.value)}
              onBlur={e => {
                const n = Number(e.target.value);
                let finalVal = e.target.value;
                if (n >= 1000) {
                  const batovska = Math.ceil(n / 1000) * 1000 - 100;
                  finalVal = String(batovska);
                  setPredajnaCena(finalVal);
                }
                triggerAnalyza(finalVal);
              }}
              style={inputSt}
            />
          </div>
          {typ !== "pozemok" && (
            <div>
              <label style={labelSt}>Mesačné poplatky (€)</label>
              <input type="number" value={mesacnePoplatky} onChange={e => setMesacnePoplatky(e.target.value)} style={inputSt} />
            </div>
          )}
          <div>
            <label style={labelSt}>Provízia <span style={{ color: "#EF4444" }}>*</span></label>
            <input value={provizia} onChange={e => setProvizia(e.target.value)}
              style={{ ...inputSt, borderColor: ((provizia ?? "").toString().trim() === "") ? "#FCA5A5" : "var(--border)" }}
              placeholder="napr. 3% alebo 5000€" />
          </div>
          <div>
            <label style={labelSt}>Typ provízie</label>
            <RadioGroup value={proviziaTyp} onChange={v => setProviziaTyp(v as "z_kupnej" | "nad_cenu")} options={[
              { value: "z_kupnej", label: "Z kúpnej ceny" },
              { value: "nad_cenu", label: "Nad cenu majiteľa" },
            ]} />
          </div>
          {typ !== "pozemok" && (
            <div>
              <label style={labelSt}>Zostatok hypotéky (€)</label>
              <input value={anuita} onChange={e => setAnuita(e.target.value)} style={inputSt} placeholder="napr. 85000" />
            </div>
          )}
          <div>
            <label style={labelSt}>Maklér</label>
            <input value={makler} onChange={e => setMakler(e.target.value)} style={inputSt} />
          </div>
        </div>
        {/* Ak zostatok hypotéky je vyplnený a vyplatenie z kupnej ceny — upozornenie */}
        {anuita && tarchyRiesenie === "z_kupnej" && (
          <div style={{ marginTop: "12px", padding: "10px 12px", background: "#FEF3C7", borderRadius: "8px", border: "1px solid #FDE68A", fontSize: "12px", color: "#92400E" }}>
            ⚠️ Zostatok hypotéky ({anuita} €) bude vyplatený z kúpnej ceny
          </div>
        )}
      </div>

      {/* Finančné kalkulačky */}
      {predajnaCena && Number(predajnaCena) > 0 && (
        <FinancneKalkulacky
          predajnaCena={Number(predajnaCena)}
          provizia={provizia ?? ""}
          urok={urok}
          setUrok={setUrok}
          analyza={analyza}
          analyzaLoading={analyzaLoading}
          onRefreshAnalyza={() => triggerAnalyza()}
          onProviziaChange={setProvizia}
        />
      )}

      {/* 7b. Ťarchy / právne vady */}
      {lvPravneVady && (
        <div style={{ ...cardSt, border: "1.5px solid #FDE68A", background: "var(--bg-surface)" }}>
          <div style={sectionTitle}>⚠️ Ťarchy / právne vady</div>
          <div style={{ padding: "10px 12px", background: "#FEF3C7", borderRadius: "8px", border: "1px solid #FDE68A", marginBottom: "14px" }}>
            <div style={{ fontSize: "13px", color: "#92400E", lineHeight: 1.5 }}>{lvPravneVady}</div>
          </div>
          <div>
            <label style={labelSt}>Riešenie ťarchy</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
              {[
                { value: "z_kupnej" as const, label: "Vyplatenie z kúpnej ceny", desc: "Ťarcha sa vyplatí priamo z kúpnej ceny pri podpise" },
                { value: "prenos" as const, label: "Prenos na inú nehnuteľnosť", desc: "Záložné právo sa prenesie na inú nehnuteľnosť predávajúceho" },
                { value: "pred_podpisom" as const, label: "Vyplatenie pred podpisom KZ", desc: "Predávajúci vyplatí ťarchu ešte pred podpisom kúpnej zmluvy" },
              ].map(o => (
                <button key={o.value} onClick={() => setTarchyRiesenie(o.value)} style={{
                  padding: "12px 14px", borderRadius: "10px", cursor: "pointer", textAlign: "left",
                  border: tarchyRiesenie === o.value ? "2px solid #F59E0B" : "1px solid var(--border)",
                  background: tarchyRiesenie === o.value ? "#FFFBEB" : "var(--bg-elevated)",
                }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{o.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7c. Zmluva */}
      <div style={cardSt}>
        <div style={sectionTitle}>📝 Zmluva</div>
        <div style={{ marginTop: "0" }}>
          <label style={{ ...checkSt, fontWeight: "600", marginBottom: "8px", minHeight: "44px" }}>
            <input type="checkbox" checked={zmluva} onChange={e => { setZmluva(e.target.checked); if (e.target.checked && !datumPodpisu) setDatumPodpisu(new Date().toISOString().split("T")[0]); }} style={{ width: "20px", height: "20px" }} />
            Klient má záujem podpísať zmluvu
          </label>
          {zmluva && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "16px", marginTop: "8px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={labelSt}>Typ zmluvy</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  {[{ value: "exkluzivna", label: "Exkluzívna" }, { value: "neexkluzivna", label: "Neexkluzívna" }].map(o => (
                    <button type="button" key={o.value} onClick={() => { setTypZmluvy(o.value); setTypInzercie(o.value === "exkluzivna" ? "vyhradne" : "online"); }} style={{
                      padding: "10px 18px", borderRadius: "20px", fontSize: "13px", fontWeight: "600",
                      border: typZmluvy === o.value ? "2px solid #374151" : "1px solid var(--border)",
                      background: typZmluvy === o.value ? "#374151" : "var(--bg-surface)",
                      color: typZmluvy === o.value ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer", flex: 1, textAlign: "center",
                    }}>{o.label}</button>
                  ))}
                </div>
              </div>
              <div className="naber-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelSt}>Dátum podpisu</label>
                  <input type="date" value={datumPodpisu} onChange={e => setDatumPodpisu(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Zmluva platná do</label>
                  <input type="date" value={zmluvaDo} onChange={e => setZmluvaDo(e.target.value)} style={inputSt} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: "16px" }}>
          <label style={labelSt}>Popis</label>
          <textarea value={popis} onChange={e => setPopis(e.target.value)} rows={3}
            style={{ ...inputSt, resize: "vertical" }} placeholder="Doplňujúce informácie..." />
        </div>
      </div>

      {/* 8. Typ inzercie */}
      <div style={cardSt}>
        <div style={sectionTitle}>📢 Typ inzercie</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }} className="naber-grid">
          {TYP_INZERCIE_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setTypInzercie(o.value)} style={{
              padding: "14px 16px", borderRadius: "12px", cursor: "pointer", textAlign: "left",
              background: typInzercie === o.value ? "#374151" : "var(--bg-elevated)",
              color: typInzercie === o.value ? "#fff" : "var(--text-primary)",
              border: typInzercie === o.value ? "2px solid #374151" : "1px solid var(--border)",
              transition: "all 0.15s",
            }}>
              <div style={{ fontSize: "14px", fontWeight: "600" }}>{o.label}</div>
              <div style={{ fontSize: "11px", marginTop: "2px", color: typInzercie === o.value ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 9. Dokumenty */}
      <div style={cardSt}>
        <div style={sectionTitle}>📄 Dokumenty</div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px", marginTop: "-8px" }}>
          Odklikaj prijaté dokumenty a ofoť ich
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {DOKUMENTY_CHECKLIST.map(doc => (
            <div key={doc.key} style={{
              padding: "12px 14px", borderRadius: "10px",
              background: dokumenty[doc.key] ? "#F0FDF4" : "var(--bg-elevated)",
              border: dokumenty[doc.key] ? "1px solid #BBF7D0" : "1px solid var(--border)",
              transition: "all 0.15s",
            }}>
              <label style={{ ...checkSt, padding: 0, marginBottom: dokumenty[doc.key] ? "8px" : 0 }}>
                <input type="checkbox" checked={!!dokumenty[doc.key]}
                  onChange={e => setDokumenty(prev => ({ ...prev, [doc.key]: e.target.checked }))} />
                <span style={{ fontWeight: "500" }}>{doc.label}</span>
                {dokumenty[doc.key] && <span style={{ marginLeft: "auto", fontSize: "14px" }}>✓</span>}
              </label>
              {dokumenty[doc.key] && (
                <div style={{ marginLeft: "24px" }}>
                  {(dokumentyFotos[doc.key] || []).length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                      {(dokumentyFotos[doc.key] || []).map((foto, i) => (
                        <div key={i} style={{ position: "relative", width: "60px", height: "60px" }}>
                          {foto.startsWith("pdf:") ? (
                            <div style={{
                              width: "60px", height: "60px", background: "#FEF2F2", borderRadius: "8px",
                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                              border: "1px solid #FECACA",
                            }}>
                              <span style={{ fontSize: "20px" }}>📄</span>
                              <span style={{ fontSize: "8px", color: "#666", textAlign: "center", padding: "0 2px" }}>PDF</span>
                            </div>
                          ) : (
                            <img src={foto} alt="" style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--border)" }} />
                          )}
                          <button onClick={() => removeDocFoto(doc.key, i)} style={{
                            position: "absolute", top: "-6px", right: "-6px",
                            width: "20px", height: "20px", borderRadius: "50%",
                            background: "#EF4444", color: "#fff", border: "none",
                            fontSize: "11px", cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center",
                          }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => { setScannerDocKey(doc.key); setScannerOpen(true); }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        padding: "6px 12px", borderRadius: "8px", fontSize: "12px",
                        color: "var(--text-secondary)", background: "var(--bg-surface)",
                        border: "1px solid var(--border)", cursor: "pointer",
                      }}
                    >
                      📷 Skenovať
                    </button>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      padding: "6px 12px", borderRadius: "8px", fontSize: "12px",
                      color: "var(--text-secondary)", background: "var(--bg-surface)",
                      border: "1px solid var(--border)", cursor: "pointer",
                    }}>
                      📁 Súbor
                      <input type="file" accept="image/*,application/pdf" multiple
                        onChange={e => handleDocFoto(doc.key, e.target.files)}
                        style={{ display: "none" }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 10. AI Odhad ceny (collapsible) */}
      {typ !== "pozemok" && (
        <div style={cardSt}>
          {/* Collapsed header — vždy viditeľný */}
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={() => setAiOdhadOpen(o => !o)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "15px" }}>📊</span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>Odhad ceny</div>
                {!aiOdhadOpen && (() => {
                  const m2 = Number(plocha) || 0;
                  if (m2 <= 0) return <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Zadaj plochu pre výpočet</div>;
                  const trhCena = m2 * odhadCenaM2;
                  const rekoCena = potrebujeReko ? m2 * rekonstrukciaM2 : 0;
                  const vykup = trhCena - rekoCena - trhCena * (marza / 100);
                  return (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      Trhová: <strong style={{ color: "#1E40AF" }}>{trhCena.toLocaleString("sk")} €</strong>
                      {" · "}Výkup: <strong style={{ color: vykup > 0 ? "#059669" : "#DC2626" }}>{vykup.toLocaleString("sk")} €</strong>
                    </div>
                  );
                })()}
              </div>
            </div>
            <span style={{ fontSize: "20px", color: "var(--text-muted)", fontWeight: "300", lineHeight: 1 }}>{aiOdhadOpen ? "−" : "+"}</span>
          </div>

          {aiOdhadOpen && (
            <div style={{ marginTop: "16px" }}>
              <div className="naber-grid" style={gridSt}>
                <div>
                  <label style={labelSt}>Cena za m² (€)</label>
                  <input type="number" value={odhadCenaM2} onChange={e => setOdhadCenaM2(Number(e.target.value) || 0)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Rekonštrukcia za m² (€)</label>
                  <input type="number" value={rekonstrukciaM2} onChange={e => setRekonstrukciaM2(Number(e.target.value) || 0)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Marža (%)</label>
                  <input type="number" value={marza} onChange={e => setMarza(Number(e.target.value) || 0)} style={inputSt} min={0} max={50} />
                </div>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <label style={{ ...checkSt, padding: "10px 0", fontWeight: "500" }}>
                    <input type="checkbox" checked={potrebujeReko} onChange={e => setPotrebujeReko(e.target.checked)} />
                    Potrebuje rekonštrukciu
                  </label>
                </div>
              </div>
              {(() => {
                const m2 = Number(plocha) || 0;
                if (m2 <= 0) return (
                  <div style={{ marginTop: "16px", padding: "12px 16px", background: "#FEF3C7", borderRadius: "10px", fontSize: "13px", color: "#92400E" }}>
                    Zadaj výmeru (m²) pre výpočet odhadu
                  </div>
                );
                const trhCena = m2 * odhadCenaM2;
                const rekoCena = potrebujeReko ? m2 * rekonstrukciaM2 : 0;
                const marzaEur = trhCena * (marza / 100);
                const vykupCena = trhCena - rekoCena - marzaEur;
                return (
                  <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }} className="naber-grid">
                    <div style={{ padding: "16px", borderRadius: "12px", background: "#EFF6FF", border: "1px solid #BFDBFE", textAlign: "center" }}>
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "#1D4ED8", marginBottom: "4px" }}>TRHOVÁ CENA</div>
                      <div style={{ fontSize: "20px", fontWeight: "800", color: "#1E40AF" }}>{trhCena.toLocaleString("sk")} €</div>
                      <div style={{ fontSize: "10px", color: "#3B82F6", marginTop: "2px" }}>{m2} m² × {odhadCenaM2} €</div>
                    </div>
                    {potrebujeReko && (
                      <div style={{ padding: "16px", borderRadius: "12px", background: "#FEF3C7", border: "1px solid #FDE68A", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", fontWeight: "600", color: "#92400E", marginBottom: "4px" }}>REKONŠTRUKCIA</div>
                        <div style={{ fontSize: "20px", fontWeight: "800", color: "#B45309" }}>-{rekoCena.toLocaleString("sk")} €</div>
                      </div>
                    )}
                    <div style={{ padding: "16px", borderRadius: "12px", background: vykupCena > 0 ? "#F0FDF4" : "#FEF2F2", border: vykupCena > 0 ? "1px solid #BBF7D0" : "1px solid #FECACA", textAlign: "center" }}>
                      <div style={{ fontSize: "11px", fontWeight: "600", color: vykupCena > 0 ? "#065F46" : "#991B1B", marginBottom: "4px" }}>VÝKUPOVÁ CENA</div>
                      <div style={{ fontSize: "20px", fontWeight: "800", color: vykupCena > 0 ? "#059669" : "#DC2626" }}>{vykupCena.toLocaleString("sk")} €</div>
                      <div style={{ fontSize: "10px", color: vykupCena > 0 ? "#10B981" : "#EF4444", marginTop: "2px" }}>Marža {marza}% = {marzaEur.toLocaleString("sk")} €</div>
                    </div>
                  </div>
                );
              })()}
              {/* AI Analýza */}
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <button onClick={handleAiAnalyza} disabled={analyzujeAI} style={{
                  padding: "9px 18px", background: analyzujeAI ? "#9CA3AF" : "#374151", color: "#fff",
                  border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
                  cursor: analyzujeAI ? "default" : "pointer",
                }}>
                  {analyzujeAI ? "Analyzujem..." : "🤖 AI analýza trhu"}
                </button>
                {aiAnalyza && (
                  <div style={{ marginTop: "12px", padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: "10px", border: "1px solid var(--border)", fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                    {aiAnalyza}
                  </div>
                )}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "10px", textAlign: "center" }}>
                Hodnoty sú orientačné. Ceny za m² nastavíš v Nastaveniach.
              </div>
            </div>
          )}
        </div>
      )}

      {/* 11. Podpis klienta */}
      <div style={cardSt}>
        <div style={sectionTitle}>✍️ Potvrdenie klientom</div>
        {/* Výber vlastníkov ktorí podpisujú */}
        {allLvOwners.length > 1 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
              Kto podpisuje
            </div>
            {allLvOwners.map((owner, i) => (
              <label key={i} style={{ ...checkSt, padding: "4px 0" }}>
                <input
                  type="checkbox"
                  checked={podpisOwners.includes(owner.meno!)}
                  onChange={e => setPodpisOwners(prev =>
                    e.target.checked ? [...prev, owner.meno!] : prev.filter(n => n !== owner.meno)
                  )}
                />
                <span>{owner.meno}</span>
                {owner.podiel && <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>podiel {owner.podiel}</span>}
              </label>
            ))}
            {/* Zastupca */}
            <div style={{ marginTop: "10px", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <label style={{ ...checkSt, padding: 0, marginBottom: zastupca !== "" ? "8px" : 0, fontSize: "12px", color: "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  checked={zastupca !== ""}
                  onChange={e => { if (!e.target.checked) { setZastupca(""); setZastupca_za(""); } else setZastupca(" "); }}
                />
                Podpisuje zástupca (splnomocnenie)
              </label>
              {zastupca !== "" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={{ ...labelSt, marginBottom: "3px" }}>Meno zástupcu</label>
                    <input value={zastupca.trim()} onChange={e => setZastupca(e.target.value)} style={{ ...inputSt, padding: "7px 10px" }} placeholder="Meno a priezvisko" />
                  </div>
                  <div>
                    <label style={{ ...labelSt, marginBottom: "3px" }}>Zastupuje</label>
                    <input value={zastupca_za} onChange={e => setZastupca_za(e.target.value)} style={{ ...inputSt, padding: "7px 10px" }} placeholder="Koho zastupuje" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
          {podpisOwners.length > 0
            ? `Vyššie uvedené informácie potvrdzuje: ${podpisOwners.join(", ")}${zastupca.trim() ? ` (zastupuje: ${zastupca.trim()})` : ""}`
            : "Vyššie uvedené informácie potvrdzuje (podpis klienta):"}
        </div>

        {/* Toggle: Klient nie je prítomný — pošlem mu link na podpis cez email */}
        <label style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 14px", marginBottom: "12px",
          background: remoteSignMode ? "#EFF6FF" : "var(--bg-elevated)",
          border: remoteSignMode ? "1px solid #3B82F6" : "1px solid var(--border)",
          borderRadius: "10px", cursor: "pointer",
          fontSize: "13px", color: remoteSignMode ? "#1E40AF" : "var(--text-secondary)",
          fontWeight: remoteSignMode ? 600 : 400,
        }}>
          <input
            type="checkbox"
            checked={remoteSignMode}
            onChange={e => setRemoteSignMode(e.target.checked)}
            style={{ cursor: "pointer", flexShrink: 0 }}
          />
          <span>📧 Klient nie je tu — pošlem mu link na podpis cez email{klient.email ? ` (${klient.email})` : " (email zadám pri odosielaní)"}</span>
        </label>

        <div style={{ display: remoteSignMode ? "none" : "block" }}>
          {/* GDPR explicitný súhlas — pred canvasom, aby kreslenie podpisu nespôsobilo accidentálny uncheck */}
          <label style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            padding: "12px 14px", marginBottom: "14px",
            background: "var(--bg-elevated)",
            border: gdprConsent ? "1px solid #10B981" : "1px solid var(--border)",
            borderRadius: "10px", cursor: "pointer",
            fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5,
          }}>
            <input
              type="checkbox"
              checked={gdprConsent}
              onChange={e => setGdprConsent(e.target.checked)}
              style={{ marginTop: "2px", cursor: "pointer", flexShrink: 0 }}
            />
            <span>
              Súhlasím so spracovaním mojich osobných údajov spoločnosťou Vianema s. r. o.
              v zmysle GDPR pre účely sprostredkovania predaja/prenájmu nehnuteľnosti.
              Plné znenie:{" "}
              <a href="/gdpr" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent, #3B82F6)", textDecoration: "underline" }}>
                Zásady spracovania osobných údajov →
              </a>
            </span>
          </label>

          <SignatureCanvas onSignatureChange={setPodpisData} />
        </div>

        <div style={{ display: !remoteSignMode ? "none" : "block" }}>
          <div style={{
            padding: "14px 16px", borderRadius: "10px",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5,
          }}>
            Náberák uložíme bez podpisu. Po uložení sa otvorí dialóg kde
            zadáš email klienta (predvyplníme ho z karty ak existuje) a pošle sa mu
            link + 6-ciferný kód na podpis. GDPR súhlas zaznamenáme v momente jeho
            potvrdenia.
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", background: "#FEF2F2", borderRadius: "10px",
          color: "#991B1B", fontSize: "13px", marginBottom: "16px", border: "1px solid #FECACA",
        }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={saving} style={{
        width: "100%", padding: "14px",
        background: saving ? "#9CA3AF" : remoteSignMode ? "#1d4ed8" : "#374151",
        color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px",
        fontWeight: "700", cursor: saving ? "default" : "pointer",
        marginBottom: "40px",
      }}>
        {saving ? "Ukladám..." : remoteSignMode ? "📧 Uložiť a poslať klientovi link na podpis" : "Uložiť náberový list"}
      </button>

      <DocumentScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        docLabel={
          (() => {
            const found = ([] as { key: string; label: string }[]).concat(
              [
                { key: "lv", label: "List vlastníctva" },
                { key: "energeticky_certifikat", label: "Energetický certifikát" },
                { key: "podorys", label: "Pôdorys" },
                { key: "nahlad_katastra", label: "Náhľad z katastra" },
                { key: "znalecky_posudok", label: "Znalecký posudok" },
                { key: "ine", label: "Iný dokument" },
              ]
            ).find(d => d.key === scannerDocKey);
            return found ? found.label : scannerDocKey;
          })()
        }
        onSave={handleScanSave}
      />
    </div>
  );
}

/* ── Finančné kalkulačky ──────────────────────────────────────────────────── */
type AnalyzaResultExt = {
  priemerna_cena_m2: number; odporucana_od: number; odporucana_do: number;
  hodnotenie: "V rozsahu" | "Mierne vysoká" | "Vysoká" | "Mierne nízka" | "Nízka";
  odchylka_pct: number; pocet_porovnani: number; zdroj: "monitor" | "benchmark"; komentar: string;
  porovnania?: { nazov: string; url: string | null; cena: number; plocha: number; eurM2: number }[];
};

function FinancneKalkulacky({
  predajnaCena, provizia, urok, setUrok, analyza, analyzaLoading, onRefreshAnalyza, onProviziaChange,
}: {
  predajnaCena: number;
  provizia: string;
  urok: string;
  setUrok: (v: string) => void;
  analyza: AnalyzaResultExt | null;
  analyzaLoading: boolean;
  onRefreshAnalyza: () => void;
  onProviziaChange: (v: string) => void;
}) {
  // Hypotéka: 80% LTV, nastaviteľný úrok, 30 rokov
  const P = predajnaCena * 0.8;
  const r = (parseFloat(urok) || 3.5) / 100 / 12;
  const n = 360;
  const M = r > 0 ? Math.round(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)) : 0;
  const potrebnyPrijem = Math.round(M / 0.40);
  const vlastneZdroje = Math.round(predajnaCena * 0.20 + predajnaCena * 0.035);

  // Provízia porovnanie
  const pctSadzby = [3, 4, 5];
  function proviziaEur(pct: number) { return Math.round(predajnaCena * pct / 100); }

  function isHighlighted(pct: number): boolean {
    if (!provizia) return false;
    const pctMatch = provizia.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
    if (pctMatch) return parseFloat(pctMatch[1].replace(",", ".")) === pct;
    const numVal = parseFloat(provizia.replace(/\s/g, "").replace(",", "."));
    if (!isNaN(numVal)) {
      const impliedPct = Math.round((numVal / predajnaCena) * 100);
      return impliedPct === pct;
    }
    return false;
  }

  const cardSt: React.CSSProperties = {
    background: "var(--bg-surface)", borderRadius: "16px",
    padding: "18px 20px", border: "1px solid var(--border)", marginBottom: "14px",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.04em",
  };

  function hodnoteniaColor(h: string) {
    if (h === "V rozsahu") return { bg: "#F0FDF4", color: "#166534" };
    if (h === "Mierne vysoká") return { bg: "#FEF9C3", color: "#854D0E" };
    if (h === "Vysoká") return { bg: "#FEF2F2", color: "#991B1B" };
    if (h === "Mierne nízka") return { bg: "#EFF6FF", color: "#1D4ED8" };
    return { bg: "#EFF6FF", color: "#1D4ED8" };
  }

  const [showInzeraty, setShowInzeraty] = useState(false);

  return (
    <>
      {/* Panel 1: Porovnanie provízií */}
      <div style={cardSt}>
        <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>Porovnanie provízií</div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px" }}>Klikni na sadzbu — nastaví sa do políčka Provízia</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {pctSadzby.map(pct => {
            const hl = isHighlighted(pct);
            return (
              <button
                key={pct}
                onClick={() => onProviziaChange(`${pct}%`)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                  background: hl ? "#374151" : "var(--bg-elevated)",
                  border: hl ? "2px solid #374151" : "1px solid var(--border)",
                  width: "100%", textAlign: "left",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: hl ? "700" : "500", color: hl ? "#fff" : "var(--text-primary)" }}>
                  {pct} %{hl ? " ← vaša" : ""}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: hl ? "#fff" : "var(--text-primary)" }}>
                  {proviziaEur(pct).toLocaleString("sk-SK")} €
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel 2: AI Trhová analýza */}
      <div style={cardSt}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700" }}>Analýza trhu</div>
          <button
            onClick={onRefreshAnalyza}
            disabled={analyzaLoading}
            style={{
              padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border)",
              background: "var(--bg-elevated)", fontSize: "12px", cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            {analyzaLoading ? "..." : "Obnoviť"}
          </button>
        </div>

        {analyzaLoading && (
          <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "8px 0" }}>
            Načítavam dáta z trhu...
          </div>
        )}

        {!analyzaLoading && !analyza && (
          <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            Analýza sa spustí automaticky po zadaní predajnej ceny.
          </div>
        )}

        {!analyzaLoading && analyza && (() => {
          const hColors = hodnoteniaColor(analyza.hodnotenie);
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "12px" }}>
                  <div style={labelSt}>Odporúčaná cena</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "4px" }}>
                    {analyza.odporucana_od.toLocaleString("sk-SK")} – {analyza.odporucana_do.toLocaleString("sk-SK")} €
                  </div>
                </div>
                <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "12px" }}>
                  <div style={labelSt}>Priemer €/m²</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "4px" }}>
                    {analyza.priemerna_cena_m2.toLocaleString("sk-SK")} €
                  </div>
                </div>
                <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "12px" }}>
                  <div style={labelSt}>Hodnotenie ceny</div>
                  <div style={{
                    display: "inline-block", marginTop: "6px",
                    padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
                    background: hColors.bg, color: hColors.color,
                  }}>
                    {analyza.hodnotenie} ({analyza.odchylka_pct > 0 ? "+" : ""}{analyza.odchylka_pct}%)
                  </div>
                </div>
                <button
                  onClick={() => setShowInzeraty(v => !v)}
                  style={{
                    background: "var(--bg-elevated)", borderRadius: "10px", padding: "12px",
                    border: "1px solid var(--border)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={labelSt}>Porovnaní</div>
                  <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "4px", color: "var(--text-primary)" }}>
                    {analyza.pocet_porovnani} {analyza.zdroj === "benchmark" ? "(benchmark)" : "inzerátov"} {analyza.pocet_porovnani > 0 ? (showInzeraty ? "▲" : "▼") : ""}
                  </div>
                </button>
              </div>

              {showInzeraty && analyza.porovnania && analyza.porovnania.length > 0 && (
                <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {analyza.porovnania.map((p, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", borderRadius: "8px", background: "var(--bg-elevated)",
                      gap: "8px",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {p.url ? (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "12px", color: "var(--text-link, #60A5FA)", textDecoration: "none",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                            }}
                          >
                            {p.nazov}
                          </a>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{p.nazov}</span>
                        )}
                      </div>
                      <div style={{ whiteSpace: "nowrap", fontSize: "12px", color: "var(--text-secondary)", flexShrink: 0 }}>
                        {p.cena.toLocaleString("sk-SK")} € · {p.plocha} m² · {p.eurM2.toLocaleString("sk-SK")} €/m²
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analyza.komentar && (
                <div style={{
                  padding: "12px 14px", borderRadius: "10px", background: "var(--bg-elevated)",
                  fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, fontStyle: "italic",
                }}>
                  {analyza.komentar}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Panel 3: Splátka hypotéky */}
      <div style={cardSt}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700" }}>Splátka hypotéky</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={labelSt}>Úrok</span>
            <input
              type="number" step="0.1" min="0.5" max="15"
              value={urok} onChange={e => setUrok(e.target.value)}
              style={{
                width: "64px", padding: "5px 8px", border: "1px solid var(--border)",
                borderRadius: "8px", fontSize: "13px", background: "var(--bg-elevated)",
                color: "var(--text-primary)", textAlign: "right",
              }}
            />
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>%</span>
          </div>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px" }}>
          80 % LTV · 30 rokov fixné
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          {[
            { label: "Mesačná splátka", value: `${M.toLocaleString("sk-SK")} €` },
            { label: "Potrebný príjem", value: `${potrebnyPrijem.toLocaleString("sk-SK")} €` },
            { label: "Vlastné zdroje", value: `${vlastneZdroje.toLocaleString("sk-SK")} €` },
          ].map(item => (
            <div key={item.label} style={{
              background: "var(--bg-elevated)", borderRadius: "10px", padding: "12px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>{item.value}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
