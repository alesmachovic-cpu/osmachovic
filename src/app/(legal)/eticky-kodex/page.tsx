import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Etický kódex | Vianema",
  description: "Etické záväzky Vianema s. r. o. pri výkone realitnej činnosti.",
  robots: { index: true, follow: true },
};

export default function EtickyKodexPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Etický kódex</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Verzia v1.0</p>
      </header>

      <Section title="1. Základné princípy">
        <p style={pSt}>
          Realitná kancelária <strong>Vianema s. r. o.</strong> sa zaväzuje vykonávať realitnú
          činnosť v súlade s platným právom, etickými štandardmi realitného trhu a s rešpektom
          voči všetkým zúčastneným stranám.
        </p>
        <p style={pSt}>
          Etický kódex NARKS (Národnej asociácie realitných kancelárií Slovenska) stanovuje
          štandardy správania pre realitných maklérov. Informáciu o členstve v NARKS si overujte
          priamo u Prevádzkovateľa — <a href="mailto:ales@vianema.sk" style={lnkSt}>ales@vianema.sk</a>.
        </p>
      </Section>

      <Section title="2. Záväzky Vianema s. r. o.">
        <p style={pSt}><strong>Voči klientom:</strong></p>
        <ul style={ulSt}>
          <li>Konáme vždy v najlepšom záujme klienta a transparentne</li>
          <li>Poskytujeme pravdivé, úplné a aktuálne informácie o nehnuteľnostiach</li>
          <li>Neuvádzame klientov do omylu o trhovej hodnote ani o stave nehnuteľnosti</li>
          <li>Mlčanlivosť o dôverných informáciách klienta (aj po skončení spolupráce)</li>
          <li>Informujeme o všetkých stranách obchodu a potenciálnych konfliktoch záujmov</li>
        </ul>
        <p style={{ ...pSt, marginTop: "12px" }}><strong>Voči nehnuteľnostiam:</strong></p>
        <ul style={ulSt}>
          <li>Overenie právneho stavu nehnuteľnosti (LV) <em>pred</em> inzerciou</li>
          <li>Používanie vlastnej fotodokumentácie — žiadne ukradnuté fotky z iných inzerátov</li>
          <li>Presná a pravdivá prezentácia nehnuteľnosti (výmera, stav, vybavenie)</li>
        </ul>
        <p style={{ ...pSt, marginTop: "12px" }}><strong>Profesionálne štandardy:</strong></p>
        <ul style={ulSt}>
          <li>Poistenie zodpovednosti za škodu spôsobenú výkonom realitnej činnosti</li>
          <li>Pravidelné vzdelávanie maklérov (legislatíva, trh, etika)</li>
          <li>Dodržiavanie GDPR a AML predpisov</li>
          <li>Nestrannosť pri obhliadkach — rovnaké zaobchádzanie so všetkými záujemcami</li>
        </ul>
      </Section>

      <Section title="3. Konflikt záujmov">
        <p style={pSt}>
          Maklér nesmie zastupovať obe strany obchodu bez písomného vedomia a súhlasu oboch strán.
          V prípade osobného záujmu na obchode (napr. kúpa pre seba alebo príbuznú osobu) je povinný
          klienta vopred informovať.
        </p>
      </Section>

      <Section title="4. Podanie podnetu na porušenie kódexu">
        <p style={pSt}>
          Ak sa domnievate, že niektorý z maklérov Vianema porušil etické zásady, môžete podať
          podnet:
        </p>
        <ul style={ulSt}>
          <li>E-mailom: <a href="mailto:etika@vianema.sk" style={lnkSt}>etika@vianema.sk</a></li>
          <li>Písomne na adresu sídla spoločnosti (k rukám konateľa)</li>
        </ul>
        <p style={pSt}>
          Každý podnet prešetríme do 30 dní a o výsledku informujeme podávateľa.
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
