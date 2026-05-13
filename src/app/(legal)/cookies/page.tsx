import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies | Vianema",
  description: "Informácie o používaní cookies na stránkach Vianema s. r. o. podľa § 109 zák. č. 452/2021 Z. z.",
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Zásady používania cookies</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026 · Verzia v1.0</p>
      </header>

      <Section title="1. Čo sú cookies">
        <p style={pSt}>
          Cookies sú malé textové súbory ukladané do Vášho zariadenia pri návšteve webových stránok.
          Umožňujú stránke zapamätať si Vaše preferencie a zabezpečiť správne fungovanie.
          Právny základ pre technicky nevyhnutné cookies: § 109 ods. 8 zákona č. 452/2021 Z. z.
          o elektronických komunikáciách (pre nevyhnutné cookies súhlas nie je potrebný).
        </p>
      </Section>

      <Section title="2. Prehľad cookies">
        <div style={{ overflowX: "auto" }}>
          <table style={tableSt}>
            <thead>
              <tr>
                {["Názov", "Účel", "Typ", "Platnosť", "Spracovateľ"].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Tr vals={[
                "crm_session",
                "HMAC autentifikačná session pre CRM (makléri)",
                "Nevyhnutná / technická",
                "Session (zatvorenie prehliadača)",
                "Vianema s. r. o.",
              ]} />
              <Tr vals={[
                "crm_billing",
                "Stav predplatného / aktivity účtu",
                "Nevyhnutná / technická",
                "Session",
                "Vianema s. r. o.",
              ]} />
              <Tr vals={[
                "sb-hokymscytscsewrpwdjf-auth-token (localStorage)",
                "Supabase autentifikačný token (nie cookie — localStorage)",
                "Nevyhnutná / technická",
                "1 hodina (JWT) + refresh token",
                "Supabase Inc. (EU región)",
              ]} />
            </tbody>
          </table>
        </div>
        <p style={{ ...pSt, marginTop: "12px", fontSize: "13px" }}>
          <strong>Aktuálne nepoužívame žiadne analytické ani marketingové cookies.</strong>{" "}
          Ak v budúcnosti pridáme, vyžiadame Váš preukázateľný súhlas prostredníctvom cookie bannera,
          v súlade s čl. 7 GDPR a § 109 zákona č. 452/2021 Z. z.
        </p>
      </Section>

      <Section title="3. Správa cookies">
        <p style={pSt}>
          Cookies môžete spravovať alebo vymazať v nastaveniach Vášho prehliadača.
          Vypnutie technicky nevyhnutných cookies môže spôsobiť nefunkčnosť prihlásenia a CRM systému.
        </p>
        <ul style={ulSt}>
          <li><a href="https://support.google.com/chrome/answer/95647" style={lnkSt} target="_blank" rel="noopener noreferrer">Chrome</a></li>
          <li><a href="https://support.mozilla.org/sk/kb/enhanced-tracking-protection-firefox-desktop" style={lnkSt} target="_blank" rel="noopener noreferrer">Firefox</a></li>
          <li><a href="https://support.apple.com/sk-sk/HT201265" style={lnkSt} target="_blank" rel="noopener noreferrer">Safari</a></li>
        </ul>
      </Section>
    </>
  );
}

function Tr({ vals }: { vals: string[] }) {
  return <tr>{vals.map((v, i) => <td key={i} style={tdSt}>{v}</td>)}</tr>;
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
const ulSt: React.CSSProperties = { paddingLeft: "20px", lineHeight: 2, fontSize: "14px" };
const lnkSt: React.CSSProperties = { color: "var(--accent)", textDecoration: "none" };
const tableSt: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "12px" };
const thSt: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-secondary)" };
const tdSt: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "top", color: "var(--text-secondary)", fontSize: "13px" };
