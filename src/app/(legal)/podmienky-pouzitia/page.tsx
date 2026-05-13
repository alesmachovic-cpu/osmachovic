import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podmienky používania | Vianema",
  description: "Všeobecné podmienky používania CRM systému a klientskej zóny Vianema s. r. o.",
  robots: { index: true, follow: true },
};

export default function PodmienkyPouzivaniaPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Podmienky používania</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Verzia v1.0 · Účinnosť: 13. mája 2026</p>
      </header>

      <Section title="1. Definície">
        <ul style={ulSt}>
          <li><strong>Prevádzkovateľ</strong> — Vianema s. r. o., IČO: 47395095, prevádzkovateľ CRM systému</li>
          <li><strong>CRM systém</strong> — softvérová platforma dostupná na vianema.amgd.sk a vianema.sk</li>
          <li><strong>Maklér</strong> — zamestnanec alebo spolupracovník Prevádzkovateľa s prístupom do CRM</li>
          <li><strong>Klient</strong> — fyzická alebo právnická osoba využívajúca realitné služby Prevádzkovateľa</li>
          <li><strong>Klientska zóna</strong> — oblasť CRM prístupná klientom na prezeranie dokumentov a podpisovanie</li>
          <li><strong>Používateľ</strong> — akákoľvek osoba s prístupom do systému (Maklér alebo Klient)</li>
        </ul>
      </Section>

      <Section title="2. Rozsah služby">
        <p style={pSt}>
          Prevádzkovateľ poskytuje CRM systém na interné účely realitnej kancelárie (správa klientov,
          nehnuteľností, obhliadok, faktúr) a klientsku zónu na komunikáciu s klientmi a elektronické
          podpisovanie dokumentov. Systém nie je verejne prístupnou službou — prístup vyžaduje
          autorizáciu Prevádzkovateľom.
        </p>
      </Section>

      <Section title="3. Práva a povinnosti Používateľa">
        <ul style={ulSt}>
          <li>Používateľ je oprávnený využívať systém len na účely, na ktoré mu bol udelený prístup</li>
          <li>Prihlasovacie údaje sú dôverné a nesmú byť zdieľané s tretími osobami</li>
          <li>Používateľ zodpovedá za všetky aktivity vykonané pod jeho prístupovými údajmi</li>
          <li>Makléri sú povinní dodržiavať Etický kódex NARKS a zákonné povinnosti (AML, GDPR)</li>
          <li>Klienti sa zaväzujú poskytovať pravdivé a úplné informácie</li>
        </ul>
      </Section>

      <Section title="4. Zakázané správanie">
        <p style={pSt}>Používateľovi je zakázané:</p>
        <ul style={ulSt}>
          <li>Spätná analýza (reverse engineering), dekompilácia alebo disassembly systému</li>
          <li>Automatizované zhromažďovanie údajov (scraping, crawling)</li>
          <li>Pokus o neoprávnený prístup k iným účtom alebo dátam</li>
          <li>Šírenie škodlivého kódu, spam alebo phishing</li>
          <li>Komerčné využívanie systému bez súhlasu Prevádzkovateľa</li>
          <li>Porušovanie práv duševného vlastníctva Prevádzkovateľa</li>
        </ul>
      </Section>

      <Section title="5. Duševné vlastníctvo">
        <p style={pSt}>
          Zdrojový kód, dizajn, logo, obchodná značka Vianema a všetky súvisiace materiály sú
          výlučným vlastníctvom Vianema s. r. o. a/alebo jej licencorov. Žiadne ustanovenie týchto
          podmienok neudeľuje Používateľovi licenciu na duševné vlastníctvo Prevádzkovateľa.
        </p>
      </Section>

      <Section title="6. Zodpovednosť za škodu">
        <p style={pSt}>
          Systém je poskytovaný „tak ako je". Prevádzkovateľ nezodpovedá za škody spôsobené
          výpadkom systému, stratou dát alebo kybernetickým útokom, pokiaľ boli prijaté primerané
          bezpečnostné opatrenia. Zodpovednosť Prevádzkovateľa je v rozsahu povolenom platným právom
          obmedzená na priame škody a je vylúčená pri nepriamych škodách.
        </p>
      </Section>

      <Section title="7. Trvanie a ukončenie prístupu">
        <p style={pSt}>
          Prístup makléra trvá po dobu trvania pracovného / spolupracovníckeho vzťahu s Prevádzkovateľom
          a je možné ho kedykoľvek zrušiť. Prístup klienta trvá po dobu trvania realitnej spolupráce.
          Prevádzkovateľ môže prístup okamžite pozastaviť pri porušení týchto podmienok.
        </p>
      </Section>

      <Section title="8. Zmeny podmienok">
        <p style={pSt}>
          Prevádzkovateľ si vyhradzuje právo podmienky meniť. O podstatných zmenách budú Používatelia
          informovaní minimálne 30 dní vopred (e-mailom alebo notifikáciou v systéme).
          Pokračovaním v používaní systému po nadobudnutí účinnosti zmien Používateľ zmeny akceptuje.
        </p>
      </Section>

      <Section title="9. Rozhodné právo a riešenie sporov">
        <p style={pSt}>
          Tieto podmienky sa riadia slovenským právnym poriadkom. Spory sa riešia pred príslušnými
          súdmi Slovenskej republiky. Klienti môžu využiť alternatívne riešenie sporov cez{" "}
          <a href="https://www.soi.sk" style={lnkSt} target="_blank" rel="noopener noreferrer">SOI</a>{" "}
          alebo platformu{" "}
          <a href="https://ec.europa.eu/consumers/odr" style={lnkSt} target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.
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
