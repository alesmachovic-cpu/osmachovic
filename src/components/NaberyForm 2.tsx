"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { KRAJE } from "@/lib/database.types";
import type { Klient, TypInzercie } from "@/lib/database.types";
import SignatureCanvas from "@/components/SignatureCanvas";

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
  { value: "novostavba", label: "Novostavba" },
  { value: "schatralý", label: "Schátralý" },
  { value: "invest_zamer", label: "Investičný zámer" },
  { value: "projekt", label: "Projekt" },
  { value: "vystavba", label: "Výstavba" },
];

const AMENITY_ITEMS = [
  "Telefón", "Výťah", "Balkón", "Kábel", "Lodžia",
  "Garáž", "Satelit", "Pivnica", "Parking",
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
}

export default function NaberyForm({ typ, klient, onBack, onSubmit }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Typ inzercie
  const [typInzercie, setTypInzercie] = useState<TypInzercie>("online");

  // Location
  const [kraj, setKraj] = useState("");
  const [okres, setOkres] = useState("");
  const [obec, setObec] = useState(klient.lokalita || "");
  const [castObce, setCastObce] = useState("");
  const [katUzemie, setKatUzemie] = useState("");
  const [ulica, setUlica] = useState("");
  const [supisneCislo, setSupisneCislo] = useState("");
  const [cisloOrientacne, setCisloOrientacne] = useState("");

  // Property common
  const [plocha, setPlocha] = useState("");
  const [stav, setStav] = useState("");
  const [poznamkyVybavenie, setPoznamkyVybavenie] = useState("");

  // Byt-specific
  const [pocetIzieb, setPocetIzieb] = useState("");
  const [vlastnictvo, setVlastnictvo] = useState("osobne");
  const [druzstvo, setDruzstvo] = useState("");
  const [typDomu, setTypDomu] = useState("");
  const [bytCislo, setBytCislo] = useState("");
  const [poschodie, setPoschodie] = useState("");
  const [zKolko, setZKolko] = useState("");
  const [kurenie, setKurenie] = useState("");
  const [typPodlahy, setTypPodlahy] = useState("");
  const [anuita, setAnuita] = useState("");
  const [vyhlad, setVyhlad] = useState("");
  const [mesacnePoplatky, setMesacnePoplatky] = useState("");

  // Dom-specific
  const [pocetPodlazi, setPocetPodlazi] = useState("");
  const [rokVystavby, setRokVystavby] = useState("");
  const [pozemokPlocha, setPozemokPlocha] = useState("");
  const [zahrada, setZahrada] = useState(false);

  // Pozemok-specific
  const [druhPozemku, setDruhPozemku] = useState("");
  const [pristupovaCesta, setPristupovaCesta] = useState(false);
  const [siete, setSiete] = useState({ voda: false, plyn: false, elektrina: false, kanal: false });
  const [ucelovyUrcenie, setUcelovyUrcenie] = useState("");

  // Označenie
  const [oznacenie, setOznacenie] = useState("ziadne");

  // Vybavenie
  const [vybavenie, setVybavenie] = useState<Record<string, boolean>>({});
  const [zariadeny, setZariadeny] = useState("");

  // Majiteľ — auto-fill z klienta
  const [majitel, setMajitel] = useState(klient.meno || "");
  const [konatel, setKonatel] = useState("");
  const [jednatel, setJednatel] = useState("");
  const [kontaktMajitel, setKontaktMajitel] = useState(klient.telefon || "");
  const [uzivatel, setUzivatel] = useState("");
  const [kontaktUzivatel, setKontaktUzivatel] = useState("");

  // Predaj
  const [predajnaCena, setPredajnaCena] = useState("");
  const [makler, setMakler] = useState("Aleš Machovič");
  const [zmluva, setZmluva] = useState(false);
  const [typZmluvy, setTypZmluvy] = useState("exkluzivna");
  const [datumPodpisu, setDatumPodpisu] = useState("");
  const [zmluvaDo, setZmluvaDo] = useState("");
  const [provizia, setProvizia] = useState("");
  const [popis, setPopis] = useState("");

  // Podpis
  const [podpisData, setPodpisData] = useState<string | null>(null);

  // Dokumenty
  const [dokumenty, setDokumenty] = useState<Record<string, boolean>>({});
  const [dokumentyFotos, setDokumentyFotos] = useState<Record<string, string[]>>({});

  const typLabel = typ === "byt" ? "Byt" : typ === "rodinny_dom" ? "Rodinný dom" : "Pozemok";

  function handleDocFoto(key: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setDokumentyFotos(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), base64],
        }));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeDocFoto(key: string, index: number) {
    setDokumentyFotos(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit() {
    if (!podpisData) { setError("Chýba podpis klienta"); return; }

    setSaving(true);
    setError("");

    const parametre: Record<string, unknown> = {};
    if (typ === "byt") {
      Object.assign(parametre, {
        pocet_izieb: pocetIzieb, vlastnictvo, druzstvo, typ_domu: typDomu,
        byt_cislo: bytCislo, poschodie, z_kolko: zKolko,
        kurenie, typ_podlahy: typPodlahy, anuita, vyhlad, mesacne_poplatky: mesacnePoplatky,
      });
    } else if (typ === "rodinny_dom") {
      Object.assign(parametre, {
        pocet_izieb: pocetIzieb, typ_domu: typDomu, pocet_podlazi: pocetPodlazi,
        rok_vystavby: rokVystavby, pozemok_plocha: pozemokPlocha, zahrada,
        kurenie, typ_podlahy: typPodlahy, anuita, vyhlad, mesacne_poplatky: mesacnePoplatky,
      });
    } else {
      Object.assign(parametre, {
        druh_pozemku: druhPozemku, pristupova_cesta: pristupovaCesta,
        siete, ucelove_urcenie: ucelovyUrcenie,
      });
    }

    const record = {
      typ_nehnutelnosti: typ,
      klient_id: klient.id,
      kraj: kraj || null, okres: okres || null, obec: obec || null,
      cast_obce: castObce || null, kat_uzemie: katUzemie || null,
      ulica: ulica || null, supisne_cislo: supisneCislo || null,
      cislo_orientacne: cisloOrientacne || null,
      plocha: plocha ? Number(plocha) : null,
      stav: stav || null,
      poznamky_vybavenie: poznamkyVybavenie || null,
      parametre,
      vybavenie: { ...vybavenie, zariadeny: zariadeny || null },
      oznacenie,
      majitel: majitel || null, konatel: konatel || null, jednatel: jednatel || null,
      kontakt_majitel: kontaktMajitel || null, uzivatel: uzivatel || null,
      kontakt_uzivatel: kontaktUzivatel || null,
      predajna_cena: predajnaCena ? Number(predajnaCena) : null,
      makler: makler || null,
      zmluva, typ_zmluvy: zmluva ? typZmluvy : null,
      datum_podpisu: datumPodpisu || null, zmluva_do: zmluvaDo || null,
      provizia: provizia || null, popis: popis || null,
      podpis_data: podpisData,
    };

    const { data, error: dbError } = await supabase
      .from("naberove_listy")
      .insert(record)
      .select("id")
      .single();

    if (dbError) {
      setSaving(false);
      setError("Chyba pri ukladaní: " + dbError.message);
      return;
    }

    // Update klient status → nabrany
    await supabase
      .from("klienti")
      .update({ status: "nabrany" })
      .eq("id", klient.id);

    setSaving(false);
    onSubmit({ id: data.id });
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
  const gridSt: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
  };
  const checkSt: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "8px", fontSize: "13px",
    color: "var(--text-primary)", cursor: "pointer", padding: "6px 0",
  };
  const radioSt: React.CSSProperties = {
    display: "flex", gap: "12px", flexWrap: "wrap",
  };

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

  return (
    <div style={{ maxWidth: "700px" }}>
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

      {/* 1. Lokalita */}
      <div style={cardSt}>
        <div style={sectionTitle}>📍 Lokalita</div>
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
      </div>

      {/* 2. Nehnuteľnosť */}
      <div style={cardSt}>
        <div style={sectionTitle}>🏠 Nehnuteľnosť</div>

        {/* Byt fields */}
        {typ === "byt" && (
          <>
            <div className="naber-grid" style={gridSt}>
              <div>
                <label style={labelSt}>Počet izieb</label>
                <select value={pocetIzieb} onChange={e => setPocetIzieb(e.target.value)} style={selectSt}>
                  <option value="">—</option>
                  {["1","2","3","4","5","6+"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Byt číslo</label>
                <input value={bytCislo} onChange={e => setBytCislo(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Poschodie</label>
                <input type="number" value={poschodie} onChange={e => setPoschodie(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Z koľko poschodí</label>
                <input type="number" value={zKolko} onChange={e => setZKolko(e.target.value)} style={inputSt} />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <label style={labelSt}>Vlastníctvo</label>
              <RadioGroup value={vlastnictvo} onChange={setVlastnictvo} options={[
                { value: "osobne", label: "Osobné vlastníctvo" },
                { value: "druzstevne", label: "Družstevné" },
              ]} />
            </div>
            {vlastnictvo === "druzstevne" && (
              <div style={{ marginTop: "12px" }}>
                <label style={labelSt}>Družstvo</label>
                <input value={druzstvo} onChange={e => setDruzstvo(e.target.value)} style={inputSt} />
              </div>
            )}
            <div style={{ marginTop: "12px" }}>
              <label style={labelSt}>Typ domu</label>
              <RadioGroup value={typDomu} onChange={setTypDomu} options={[
                { value: "tehlovy", label: "Tehlový" },
                { value: "panelovy", label: "Panelový" },
                { value: "skeletovy", label: "Skeletový" },
              ]} />
            </div>
          </>
        )}

        {/* Rodinný dom fields */}
        {typ === "rodinny_dom" && (
          <>
            <div className="naber-grid" style={gridSt}>
              <div>
                <label style={labelSt}>Počet izieb</label>
                <select value={pocetIzieb} onChange={e => setPocetIzieb(e.target.value)} style={selectSt}>
                  <option value="">—</option>
                  {["1","2","3","4","5","6","7","8+"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Počet podlaží</label>
                <input type="number" value={pocetPodlazi} onChange={e => setPocetPodlazi(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Rok výstavby</label>
                <input type="number" value={rokVystavby} onChange={e => setRokVystavby(e.target.value)} style={inputSt} placeholder="napr. 1985" />
              </div>
              <div>
                <label style={labelSt}>Plocha pozemku (m²)</label>
                <input type="number" value={pozemokPlocha} onChange={e => setPozemokPlocha(e.target.value)} style={inputSt} />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <label style={labelSt}>Typ domu</label>
              <input value={typDomu} onChange={e => setTypDomu(e.target.value)} style={inputSt} placeholder="napr. murovaný, drevený, montovaný..." />
            </div>
            <label style={{ ...checkSt, marginTop: "12px" }}>
              <input type="checkbox" checked={zahrada} onChange={e => setZahrada(e.target.checked)} />
              Záhrada
            </label>
          </>
        )}

        {/* Pozemok fields */}
        {typ === "pozemok" && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelSt}>Druh pozemku</label>
              <RadioGroup value={druhPozemku} onChange={setDruhPozemku} options={[
                { value: "stavebny", label: "Stavebný" },
                { value: "zahrada", label: "Záhrada" },
                { value: "polnohospodarsky", label: "Poľnohospodársky" },
                { value: "lesny", label: "Lesný" },
                { value: "komercny", label: "Komerčný" },
              ]} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelSt}>Účelové určenie</label>
              <input value={ucelovyUrcenie} onChange={e => setUcelovyUrcenie(e.target.value)} style={inputSt} />
            </div>
            <label style={{ ...checkSt, marginBottom: "12px" }}>
              <input type="checkbox" checked={pristupovaCesta} onChange={e => setPristupovaCesta(e.target.checked)} />
              Prístupová cesta
            </label>
            <div>
              <label style={labelSt}>Inžinierske siete</label>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {(["voda", "plyn", "elektrina", "kanal"] as const).map(s => (
                  <label key={s} style={checkSt}>
                    <input type="checkbox" checked={siete[s]} onChange={e => setSiete(prev => ({ ...prev, [s]: e.target.checked }))} />
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Stav + Plocha (common) */}
        <div className="naber-grid" style={{ ...gridSt, marginTop: "16px" }}>
          <div>
            <label style={labelSt}>Plocha (m²)</label>
            <input type="number" value={plocha} onChange={e => setPlocha(e.target.value)} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Stav</label>
            <select value={stav} onChange={e => setStav(e.target.value)} style={selectSt}>
              <option value="">— vyber —</option>
              {STAV_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Vlastnosti (byt/dom only) */}
      {typ !== "pozemok" && (
        <div style={cardSt}>
          <div style={sectionTitle}>📋 Vlastnosti</div>
          <div className="naber-grid" style={gridSt}>
            <div>
              <label style={labelSt}>Kúrenie</label>
              <input value={kurenie} onChange={e => setKurenie(e.target.value)} style={inputSt} placeholder="napr. centrálne, plynové..." />
            </div>
            <div>
              <label style={labelSt}>Typ podlahy</label>
              <input value={typPodlahy} onChange={e => setTypPodlahy(e.target.value)} style={inputSt} placeholder="napr. plávajúca, dlažba..." />
            </div>
            <div>
              <label style={labelSt}>Výhľad</label>
              <input value={vyhlad} onChange={e => setVyhlad(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Anuita (zostáva?)</label>
              <input value={anuita} onChange={e => setAnuita(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Mesačné poplatky (€)</label>
              <input type="number" value={mesacnePoplatky} onChange={e => setMesacnePoplatky(e.target.value)} style={inputSt} />
            </div>
          </div>
          <div style={{ marginTop: "12px" }}>
            <label style={labelSt}>Poznámky k vybaveniu</label>
            <textarea value={poznamkyVybavenie} onChange={e => setPoznamkyVybavenie(e.target.value)} rows={3}
              style={{ ...inputSt, resize: "vertical" }} placeholder="napr. nová kuchyňa, rekonštrukcia kúpeľne..." />
          </div>
        </div>
      )}

      {/* 4. Označenie */}
      <div style={cardSt}>
        <div style={sectionTitle}>🏷️ Označenie nehnuteľnosti</div>
        <RadioGroup value={oznacenie} onChange={setOznacenie} options={[
          { value: "ziadne", label: "Žiadne" },
          { value: "plachta", label: "Plachta" },
          { value: "acko", label: "Áčko" },
          { value: "trojuholnik", label: "Trojuholník" },
        ]} />
      </div>

      {/* 5. Vybavenie (byt/dom only) */}
      {typ !== "pozemok" && (
        <div style={cardSt}>
          <div style={sectionTitle}>🔧 Vybavenie</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px 12px" }}>
            {AMENITY_ITEMS.map(a => (
              <label key={a} style={checkSt}>
                <input type="checkbox" checked={!!vybavenie[a]} onChange={e => setVybavenie(prev => ({ ...prev, [a]: e.target.checked }))} />
                {a}
              </label>
            ))}
          </div>
          <div style={{ marginTop: "12px" }}>
            <label style={labelSt}>Zariadený</label>
            <RadioGroup value={zariadeny} onChange={setZariadeny} options={[
              { value: "ano", label: "Áno" },
              { value: "nie", label: "Nie" },
              { value: "ciastocne", label: "Čiastočne" },
            ]} />
          </div>
        </div>
      )}

      {/* 6. Dokumenty */}
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
                  {/* Existujúce fotky */}
                  {(dokumentyFotos[doc.key] || []).length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                      {(dokumentyFotos[doc.key] || []).map((foto, i) => (
                        <div key={i} style={{ position: "relative", width: "60px", height: "60px" }}>
                          <img src={foto} alt="" style={{
                            width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px",
                            border: "1px solid var(--border)",
                          }} />
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
                  {/* Tlačidlo na fotenie */}
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "8px", fontSize: "12px",
                    color: "var(--text-secondary)", background: "var(--bg-surface)",
                    border: "1px solid var(--border)", cursor: "pointer",
                  }}>
                    📷 Odfotiť
                    <input type="file" accept="image/*" capture="environment" multiple
                      onChange={e => handleDocFoto(doc.key, e.target.files)}
                      style={{ display: "none" }} />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 7. Majiteľ */}
      <div style={cardSt}>
        <div style={sectionTitle}>👤 Majiteľ / Vlastník</div>
        <div className="naber-grid" style={gridSt}>
          <div>
            <label style={labelSt}>Majiteľ *</label>
            <input value={majitel} onChange={e => setMajitel(e.target.value)} style={inputSt} placeholder="Meno a priezvisko" />
          </div>
          <div>
            <label style={labelSt}>Kontakt (telefón) *</label>
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
      </div>

      {/* 8. Predaj + Zmluva */}
      <div style={cardSt}>
        <div style={sectionTitle}>💰 Predaj a zmluva</div>
        <div className="naber-grid" style={gridSt}>
          <div>
            <label style={labelSt}>Predajná cena (€)</label>
            <input type="number" value={predajnaCena} onChange={e => setPredajnaCena(e.target.value)} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Maklér</label>
            <input value={makler} onChange={e => setMakler(e.target.value)} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Provízia</label>
            <input value={provizia} onChange={e => setProvizia(e.target.value)} style={inputSt} placeholder="napr. 3% alebo 5000€" />
          </div>
        </div>

        <div style={{ marginTop: "16px" }}>
          <label style={{ ...checkSt, marginBottom: "8px" }}>
            <input type="checkbox" checked={zmluva} onChange={e => setZmluva(e.target.checked)} />
            <span style={{ fontWeight: "600" }}>Zmluva podpísaná</span>
          </label>
          {zmluva && (
            <div className="naber-grid" style={{ ...gridSt, marginTop: "8px" }}>
              <div>
                <label style={labelSt}>Typ zmluvy</label>
                <RadioGroup value={typZmluvy} onChange={setTypZmluvy} options={[
                  { value: "exkluzivna", label: "Exkluzívna" },
                  { value: "neexkluzivna", label: "Neexkluzívna" },
                ]} />
              </div>
              <div>
                <label style={labelSt}>Dátum podpisu</label>
                <input type="date" value={datumPodpisu} onChange={e => setDatumPodpisu(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Zmluva do</label>
                <input type="date" value={zmluvaDo} onChange={e => setZmluvaDo(e.target.value)} style={inputSt} />
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

      {/* 9. Typ inzercie */}
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
              <div style={{
                fontSize: "11px", marginTop: "2px",
                color: typInzercie === o.value ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
              }}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 10. Podpis klienta */}
      <div style={cardSt}>
        <div style={sectionTitle}>✍️ Potvrdenie klientom</div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
          Vyššie uvedené informácie potvrdzuje (podpis klienta):
        </div>
        <SignatureCanvas onSignatureChange={setPodpisData} />
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
        width: "100%", padding: "14px", background: saving ? "#9CA3AF" : "#374151",
        color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px",
        fontWeight: "700", cursor: saving ? "default" : "pointer",
        marginBottom: "40px",
      }}>
        {saving ? "Ukladám..." : "Uložiť náberový list"}
      </button>
    </div>
  );
}
