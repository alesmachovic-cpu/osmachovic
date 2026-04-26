"use client";

/**
 * /gdpr — Zásady spracovania osobných údajov (GDPR)
 *
 * Verejne prístupná stránka, na ktorú sa odkazuje z obhliadkového listu,
 * náberáku a karty klienta. Obsahuje informácie podľa čl. 13 GDPR
 * (kategórie údajov, právny základ, doba uchovávania, práva dotknutej osoby).
 */
export default function GdprPage() {
  return (
    <div style={{ maxWidth: "780px", margin: "0 auto", padding: "8px 0 80px" }}>
      <h1 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
        Zásady spracovania osobných údajov
      </h1>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
        Posledná aktualizácia: 26. apríla 2026 · Verzia v1.0
      </p>

      <Section title="1. Prevádzkovateľ">
        <p>
          <strong>Vianema s. r. o.</strong>, realitná kancelária so sídlom v Slovenskej republike,
          spracúva Vaše osobné údaje v súlade s nariadením EÚ 2016/679 (GDPR) a zákonom č. 18/2018
          Z. z. o ochrane osobných údajov.
        </p>
        <p>Kontakt: <a href="mailto:ales@vianema.sk" style={linkSt}>ales@vianema.sk</a></p>
      </Section>

      <Section title="2. Aké údaje spracúvame">
        <ul style={ulSt}>
          <li><strong>Identifikačné údaje</strong> — meno, priezvisko, dátum narodenia (ak ide o náberák)</li>
          <li><strong>Kontaktné údaje</strong> — telefón, e-mail, adresa</li>
          <li><strong>Údaje o nehnuteľnosti</strong> — adresa, list vlastníctva, fotografie (pri náberáku)</li>
          <li><strong>Elektronický podpis</strong> — obraz podpisu na obhliadkovom liste / náberáku</li>
          <li><strong>Audit metadata</strong> — IP adresa, user-agent prehliadača a presný čas podpisu (pre integritu evidencie)</li>
        </ul>
      </Section>

      <Section title="3. Účel a právny základ">
        <ul style={ulSt}>
          <li>
            <strong>Sprostredkovanie predaja / prenájmu</strong> — plnenie zmluvy alebo
            predzmluvné kroky (čl. 6 ods. 1 písm. b GDPR).
          </li>
          <li>
            <strong>Evidencia obhliadok</strong> — oprávnený záujem realitnej kancelárie
            na evidencii kto si nehnuteľnosť obhliadol (čl. 6 ods. 1 písm. f GDPR).
          </li>
          <li>
            <strong>Účtovníctvo a daňové účely</strong> — zákonná povinnosť po uzavretí
            obchodu (čl. 6 ods. 1 písm. c GDPR).
          </li>
        </ul>
      </Section>

      <Section title="4. Doba uchovávania">
        <ul style={ulSt}>
          <li>Obhliadkové listy: <strong>2 roky</strong> od podpisu</li>
          <li>Náberové zmluvy a podpísané dokumenty: <strong>10 rokov</strong> (zákon o účtovníctve)</li>
          <li>Kontaktné údaje aktívnych klientov: <strong>počas trvania spolupráce</strong> + 3 roky</li>
        </ul>
      </Section>

      <Section title="5. Vaše práva">
        <ul style={ulSt}>
          <li><strong>Právo na prístup</strong> — môžete požiadať, aké údaje o Vás máme.</li>
          <li><strong>Právo na opravu</strong> — opravíme nesprávne údaje.</li>
          <li><strong>Právo na vymazanie („zabudnutie")</strong> — anonymizujeme Vaše osobné
            údaje. Obhliadky/náberáky zostávajú evidované, ale bez identifikovateľných údajov.</li>
          <li><strong>Právo na obmedzenie spracúvania</strong></li>
          <li><strong>Právo namietať</strong> proti spracúvaniu na základe oprávneného záujmu</li>
          <li><strong>Právo podať sťažnosť</strong> Úradu na ochranu osobných údajov SR</li>
        </ul>
        <p style={{ marginTop: "12px" }}>
          Na uplatnenie ktoréhokoľvek z týchto práv nás kontaktujte na
          {" "}<a href="mailto:ales@vianema.sk" style={linkSt}>ales@vianema.sk</a>.
        </p>
      </Section>

      <Section title="6. Príjemcovia údajov">
        <p>
          Vaše údaje neposkytujeme tretím stranám okrem prípadov, keď to vyžaduje zákon
          (napr. daňový úrad, kataster), alebo so sprostredkovateľmi, ktorých nutne potrebujeme
          k poskytovaniu služby:
        </p>
        <ul style={ulSt}>
          <li>Supabase (databáza, EU región) — uloženie údajov</li>
          <li>Vercel (hosting CRM) — prevádzka aplikácie</li>
          <li>Resend (e-mail) — doručenie podpísaných dokumentov</li>
          <li>Google (Calendar, Drive) — synchronizácia kalendára a dokumentov makléra</li>
        </ul>
      </Section>

      <Section title="7. Bezpečnosť">
        <p>
          Všetky údaje sú prenášané cez HTTPS a uložené v šifrovanej forme. Citlivé dokumenty
          (LV, podpisy) sú navyše šifrované AES-256-GCM pred uložením.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "10px" }}>
        {title}
      </h2>
      <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.7" }}>
        {children}
      </div>
    </div>
  );
}

const ulSt: React.CSSProperties = { paddingLeft: "20px", margin: "8px 0" };
const linkSt: React.CSSProperties = { color: "var(--accent, #3B82F6)", textDecoration: "underline" };
