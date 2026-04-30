"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Klient } from "@/lib/database.types";
import SignatureCanvas from "./SignatureCanvas";

interface Props {
  klient: Klient;
  onBack: () => void;
  onSubmit: (data: { id: string }) => void;
  /** Zjednodušený mód — bez podpisu a zálohy */
  simplified?: boolean;
  /** Ak je nastavené → edit mode (UPDATE namiesto INSERT) */
  existing?: Record<string, unknown> | null;
  /** Meno aktuálneho makléra (Aleš / Slavomír / ...) — uloží sa do `objednavky.makler` */
  maklerMeno?: string;
}

const DRUHY = [
  { value: "byt", label: "Byt", icon: "🏢" },
  { value: "rodinny_dom", label: "Rodinný dom", icon: "🏡" },
  { value: "pozemok", label: "Pozemok", icon: "🌿" },
  { value: "komercny", label: "Komerčná nehnuteľnosť", icon: "🏪" },
  { value: "ine", label: "Iné", icon: "📦" },
];

const KRAJE = [
  "Bratislavský", "Trnavský", "Trenčiansky", "Nitriansky",
  "Žilinský", "Banskobystrický", "Prešovský", "Košický",
];

const OKRESY_MAP: Record<string, string[]> = {
  "Bratislavský": ["Bratislava I", "Bratislava II", "Bratislava III", "Bratislava IV", "Bratislava V", "Malacky", "Pezinok", "Senec"],
  "Trnavský": ["Trnava", "Dunajská Streda", "Galanta", "Hlohovec", "Piešťany", "Senica", "Skalica"],
  "Trenčiansky": ["Trenčín", "Bánovce nad Bebravou", "Ilava", "Myjava", "Nové Mesto nad Váhom", "Partizánske", "Považská Bystrica", "Prievidza", "Púchov"],
  "Nitriansky": ["Nitra", "Komárno", "Levice", "Nové Zámky", "Šaľa", "Topoľčany", "Zlaté Moravce"],
  "Žilinský": ["Žilina", "Bytča", "Čadca", "Dolný Kubín", "Kysucké Nové Mesto", "Liptovský Mikuláš", "Martin", "Námestovo", "Ružomberok", "Turčianske Teplice", "Tvrdošín"],
  "Banskobystrický": ["Banská Bystrica", "Banská Štiavnica", "Brezno", "Detva", "Krupina", "Lučenec", "Poltár", "Revúca", "Rimavská Sobota", "Veľký Krtíš", "Zvolen", "Žarnovica", "Žiar nad Hronom"],
  "Prešovský": ["Prešov", "Bardejov", "Humenné", "Kežmarok", "Levoča", "Medzilaborce", "Poprad", "Sabinov", "Snina", "Stará Ľubovňa", "Stropkov", "Svidník", "Vranov nad Topľou"],
  "Košický": ["Košice I", "Košice II", "Košice III", "Košice IV", "Košice-okolie", "Gelnica", "Michalovce", "Rožňava", "Sobrance", "Spišská Nová Ves", "Trebišov"],
};

const POCTY_IZIEB = ["1", "2", "3", "4", "5+"];
const STAVY = ["Novostavba", "Kompletná rekonštrukcia", "Pôvodný stav", "Čiastočná rekonštrukcia", "Projekt"];
const KONSTRUKCIE = ["Panel", "Tehla", "Zmiešaná", "Drevostavba", "Iné"];
const VYKUROVANIE = ["Ústredné", "Vlastné (kotol)", "Elektrické", "Podlahové", "Iné"];

function MultiSelect({ options, selected, onChange, label }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {options.map(o => {
          const active = selected.includes(o);
          return (
            <button key={o} type="button" onClick={() => {
              onChange(active ? selected.filter(x => x !== o) : [...selected, o]);
            }} style={{
              padding: "7px 14px", borderRadius: "20px", cursor: "pointer",
              background: active ? "#374151" : "var(--bg-elevated)",
              color: active ? "#fff" : "var(--text-primary)",
              border: active ? "1px solid #374151" : "1px solid var(--border)",
              fontSize: "12px", fontWeight: active ? "700" : "500",
              transition: "all 0.15s",
            }}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function ObjednavkaForm({ klient, onBack, onSubmit, simplified = false, existing = null, maklerMeno = "" }: Props) {
  const [saving, setSaving] = useState(false);
  const [druhy, setDruhy] = useState<string[]>([]);
  const [kraje, setKraje] = useState<string[]>([]);
  const [okresy, setOkresy] = useState<string[]>([]);
  const [izby, setIzby] = useState<string[]>([]);
  const [stavy, setStavy] = useState<string[]>([]);
  const [konstrukcie, setKonstrukcie] = useState<string[]>([]);
  const [vykurovanie, setVykurovanie] = useState<string[]>([]);
  const [plochaOd, setPlochaOd] = useState("");
  const [plochaDo, setPlochaDo] = useState("");
  const [cenaOd, setCenaOd] = useState("");
  const [cenaDo, setCenaDo] = useState("");
  const [rokOd, setRokOd] = useState("");
  const [podlazia, setPodlazia] = useState("");
  const [terminDo, setTerminDo] = useState("");
  const [zaloha, setZaloha] = useState("");
  const [ine, setIne] = useState("");
  const [podpis, setPodpis] = useState("");

  // Načítaj existujúcu objednávku pri edite
  useEffect(() => {
    if (!existing) return;
    const druhRaw = existing.druh as string | string[] | null;
    setDruhy(Array.isArray(druhRaw) ? druhRaw : (druhRaw ? String(druhRaw).split(/[,/]/).map(s => s.trim()).filter(Boolean) : []));
    const lok = (existing.lokalita || {}) as { kraje?: string[]; okresy?: string[] };
    setKraje(lok.kraje ?? []);
    setOkresy(lok.okresy ?? []);
    const poz = (existing.poziadavky || {}) as Record<string, unknown>;
    setIzby(Array.isArray(poz.izby) ? poz.izby as string[] : []);
    setStavy(Array.isArray(poz.stavy) ? poz.stavy as string[] : []);
    setKonstrukcie(Array.isArray(poz.konstrukcie) ? poz.konstrukcie as string[] : []);
    setVykurovanie(Array.isArray(poz.vykurovanie) ? poz.vykurovanie as string[] : []);
    setPodlazia(String(poz.podlazia ?? ""));
    setPlochaOd(poz.plocha_od ? String(poz.plocha_od) : "");
    setPlochaDo(poz.plocha_do ? String(poz.plocha_do) : "");
    setRokOd(poz.rok_od ? String(poz.rok_od) : "");
    setCenaOd(existing.cena_od ? String(existing.cena_od) : "");
    setCenaDo(existing.cena_do ? String(existing.cena_do) : "");
    setTerminDo((existing.termin_do as string) || "");
    setZaloha(existing.zaloha ? String(existing.zaloha) : "");
    setIne((existing.ine as string) || "");
    setPodpis((existing.podpis as string) || "");
  }, [existing]);

  const availableOkresy = kraje.flatMap(k => OKRESY_MAP[k] || []);

  const sectionSt: React.CSSProperties = {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "14px", padding: "20px", marginBottom: "16px",
  };
  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
    color: "var(--text-primary)", outline: "none", boxSizing: "border-box" as const,
  };
  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "6px",
  };

  async function handleSubmit() {
    if (druhy.length === 0) { alert("Vyber aspoň jeden druh nehnuteľnosti"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      klient_id: klient.id,
      druh: druhy.join(", "),
      poziadavky: {
        izby, stavy, konstrukcie, vykurovanie, podlazia,
        plocha_od: plochaOd ? Number(plochaOd) : null,
        plocha_do: plochaDo ? Number(plochaDo) : null,
        rok_od: rokOd ? Number(rokOd) : null,
      },
      lokalita: { kraje, okresy },
      cena_od: cenaOd ? Number(cenaOd) : null,
      cena_do: cenaDo ? Number(cenaDo) : null,
      termin_do: terminDo || null,
      zaloha: zaloha ? Number(zaloha) : null,
      ine: ine || null,
      podpis: podpis || null,
      makler: maklerMeno || "—",
    };

    let resultId: string | null = null;
    if (existing?.id) {
      const r = await fetch("/api/objednavky", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id, ...payload }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert("Chyba: " + (e.error || r.statusText)); setSaving(false); return; }
      const data = await r.json();
      resultId = data.id;
    } else {
      const { data, error } = await supabase.from("objednavky").insert(payload).select("id").single();
      if (error) { alert("Chyba: " + error.message); setSaving(false); return; }
      resultId = data.id;
      if (klient.typ === "predavajuci") {
        await supabase.from("klienti").update({ typ: "oboje" }).eq("id", klient.id);
      }
    }
    setSaving(false);
    onSubmit({ id: resultId! });
  }

  return (
    <div style={{ maxWidth: "700px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button onClick={onBack} style={{
          width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)",
          background: "var(--bg-surface)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
            Záväzná objednávka
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Klient: {klient.meno} · {klient.telefon}
          </p>
        </div>
      </div>

      <div style={sectionSt}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>🏠 Druh nehnuteľnosti</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {DRUHY.map(d => {
            const active = druhy.includes(d.value);
            return (
              <button key={d.value} type="button" onClick={() => setDruhy(active ? druhy.filter(x => x !== d.value) : [...druhy, d.value])} style={{
                padding: "12px 18px", borderRadius: "12px", cursor: "pointer",
                background: active ? "#374151" : "var(--bg-elevated)",
                color: active ? "#fff" : "var(--text-primary)",
                border: active ? "2px solid #374151" : "1px solid var(--border)",
                fontSize: "13px", fontWeight: active ? "700" : "500",
                display: "flex", alignItems: "center", gap: "8px", transition: "all 0.15s",
              }}><span style={{ fontSize: "18px" }}>{d.icon}</span> {d.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>Môžeš vybrať viac typov naraz</div>
      </div>

      <div style={sectionSt}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>📍 Požadovaná lokalita</div>
        <MultiSelect options={KRAJE} selected={kraje} onChange={(v) => { setKraje(v); setOkresy(okresy.filter(o => v.flatMap(k => OKRESY_MAP[k] || []).includes(o))); }} label="Kraje" />
        {availableOkresy.length > 0 && (
          <div style={{ marginTop: "14px" }}>
            <MultiSelect options={availableOkresy} selected={okresy} onChange={setOkresy} label="Okresy" />
          </div>
        )}
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>Vyber jeden alebo viac krajov a okresov</div>
      </div>

      <div style={sectionSt}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>📋 Požiadavky</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <MultiSelect options={POCTY_IZIEB} selected={izby} onChange={setIzby} label="Počet izieb" />
          <MultiSelect options={STAVY} selected={stavy} onChange={setStavy} label="Stav" />
          <MultiSelect options={KONSTRUKCIE} selected={konstrukcie} onChange={setKonstrukcie} label="Konštrukcia" />
          <MultiSelect options={VYKUROVANIE} selected={vykurovanie} onChange={setVykurovanie} label="Vykurovanie" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }} className="naber-grid">
            <div><div style={labelSt}>Výmera od (m²)</div><input type="number" style={inputSt} value={plochaOd} onChange={e => setPlochaOd(e.target.value)} placeholder="napr. 40" /></div>
            <div><div style={labelSt}>Výmera do (m²)</div><input type="number" style={inputSt} value={plochaDo} onChange={e => setPlochaDo(e.target.value)} placeholder="napr. 80" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }} className="naber-grid">
            <div><div style={labelSt}>Rok výstavby od</div><input type="number" style={inputSt} value={rokOd} onChange={e => setRokOd(e.target.value)} placeholder="napr. 1990" /></div>
            <div><div style={labelSt}>Počet podlaží</div><input type="text" style={inputSt} value={podlazia} onChange={e => setPodlazia(e.target.value)} placeholder="napr. 1-2" /></div>
          </div>
        </div>
      </div>

      <div style={sectionSt}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>💰 Cena a termín</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }} className="naber-grid">
          <div><div style={labelSt}>Cena od (€)</div><input type="number" style={inputSt} value={cenaOd} onChange={e => setCenaOd(e.target.value)} placeholder="napr. 80 000" /></div>
          <div><div style={labelSt}>Cena do (€) *</div><input type="number" style={inputSt} value={cenaDo} onChange={e => setCenaDo(e.target.value)} placeholder="napr. 200 000" /></div>
          <div><div style={labelSt}>Termín sprostredkovania do</div><input type="date" style={inputSt} value={terminDo} onChange={e => setTerminDo(e.target.value)} /></div>
          {!simplified && <div><div style={labelSt}>Záloha (€)</div><input type="number" style={inputSt} value={zaloha} onChange={e => setZaloha(e.target.value)} placeholder="Suma zálohy" /></div>}
        </div>
      </div>

      <div style={sectionSt}>
        <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>📝 Ďalšie požiadavky</div>
        <textarea style={{ ...inputSt, minHeight: "80px", resize: "vertical" }} value={ine} onChange={e => setIne(e.target.value)} placeholder="Balkón, parkovanie, výťah, pivnica..." />
      </div>

      {!simplified && (
        <div style={sectionSt}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>✍️ Potvrdenie klientom</div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: "1.5" }}>
            Objednávateľ potvrdzuje obsah a záväznosť objednávky. Osobné údaje sú spracúvané podľa GDPR (zákon č. 18/2018 Z.z.).
          </p>
          <SignatureCanvas onSignatureChange={(v) => setPodpis(v || "")} />
        </div>
      )}

      <button onClick={handleSubmit} disabled={saving || druhy.length === 0} style={{
        width: "100%", padding: "16px", borderRadius: "12px", border: "none",
        background: druhy.length === 0 ? "#D1D5DB" : "#374151",
        color: "#fff", fontSize: "15px", fontWeight: "700",
        cursor: druhy.length === 0 ? "not-allowed" : "pointer",
        marginBottom: "40px",
      }}>
        {saving ? "Ukladám..." : "Uložiť objednávku"}
      </button>
    </div>
  );
}
