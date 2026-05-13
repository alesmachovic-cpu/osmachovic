import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bezpečnosť | Vianema",
  description: "Bezpečnostné opatrenia a responsible disclosure policy Vianema s. r. o.",
  robots: { index: true, follow: true },
};

export default function BezpecnostPage() {
  return (
    <>
      <header style={headerSt}>
        <h1 style={h1St}>Bezpečnosť</h1>
        <p style={metaSt}>Posledná aktualizácia: 13. mája 2026</p>
      </header>

      <Section title="Technické opatrenia">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "8px" }}>
          {[
            { icon: "🔒", title: "HTTPS / HSTS preload", desc: "Všetka komunikácia šifrovaná TLS. HSTS preload na 2 roky vrátane subdomén." },
            { icon: "🗄️", title: "Šifrovanie at-rest", desc: "Citlivé dokumenty (LV, podpisy) šifrované AES-256-GCM pred uložením." },
            { icon: "🇪🇺", title: "EU hosting", desc: "Databáza na Supabase Frankfurt (EU). Vercel EU edge pre statický obsah." },
            { icon: "🛡️", title: "Row Level Security", desc: "Každý maklér vidí len záznamy svojej firmy. Priamy prístup cez anon key zablokovaný." },
            { icon: "📋", title: "Audit log", desc: "Každá kritická operácia (prístup, zmena, export dát) zaznamenaná s IP, časom a user-agentom." },
            { icon: "⏱️", title: "Rate limiting", desc: "Max 5 neúspešných prihlásení za 15 min na IP. Automatické dočasné blokovanie." },
            { icon: "🔄", title: "Zálohovanie", desc: "Supabase PITR (Point-in-Time Recovery) — zálohy každých 5 minút, uchované 7 dní." },
            { icon: "🔑", title: "Správa secretov", desc: "API kľúče uložené len v server-side prostredí. Klient-side bundle neobsahuje žiadne citlivé kľúče." },
          ].map(item => (
            <div key={item.title} style={{ background: "var(--bg-elevated)", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "20px", marginBottom: "6px" }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>{item.title}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Responsible Disclosure">
        <p style={pSt}>
          Ak nájdete bezpečnostnú zraniteľnosť v našich systémoch, prosíme, kontaktujte nás
          zodpovedným spôsobom — <strong>predtým, ako zraniteľnosť zverejníte</strong>:
        </p>
        <ul style={ulSt}>
          <li>E-mail: <a href="mailto:security@vianema.sk" style={lnkSt}>security@vianema.sk</a></li>
          <li>Security.txt: <a href="/.well-known/security.txt" style={lnkSt}>/.well-known/security.txt</a></li>
        </ul>
        <p style={pSt}>
          Záväzujeme sa: potvrdiť príjem do 3 pracovných dní, opraviť overenú zraniteľnosť do
          primeranej lehoty (podľa závažnosti), informovať reportéra o stave a (po jeho súhlase)
          uviesť ho v poďakovaní.
        </p>
        <p style={pSt}>
          <strong>Out-of-scope:</strong> DoS/DDoS útoky, social engineering, fyzický prístup k zariadeniam.
        </p>
      </Section>

      <Section title="Stav bezpečnosti">
        <table style={tableSt}>
          <tbody>
            <TRow label="Posledný bezpečnostný audit" value="[DOPLŇTE DÁTUM]" />
            <TRow label="Penetračné testy" value="[DOPLŇTE — napr. Plánujeme Q3 2026]" />
            <TRow label="Dátové úniky (breaches)" value="0 od spustenia (vianema.amgd.sk)" />
            <TRow label="Zodpovedná osoba pre bezpečnosť" value="security@vianema.sk" />
          </tbody>
        </table>
      </Section>

      <Section title="Subprocesori" id="subprocesori">
        <table style={tableSt}>
          <thead>
            <tr>
              {["Spracovateľ", "Účel", "Región", "DPA"].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              ["Supabase Inc.", "Databáza, Auth", "EU (Frankfurt)", "supabase.com/legal/dpa"],
              ["Vercel Inc.", "Hosting, Edge", "EU / USA (DPF)", "vercel.com/legal/dpa"],
              ["Resend Inc.", "E-mail", "USA (DPF)", "resend.com/legal/dpa"],
              ["Google LLC", "Calendar, Drive, OAuth", "USA (DPF + SCC)", "cloud.google.com/terms/data-processing-terms"],
              ["Anthropic PBC", "AI (Claude)", "USA (SCC)", "anthropic.com/legal/privacy"],
            ].map((row, i) => (
              <tr key={i}>{row.map((v, j) => <td key={j} style={tdSt}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ ...tdSt, fontWeight: 600, width: "200px" }}>{label}</td>
      <td style={tdSt}>{value}</td>
    </tr>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div style={{ marginBottom: "28px" }} id={id}>
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
const tableSt: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "12px" };
const thSt: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-secondary)" };
const tdSt: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "top", color: "var(--text-secondary)", fontSize: "13px" };
