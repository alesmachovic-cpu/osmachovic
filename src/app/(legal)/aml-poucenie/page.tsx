import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AML poučenie | Vianema",
  description: "Informácie o overovaní totožnosti klientov podľa zákona č. 297/2008 Z. z. o ochrane pred legalizáciou príjmov z trestnej činnosti.",
  robots: { index: true, follow: true },
};

export default function AmlPouceniePage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>AML poučenie — overovanie totožnosti</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Verzia v1.0</p>
        <p style={{ ...metaSt, marginTop: "4px" }}>
          Zákon č. 297/2008 Z. z. o ochrane pred legalizáciou príjmov z trestnej činnosti
          a o ochrane pred financovaním terorizmu
        </p>
      </header>

      <Section title="1. Kto je povinná osoba">
        <p style={pSt}>
          Realitná kancelária <strong>Vianema s. r. o.</strong> je povinnou osobou podľa{" "}
          <strong>§ 5 ods. 1 písm. h) zákona č. 297/2008 Z. z.</strong> — spoločnosť, ktorá
          sprostredkúva predaj, kúpu alebo prenájom nehnuteľností. Ako povinná osoba je Vianema s. r. o.
          povinná vykonávať starostlivosť vo vzťahu ku klientovi, vrátane identifikácie a overenia
          totožnosti.
        </p>
      </Section>

      <Section title="2. Kedy identifikáciu vykonávame">
        <p style={pSt}>Identifikáciu klienta vykonávame vždy pri:</p>
        <ul style={ulSt}>
          <li>Uzatváraní sprostredkovateľskej zmluvy (náberová zmluva, zmluva s kupujúcim)</li>
          <li>Sprostredkovaní obchodu s nehnuteľnosťou bez ohľadu na výšku kúpnej / nájomnej ceny</li>
          <li>Hotovostných transakciách od výšky <strong>10 000 EUR</strong> (§ 10 ods. 1 písm. a)</li>
          <li>Ak vznikne podozrenie z neobvyklej obchodnej operácie (§ 14)</li>
        </ul>
      </Section>

      <Section title="3. Aké údaje zbierame a overujeme">
        <p style={pSt}>Pre <strong>fyzické osoby:</strong></p>
        <ul style={ulSt}>
          <li>Meno a priezvisko</li>
          <li>Dátum narodenia a rodné číslo</li>
          <li>Adresa trvalého pobytu</li>
          <li>Štátna príslušnosť</li>
          <li>Číslo dokladu totožnosti (OP alebo pas) a kópia dokladu</li>
        </ul>
        <p style={{ ...pSt, marginTop: "12px" }}>Pre <strong>právnické osoby:</strong></p>
        <ul style={ulSt}>
          <li>Obchodné meno, sídlo, IČO</li>
          <li>Identifikácia štatutárneho orgánu a skutočného vlastníka (benefičného vlastníka)</li>
          <li>Výpis z obchodného registra</li>
        </ul>
      </Section>

      <Section title="4. Uchovávanie dokladov">
        <p style={pSt}>
          Kópie dokladov totožnosti a overovacia dokumentácia sa uchovávajú{" "}
          <strong>5 rokov po skončení obchodného vzťahu</strong> (§ 20 zákona č. 297/2008 Z. z.).
          Právny základ spracúvania osobných údajov pri AML: čl. 6 ods. 1 písm. c GDPR — zákonná povinnosť.
        </p>
      </Section>

      <Section title="5. Dôsledky odmietnutia identifikácie">
        <p style={pSt}>
          Ak klient odmietne poskytnúť potrebné identifikačné údaje alebo doklady,{" "}
          <strong>Vianema s. r. o. je povinná odmietnuť uzavretie obchodného vzťahu</strong>{" "}
          a môže byť povinná podať hlásenie o neobvyklej obchodnej operácii Finančnej spravodajskej
          jednotke SR (§ 15 ods. 1 zákona č. 297/2008 Z. z.).
        </p>
      </Section>

      <Section title="6. Vaše práva v súvislosti so spracúvaním AML dát">
        <p style={pSt}>
          Máte právo na informácie, prístup k údajom a opravu. Vymazanie AML dokladov pred uplynutím
          zákonnej lehoty 5 rokov nie je možné z dôvodu zákonnej povinnosti. Viac informácií v{" "}
          <a href="/gdpr" style={lnkSt}>Zásadách spracovania osobných údajov</a>.
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
