import { getFirmaInfo } from "@/lib/getFirmaInfo";

export default async function GdprPage() {
  const f = await getFirmaInfo();
  return (
    <div style={{ maxWidth: "780px", margin: "0 auto", padding: "0 0 80px" }}>
      <h1 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
        Zásady spracovania osobných údajov
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
        Posledná aktualizácia: 13. mája 2026 · Verzia v2.0
      </p>

      <Section title="1. Prevádzkovateľ">
        <p>
          <strong>{f.nazov}</strong>, so sídlom <em>{f.sidlo}</em>,
          IČO: <em>{f.ico}</em>, DIČ: <em>{f.dic}</em>,
          zapísaná v Obchodnom registri <em>{f.registracia}</em>,
          štatutárny orgán: konateľ <em>{f.konatel}</em>
          (ďalej len „Prevádzkovateľ") spracúva Vaše osobné údaje v súlade s nariadením EÚ 2016/679
          (GDPR) a zákonom č. 18/2018 Z. z. o ochrane osobných údajov.
        </p>
        <p>Kontakt: <a href="mailto:ales@vianema.sk" style={linkSt}>ales@vianema.sk</a> · <a href="mailto:privacy@vianema.sk" style={linkSt}>privacy@vianema.sk</a></p>
      </Section>

      <Section title="2. Zodpovedná osoba (DPO)">
        <p>
          Spoločnosť nemá zákonnú povinnosť určiť zodpovednú osobu podľa čl. 37 GDPR. Pre otázky
          k spracúvaniu osobných údajov nás kontaktujte na{" "}
          <a href="mailto:privacy@vianema.sk" style={linkSt}>privacy@vianema.sk</a>.
        </p>
      </Section>

      <Section title="3. Aké údaje spracúvame">
        <ul style={ulSt}>
          <li><strong>Identifikačné údaje</strong> — meno, priezvisko, dátum narodenia, rodné číslo (pri AML overení)</li>
          <li><strong>Kontaktné údaje</strong> — telefón, e-mail, adresa trvalého pobytu</li>
          <li><strong>Údaje o nehnuteľnosti</strong> — adresa, list vlastníctva, fotografie</li>
          <li><strong>Doklady totožnosti</strong> — kópia OP/pasu (pri AML overení, zákon č. 297/2008 Z. z.)</li>
          <li><strong>Elektronický podpis</strong> — obraz podpisu na obhliadkovom liste / náberáku</li>
          <li><strong>Audit metadáta</strong> — IP adresa, user-agent prehliadača, čas podpisu</li>
        </ul>
      </Section>

      <Section title="4. Účel a právny základ">
        <ul style={ulSt}>
          <li><strong>Sprostredkovanie predaja / prenájmu</strong> — plnenie zmluvy alebo predzmluvné kroky (čl. 6 ods. 1 písm. b GDPR).</li>
          <li><strong>Evidencia obhliadok</strong> — oprávnený záujem realitnej kancelárie (čl. 6 ods. 1 písm. f GDPR).</li>
          <li><strong>AML overenie totožnosti</strong> — zákonná povinnosť podľa zákona č. 297/2008 Z. z. (čl. 6 ods. 1 písm. c GDPR).</li>
          <li><strong>Účtovníctvo a daňové účely</strong> — zákonná povinnosť (čl. 6 ods. 1 písm. c GDPR).</li>
          <li><strong>Zasielanie obchodných ponúk</strong> — len so súhlasom klienta (čl. 6 ods. 1 písm. a GDPR). Súhlas možno kedykoľvek odvolať.</li>
        </ul>
      </Section>

      <Section title="5. Automatizované rozhodovanie a profilovanie">
        <p>
          CRM systém využíva nástroje umelej inteligencie (Anthropic Claude, Google Gemini) na analýzu
          trhovej ceny nehnuteľnosti, vyhodnotenie inzerátov a návrhy copywritingu. Tieto nástroje
          <strong> nepredstavujú automatizované rozhodovanie s právnym účinkom</strong> v zmysle čl. 22
          GDPR — slúžia výlučne ako podporný nástroj pre makléra, ktorý prijíma všetky rozhodnutia sám.
        </p>
      </Section>

      <Section title="6. AML — overovanie totožnosti">
        <p>
          Vianema s. r. o. je povinnou osobou podľa § 5 ods. 1 písm. h) zákona č. 297/2008 Z. z.
          Pri sprostredkovaní kúpy, predaja alebo prenájmu nehnuteľností vykonávame identifikáciu a
          overenie totožnosti klientov. Údaje uchovávame 5 rokov po skončení obchodného vzťahu.
          Odmietnutie poskytnúť požadované údaje znamená nemožnosť poskytnúť služby.
        </p>
      </Section>

      <Section title="7. Doba uchovávania">
        <ul style={ulSt}>
          <li>Obhliadkové listy: <strong>2 roky</strong> od podpisu, potom anonymizácia</li>
          <li>Náberové zmluvy a podpísané dokumenty: <strong>10 rokov</strong> (zákon o účtovníctve)</li>
          <li>Kontaktné údaje aktívnych klientov: <strong>po dobu spolupráce + 3 roky</strong></li>
          <li>AML doklady: <strong>5 rokov</strong> od skončenia obchodného vzťahu</li>
          <li>Faktúry: <strong>10 rokov</strong> (zákon č. 431/2002 Z. z.)</li>
        </ul>
      </Section>

      <Section title="8. Príjemcovia osobných údajov">
        <p>Vaše údaje nepredávame ani neposkytujeme tretím stranám na marketingové účely. Príjemcovia:</p>
        <ul style={ulSt}>
          <li><strong>IT sprostredkovatelia</strong> — poskytovatelia infraštruktúry (viď sekcia 9)</li>
          <li><strong>Orgány verejnej moci</strong> — pri zákonnej povinnosti (polícia, finančná správa)</li>
          <li><strong>Notári a banky</strong> — v rámci realitnej transakcie, len s Vaším vedomím</li>
        </ul>
      </Section>

      <Section title="9. Prenosy mimo EÚ / EHP">
        <table style={tableSt}>
          <thead>
            <tr>
              <th style={thSt}>Spracovateľ</th>
              <th style={thSt}>Krajina serverov</th>
              <th style={thSt}>Právny základ prenosu</th>
            </tr>
          </thead>
          <tbody>
            <Tr vals={["Supabase Inc.", "EU (Frankfurt)", "EHP — prenos nevzniká"]} />
            <Tr vals={["Vercel Inc.", "EU edge + USA (materská)", "EU-US DPF + SCC (vercel.com/legal/dpa)"]} />
            <Tr vals={["Resend Inc.", "USA", "EU-US Data Privacy Framework"]} />
            <Tr vals={["Google LLC", "USA", "EU-US DPF + SCC"]} />
            <Tr vals={["Anthropic PBC", "USA", "Štandardné zmluvné doložky (SCC)"]} />
          </tbody>
        </table>
      </Section>

      <Section title="10. Bezpečnosť">
        <ul style={ulSt}>
          <li>Šifrovanie databázy AES-256 (Supabase) + AES-256-GCM pre citlivé dokumenty</li>
          <li>Row Level Security — každý maklér vidí len svoje záznamy</li>
          <li>HTTPS / HSTS preload na všetkých doménach</li>
          <li>Audit log každého prístupu k citlivým dátam</li>
          <li>Rate-limiting prihlásení (max 5 neúspechov / 15 min / IP)</li>
        </ul>
      </Section>

      <Section title="11. Vaše práva (čl. 15–22 GDPR)">
        <ul style={ulSt}>
          <li><strong>Právo na prístup (čl. 15)</strong> — požiadajte o kópiu Vašich údajov</li>
          <li><strong>Právo na opravu (čl. 16)</strong> — oprava nesprávnych alebo neúplných údajov</li>
          <li><strong>Právo na vymazanie (čl. 17)</strong> — „právo na zabudnutie" (s výnimkou zákonných povinností uchovávania)</li>
          <li><strong>Právo na obmedzenie spracúvania (čl. 18)</strong></li>
          <li><strong>Právo na prenositeľnosť (čl. 20)</strong> — strojovo čitateľný export dát na <a href="/transparency" style={linkSt}>Moje dáta</a></li>
          <li><strong>Právo namietať (čl. 21)</strong> — voči spracúvaniu na základe oprávneného záujmu</li>
          <li><strong>Právo odvolať súhlas</strong> — kedykoľvek, bez vplyvu na zákonnosť predchádzajúceho spracovania</li>
        </ul>
        <p>
          Žiadosti zasielajte na <a href="mailto:privacy@vianema.sk" style={linkSt}>privacy@vianema.sk</a>.
          Odpoveď do 30 dní. Sťažnosť môžete podať na{" "}
          <strong>Úrad na ochranu osobných údajov SR</strong>, Hraničná 12, 820 07 Bratislava 27,{" "}
          <a href="https://dataprotection.gov.sk" style={linkSt} target="_blank" rel="noopener noreferrer">dataprotection.gov.sk</a>.
        </p>
      </Section>

      <Section title="12. Povinnosť poskytnúť údaje">
        <p>
          Údaje potrebné na plnenie zmluvy sú <strong>zmluvnou požiadavkou</strong>. AML doklady sú
          <strong> zákonnou povinnosťou</strong>. Kontaktné údaje na marketingové účely sú <strong>dobrovoľné</strong>.
        </p>
      </Section>

      <Section title="Changelog">
        <ul style={ulSt}>
          <li><strong>v1.0 (26. apríla 2026)</strong> — pôvodné znenie</li>
          <li><strong>v2.0 (13. mája 2026)</strong> — doplnenie identifikácie prevádzkovateľa, DPO, prenosov mimo EÚ, automatizovaného rozhodovania, AML sekcie, rozšírenie práv dotknutých osôb</li>
        </ul>
      </Section>
    </div>
  );
}

const linkSt: React.CSSProperties = { color: "var(--accent)", textDecoration: "none" };
const ulSt: React.CSSProperties = { paddingLeft: "20px", lineHeight: 1.8 };
const tableSt: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "12px", marginTop: "8px" };
const thSt: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)" };
const tdSt: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "top" };

function Tr({ vals }: { vals: string[] }) {
  return <tr>{vals.map((v, i) => <td key={i} style={tdSt}>{v}</td>)}</tr>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
        {title}
      </h2>
      <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
