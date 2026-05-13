import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prístupnosť | Vianema",
  description: "Prehlásenie o prístupnosti webovej aplikácie Vianema s. r. o. podľa zákona č. 351/2024 Z. z.",
  robots: { index: true, follow: true },
};

export default function PristupnostPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Prehlásenie o prístupnosti</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Zákon č. 351/2024 Z. z. (EAA)</p>
      </header>

      <Section title="1. Záväzok prístupnosti">
        <p style={pSt}>
          Vianema s. r. o. sa zaväzuje zabezpečiť prístupnosť svojej webovej aplikácie v súlade
          s požiadavkami <strong>WCAG 2.1 úrovne AA</strong> a zákona č. 351/2024 Z. z.
          o dostupnosti produktov a služieb (implementácia EAA — European Accessibility Act).
        </p>
        <p style={pSt}>
          Toto prehlásenie sa vzťahuje na domény: <strong>vianema.amgd.sk</strong> a <strong>vianema.sk</strong>
        </p>
      </Section>

      <Section title="2. Úroveň súladu">
        <p style={pSt}>
          <strong>Deklarovaná úroveň:</strong> WCAG 2.1 AA (čiastočný súlad)<br />
          <strong>Posledný audit:</strong> [DOPLŇTE DÁTUM — napr. Jún 2026 — plánovaný]<br />
          <strong>Metóda hodnotenia:</strong> Vlastné hodnotenie + automatizované testy (axe-core)
        </p>
      </Section>

      <Section title="3. Implementované opatrenia">
        <ul style={ulSt}>
          <li>Sémantický HTML (nadpisy, zoznamy, tabuľky s hlavičkami)</li>
          <li>Atribút <code>lang="sk"</code> na elemente <code>&lt;html&gt;</code></li>
          <li>Kontrastný pomer textu ≥ 4.5:1 (normálny text), ≥ 3:1 (veľký text / UI komponenty)</li>
          <li>ARIA labely na ikonových tlačidlách a formulárových prvkoch</li>
          <li>Klávesnicová navigácia (Tab, Enter, Esc, Arrow keys)</li>
          <li>Viditeľný focus indicator na všetkých interaktívnych prvkoch</li>
          <li>Responzívny dizajn — použiteľné na mobilných zariadeniach</li>
        </ul>
      </Section>

      <Section title="4. Známe nedostatky">
        <p style={pSt}>
          Nasledujúce časti aplikácie môžu mať obmedzenia prístupnosti (aktívne pracujeme na náprave):
        </p>
        <ul style={ulSt}>
          <li>Podpisový pad (canvas) — nie je plne prístupný pre používateľov čítačiek obrazovky</li>
          <li>Niektoré dynamické modálne okná nemusia správne spravovať focus trap</li>
          <li>[DOPLŇTE ďalšie po audite]</li>
        </ul>
      </Section>

      <Section title="5. Nahlásenie problému s prístupnosťou">
        <p style={pSt}>
          Ak narazíte na prekážku prístupnosti alebo potrebujete obsah v alternatívnom formáte,
          kontaktujte nás:
        </p>
        <ul style={ulSt}>
          <li>E-mail: <a href="mailto:pristupnost@vianema.sk" style={lnkSt}>pristupnost@vianema.sk</a></li>
          <li>Odpoveď do 15 pracovných dní</li>
        </ul>
      </Section>

      <Section title="6. Presadzovací postup">
        <p style={pSt}>
          Ak nie ste spokojný s odpoveďou na Vašu žiadosť o prístupnosť, môžete sa obrátiť na
          príslušný dozorný orgán (podľa zákona č. 351/2024 Z. z.).
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
