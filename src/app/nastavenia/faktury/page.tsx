"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type DodavatelSettings = {
  nazov: string;
  adresa: string;
  ico: string;
  dic: string;
  ic_dph: string;
  iban: string;
  banka: string;
  swift: string;
  obch_register: string;
  konst_symbol: string;
  email: string;
  telefon: string;
  splatnost_dni: number;
  uvodny_text: string;
  poznamka_default: string;
  vystavil: string;
};

export const DEFAULT_DODAVATEL: DodavatelSettings = {
  nazov: "Vianema s. r. o.",
  adresa: "Karpatské námestie 10/A, 831 06 Bratislava",
  ico: "47395095",
  dic: "2023848508",
  ic_dph: "SK2023848508",
  iban: "",
  banka: "",
  swift: "",
  obch_register: "",
  konst_symbol: "308",
  email: "",
  telefon: "",
  splatnost_dni: 14,
  uvodny_text: "",
  poznamka_default: "",
  vystavil: "",
};

const STORAGE_KEY = "faktury_dodavatel";

export function loadDodavatel(): DodavatelSettings {
  if (typeof window === "undefined") return DEFAULT_DODAVATEL;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DODAVATEL;
    return { ...DEFAULT_DODAVATEL, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DODAVATEL;
  }
}

const inputSt: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  background: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: "14px",
};
const labelSt: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "4px",
};

export default function NastaveniaFakturyPage() {
  const [s, setS] = useState<DodavatelSettings>(DEFAULT_DODAVATEL);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setS(loadDodavatel()); }, []);

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function field(k: keyof DodavatelSettings, label: string, type: string = "text") {
    return (
      <div>
        <div style={labelSt}>{label}</div>
        <input
          style={inputSt}
          type={type}
          value={s[k] as string | number}
          onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <Link href="/nastavenia" style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none" }}>← Späť na nastavenia</Link>
      <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#374151", marginTop: "8px" }}>Nastavenia faktúr</h1>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
        Údaje dodávateľa, ktoré sa vytlačia na faktúre
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dodávateľ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {field("nazov", "Názov spoločnosti")}
          {field("adresa", "Adresa")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            {field("ico", "IČO")}
            {field("dic", "DIČ")}
            {field("ic_dph", "IČ DPH")}
          </div>
          {field("obch_register", "Obchodný register (napr. Obch. reg Okres. súdu BA I, oddiel: Sro, vložka č. 162664/B)")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {field("email", "Email")}
            {field("telefon", "Telefón")}
          </div>
        </div>

        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", margin: "24px 0 12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Bankové údaje</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
          {field("iban", "IBAN")}
          {field("banka", "Banka")}
          {field("swift", "SWIFT / BIC")}
        </div>
        <div style={{ marginTop: "12px" }}>
          {field("konst_symbol", "Konštantný symbol")}
        </div>

        <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", margin: "24px 0 12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Predvolené hodnoty</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
          {field("splatnost_dni", "Splatnosť (dní)", "number")}
          {field("vystavil", "Vystavil (meno)")}
        </div>
        <div style={{ marginTop: "12px" }}>
          {field("poznamka_default", "Predvolená poznámka")}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          {saved && <span style={{ color: "var(--success)", fontSize: "13px", fontWeight: 600, alignSelf: "center" }}>✓ Uložené</span>}
          <button onClick={save} style={{ background: "#374151", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            Uložiť nastavenia
          </button>
        </div>
      </div>
    </div>
  );
}
