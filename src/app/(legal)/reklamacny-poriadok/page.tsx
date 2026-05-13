import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reklamačný poriadok | Vianema",
  description: "Reklamačný poriadok Vianema s. r. o. podľa zákona č. 250/2007 Z. z. o ochrane spotrebiteľa.",
  robots: { index: true, follow: true },
};

export default function ReklamacnyPoriadokPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Reklamačný poriadok</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Verzia v1.0</p>
        <p style={{ ...metaSt, marginTop: "4px" }}>Podľa zákona č. 250/2007 Z. z. o ochrane spotrebiteľa</p>
      </header>

      <Section title="1. Spôsob uplatnenia reklamácie">
        <p style={pSt}>Reklamáciu možno uplatniť:</p>
        <ul style={ulSt}>
          <li><strong>E-mailom:</strong> <a href="mailto:reklamacie@vianema.sk" style={lnkSt}>reklamacie@vianema.sk</a></li>
          <li><strong>Písomne:</strong> na adresu sídla Vianema s. r. o., [DOPLŇTE ADRESU]</li>
          <li><strong>Osobne:</strong> v prevádzke na adrese [DOPLŇTE ADRESU PREVÁDZKARNE] v pracovných dňoch 9:00–17:00</li>
        </ul>
      </Section>

      <Section title="2. Náležitosti reklamácie">
        <p style={pSt}>Reklamácia musí obsahovať:</p>
        <ul style={ulSt}>
          <li>Identifikáciu reklamujúceho (meno, priezvisko, adresa, kontakt)</li>
          <li>Číslo zmluvy alebo faktúry, ktorej sa reklamácia týka</li>
          <li>Popis vady / pochybenia a čo Klient požaduje</li>
          <li>Dátum a podpis (pri písomnej reklamácii)</li>
        </ul>
      </Section>

      <Section title="3. Lehoty vybavenia">
        <ul style={ulSt}>
          <li><strong>Potvrdenie prijatia reklamácie:</strong> do 3 pracovných dní</li>
          <li><strong>Vybavenie reklamácie:</strong> do <strong>30 dní</strong> od uplatnenia (§ 18 ods. 4 zákona č. 250/2007 Z. z.)</li>
          <li>O výsledku bude Klient informovaný e-mailom alebo písomne</li>
        </ul>
      </Section>

      <Section title="4. Spôsoby vybavenia">
        <ul style={ulSt}>
          <li>Uznanie reklamácie a náprava (opakované poskytnutie služby, zľava, vrátenie časti provízie)</li>
          <li>Zamietnutie reklamácie s odôvodnením</li>
        </ul>
      </Section>

      <Section title="5. Alternatívne riešenie sporov">
        <p style={pSt}>
          Ak Klient nie je spokojný s vybavením reklamácie, môže sa obrátiť na{" "}
          <a href="https://www.soi.sk" style={lnkSt} target="_blank" rel="noopener noreferrer">
            Slovenskú obchodnú inšpekciu (SOI)
          </a>{" "}
          alebo využiť online platformu pre riešenie sporov:{" "}
          <a href="https://ec.europa.eu/consumers/odr" style={lnkSt} target="_blank" rel="noopener noreferrer">
            ec.europa.eu/consumers/odr
          </a>.
        </p>
        <p style={pSt}>
          Spotrebiteľ môže podať návrh na ARS najneskôr do 1 roka od vzniku sporu.
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={h2St}>{title}</h2>
      {children}
    </div>
  );
}

const headerSt: React.CSSProperties = { marginBottom: "28px" };
const h1St: React.CSSProperties = { fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" };
const h2St: React.CSSProperties = { fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" };
const metaSt: React.CSSProperties = { fontSize: "13px", color: "var(--text-muted)" };
const pSt: React.CSSProperties = { fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 };
const ulSt: React.CSSProperties = { paddingLeft: "20px", lineHeight: 1.9, fontSize: "14px", color: "var(--text-secondary)" };
const lnkSt: React.CSSProperties = { color: "var(--accent)", textDecoration: "none" };
