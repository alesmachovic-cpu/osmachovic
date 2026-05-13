import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "O nás | Vianema",
  description: "Vianema s. r. o. — realitná kancelária, tím, história a profesionálne štandardy.",
  robots: { index: true, follow: true },
};

export default function ONasPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>O nás</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026</p>
      </header>

      <Section title="Kto sme">
        <p style={pSt}>
          <strong>Vianema s. r. o.</strong> je slovenská realitná kancelária pôsobiaca na
          [DOPLŇTE REGIÓN]. Zameriavame sa na sprostredkovanie predaja a prenájmu rezidenčných
          nehnuteľností s dôrazom na transparentnosť, odbornosť a osobný prístup ku každému klientovi.
        </p>
        <p style={pSt}>[DOPLŇTE HISTÓRIU FIRMY — rok vzniku, kľúčové míľniky, počet zrealizovaných obchodov, atď.]</p>
      </Section>

      <Section title="Náš tím">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px", marginTop: "8px" }}>
          <TeamCard
            meno="Aleš Machovič"
            rola="Maklér / zakladateľ"
            email="ales@vianema.sk"
            licencia="[DOPLŇTE ČÍSLO LICENCIE]"
          />
          {/* Ďalší členovia tímu */}
        </div>
      </Section>

      <Section title="Profesionálne štandardy">
        <ul style={ulSt}>
          <li><strong>Licencia:</strong> Viazaná živnosť „Sprostredkovanie predaja, prenájmu a kúpy nehnuteľností"</li>
          <li><strong>Poistenie zodpovednosti:</strong> [DOPLŇTE POISŤOVŇU, SUMU POISTNÉHO KRYTIA]</li>
          <li><strong>Členstvo v profesijných organizáciách:</strong> [DOPLŇTE — napr. NARKS, ak ste člen]</li>
          <li><strong>Vzdelávanie:</strong> Pravidelné odborné školenia, sledovanie legislatívnych zmien</li>
        </ul>
      </Section>

      <Section title="Kontakt">
        <p style={pSt}>
          <a href="/kontakt" style={lnkSt}>→ Kompletné kontaktné údaje</a>
        </p>
      </Section>
    </>
  );
}

function TeamCard({ meno, rola, email, licencia }: { meno: string; rola: string; email: string; licencia: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: "12px", padding: "16px" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "18px", marginBottom: "10px" }}>
        {meno.split(" ").map(w => w[0]).join("")}
      </div>
      <div style={{ fontWeight: 700, fontSize: "14px" }}>{meno}</div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>{rola}</div>
      <div style={{ fontSize: "12px", lineHeight: 1.8 }}>
        <a href={`mailto:${email}`} style={lnkSt}>{email}</a><br />
        <span style={{ color: "var(--text-muted)" }}>Lic.: {licencia}</span>
      </div>
    </div>
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
