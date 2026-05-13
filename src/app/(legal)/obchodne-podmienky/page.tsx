import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Obchodné podmienky | Vianema",
  description: "VOP Vianema s. r. o. pre sprostredkovanie predaja a prenájmu nehnuteľností.",
  robots: { index: true, follow: true },
};

export default function ObchodnePodmienkyPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Obchodné podmienky</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Verzia v1.0 · Účinné od: 13. mája 2026</p>
        <p style={{ ...metaSt, marginTop: "6px" }}>
          Vianema s. r. o. — sprostredkovanie predaja a prenájmu nehnuteľností
        </p>
      </header>

      <Section title="1. Prevádzkovateľ a predmet podmienok">
        <p style={pSt}>
          Tieto všeobecné obchodné podmienky (ďalej „VOP") upravujú vzťahy medzi spoločnosťou{" "}
          <strong>Vianema s. r. o.</strong>, IČO: [DOPLŇTE], sídlom [DOPLŇTE ADRESU] (ďalej „Realitná
          kancelária") a jej klientmi pri sprostredkovaní predaja, kúpy a prenájmu nehnuteľností.
          Realitná činnosť je vykonávaná na základe živnostenského oprávnenia (viazaná živnosť
          „Sprostredkovanie predaja, prenájmu a kúpy nehnuteľností").
        </p>
      </Section>

      <Section title="2. Vznik zmluvného vzťahu">
        <p style={pSt}>
          Zmluvný vzťah medzi Realitnou kanceláriou a Klientom vzniká podpisom{" "}
          <strong>Sprostredkovateľskej zmluvy</strong> (príp. náberovej zmluvy). Zmluva musí byť
          uzavretá v písomnej forme. Ústne dohody sú záväzné len po písomnom potvrdení.
        </p>
      </Section>

      <Section title="3. Provízia">
        <ul style={ulSt}>
          <li><strong>Výška provízie</strong> je dohodnutá individuálne v sprostredkovateľskej zmluve a je uvedená v % z kúpnej/nájomnej ceny alebo ako pevná suma.</li>
          <li><strong>Splatnosť</strong> — pri predaji: do 10 dní od podpisu kúpnej zmluvy; pri prenájme: pred odovzdaním kľúčov.</li>
          <li><strong>DPH</strong> — k provízii sa pripočíta DPH, ak je Realitná kancelária platcom DPH.</li>
          <li>Nárok na províziu vzniká uzavretím zmluvy medzi kupujúcim a predávajúcim, resp. nájomcom a prenajímateľom.</li>
        </ul>
      </Section>

      <Section title="4. Práva a povinnosti Realitnej kancelárie">
        <ul style={ulSt}>
          <li>Aktívne sprostredkovanie predaja/prenájmu nehnuteľnosti na trhu</li>
          <li>Overenie právneho stavu nehnuteľnosti (list vlastníctva, záložné práva, vecné bremená) pred inzerciou</li>
          <li>Realizácia fotodokumentácie a príprava inzerátov (originálne, nie ukradnuté fotky)</li>
          <li>Organizácia a vedenie obhliadok s evidenciou záujemcov</li>
          <li>Poradenstvo pri stanovení trhovej ceny (CMA analýza)</li>
          <li>Mlčanlivosť o dôverných informáciách klienta</li>
          <li>Poistenie zodpovednosti za škodu spôsobenú výkonom realitnej činnosti</li>
        </ul>
      </Section>

      <Section title="5. Práva a povinnosti Klienta">
        <ul style={ulSt}>
          <li>Poskytnutie pravdivých a úplných informácií o nehnuteľnosti</li>
          <li>Súčinnosť pri organizácii obhliadok</li>
          <li>Identifikácia totožnosti pre účely AML overenia (zákon č. 297/2008 Z. z.)</li>
          <li>Úhrada dohodnutej provízie v stanovenej lehote</li>
        </ul>
      </Section>

      <Section title="6. Právo odstúpiť od zmluvy uzavretej na diaľku alebo mimo prevádzkových priestorov">
        <p style={pSt}>
          V súlade so zákonom č. 102/2014 Z. z. o ochrane spotrebiteľa pri predaji tovaru na diaľku
          alebo mimo prevádzkových priestorov má Klient — spotrebiteľ právo odstúpiť od zmluvy bez
          udania dôvodu do <strong>14 kalendárnych dní</strong> odo dňa jej uzavretia.
        </p>
        <p style={pSt}>
          Právo na odstúpenie <strong>zaniká</strong>, ak Realitná kancelária so súhlasom Klienta
          začala poskytovať službu pred uplynutím 14-dňovej lehoty a služba bola splnená v celom rozsahu.
        </p>
        <p style={pSt}>
          <strong>Formulár na odstúpenie od zmluvy:</strong> Odstúpenie možno zaslať na adresu sídla
          alebo e-mailom na reklamacie@vianema.sk s textom: „Týmto odstupujem od sprostredkovateľskej
          zmluvy uzavretej dňa [DÁTUM]. Meno, adresa, podpis."
        </p>
        <p style={pSt}>
          Toto právo sa nevzťahuje na zmluvy uzavreté v prevádzkových priestoroch Realitnej kancelárie.
        </p>
      </Section>

      <Section title="7. Reklamácie">
        <p style={pSt}>
          Reklamácie sa riešia podľa <a href="/reklamacny-poriadok" style={lnkSt}>Reklamačného poriadku</a>.
          Kontakt: <a href="mailto:reklamacie@vianema.sk" style={lnkSt}>reklamacie@vianema.sk</a>
        </p>
      </Section>

      <Section title="8. Alternatívne riešenie sporov">
        <p style={pSt}>
          Spotrebiteľ má právo obrátiť sa na Prevádzkovateľa so žiadosťou o nápravu, ak nie je spokojný
          s vybavením reklamácie. Alternatívne riešenie sporov zabezpečuje{" "}
          <a href="https://www.soi.sk" style={lnkSt} target="_blank" rel="noopener noreferrer">
            Slovenská obchodná inšpekcia (SOI)
          </a>{" "}
          alebo iný subjekt zapísaný v zozname MDaV SR. Online riešenie sporov:{" "}
          <a href="https://ec.europa.eu/consumers/odr" style={lnkSt} target="_blank" rel="noopener noreferrer">
            ec.europa.eu/consumers/odr
          </a>.
        </p>
      </Section>

      <Section title="9. Záverečné ustanovenia">
        <p style={pSt}>
          Tieto VOP sa riadia slovenským právnym poriadkom. V prípade rozporu medzi VOP a individuálnou
          zmluvou má prednosť individuálna zmluva. Prevádzkovateľ si vyhradzuje právo VOP meniť;
          zmeny sú účinné po zverejnení na tejto stránke, pokiaľ nie je uvedené inak.
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
