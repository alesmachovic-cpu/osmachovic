import type { Metadata } from "next";
import { getFirmaInfo } from "@/lib/getFirmaInfo";

export const metadata: Metadata = {
  title: "Kontakt | Vianema",
  description: "Kontaktné údaje realitnej kancelárie Vianema s. r. o. — povinné údaje podľa zákona č. 22/2004 Z. z.",
  robots: { index: true, follow: true },
};

export default async function KontaktPage() {
  const f = await getFirmaInfo();
  const prevadzkarena = f.prevadzkarena || f.sidlo;

  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Kontakt</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Verzia v1.0</p>
      </header>

      <Section title="Prevádzkovateľ (povinné údaje podľa § 4 zák. č. 22/2004 Z. z.)">
        <Row label="Obchodné meno" value={f.nazov} />
        <Row label="Sídlo" value={f.sidlo} />
        <Row label="IČO" value={f.ico} />
        <Row label="DIČ" value={f.dic} />
        <Row label="IČ DPH" value={f.ic_dph} />
        <Row label="Zápis v OR" value={`Obchodný register ${f.registracia}`} />
        <Row label="Štatutárny orgán" value={`Konateľ: ${f.konatel}`} />
        {f.telefon && <Row label="Telefón" value={f.telefon} />}
        <Row label="E-mail" value={f.email} />
        <Row label="Web" value={f.web} />
      </Section>

      <Section title="Orgán dozoru">
        <p style={pSt}>
          <strong>Slovenská obchodná inšpekcia (SOI)</strong><br />
          Inšpektorát SOI pre Bratislavský kraj<br />
          Bajkalská 21/A, P. O. BOX 5, 820 07 Bratislava<br />
          Tel.: 02/58 27 21 72, E-mail: ba@soi.sk<br />
          <a href="https://www.soi.sk" style={lnkSt} target="_blank" rel="noopener noreferrer">www.soi.sk</a>
        </p>
        <p style={pSt}>
          Pre riešenie sporov online: <a href="https://ec.europa.eu/consumers/odr" style={lnkSt} target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>
        </p>
      </Section>

      <Section title="Kontakt na maklérov">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
          <MaklerCard meno={f.konatel} tel={f.telefon || "—"} email={f.email} />
        </div>
      </Section>

      <Section title="Kde nás nájdete">
        <p style={pSt}>{prevadzkarena}</p>
        <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "20px", marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(prevadzkarena)}`} style={lnkSt} target="_blank" rel="noopener noreferrer">
            Zobraziť na Google Maps →
          </a>
        </div>
      </Section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "16px", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: "180px", flexShrink: 0, fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", paddingTop: "2px" }}>{label}</div>
      <div style={{ fontSize: "14px", color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function MaklerCard({ meno, tel, email }: { meno: string; tel: string; email: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "16px" }}>
      <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>{meno}</div>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
        <div>{tel}</div>
        <a href={`mailto:${email}`} style={lnkSt}>{email}</a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={h2St}>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

const headerSt: React.CSSProperties = { marginBottom: "28px" };
const h1St: React.CSSProperties = { fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" };
const h2St: React.CSSProperties = { fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" };
const metaSt: React.CSSProperties = { fontSize: "13px", color: "var(--text-muted)" };
const pSt: React.CSSProperties = { fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 };
const lnkSt: React.CSSProperties = { color: "var(--accent)", textDecoration: "none" };
