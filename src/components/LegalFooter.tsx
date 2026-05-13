import Link from "next/link";

const col1 = [
  { href: "/o-nas", label: "O nás" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/bezpecnost", label: "Bezpečnosť" },
];
const col2 = [
  { href: "/gdpr", label: "GDPR & Ochrana údajov" },
  { href: "/cookies", label: "Cookies" },
  { href: "/podmienky-pouzitia", label: "Podmienky používania" },
  { href: "/obchodne-podmienky", label: "Obchodné podmienky" },
  { href: "/reklamacny-poriadok", label: "Reklamačný poriadok" },
  { href: "/aml-poucenie", label: "AML poučenie" },
  { href: "/eticky-kodex", label: "Etický kódex" },
  { href: "/pristupnost", label: "Prístupnosť" },
];
const col3 = [
  { href: "/transparency", label: "Moje dáta (GDPR)" },
  { href: "/klientska-zona", label: "Klientska zóna" },
];

const lnk: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  textDecoration: "none",
  lineHeight: 1.8,
  display: "block",
};

export default function LegalFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        marginTop: "40px",
        padding: "24px 28px 16px",
        background: "var(--bg-base)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "20px",
          marginBottom: "16px",
        }}
      >
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            O nás
          </p>
          {col1.map(l => <Link key={l.href} href={l.href} style={lnk}>{l.label}</Link>)}
        </div>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Právne
          </p>
          {col2.map(l => <Link key={l.href} href={l.href} style={lnk}>{l.label}</Link>)}
        </div>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Pre klientov
          </p>
          {col3.map(l => <Link key={l.href} href={l.href} style={lnk}>{l.label}</Link>)}
        </div>
      </div>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        © 2026 Vianema s. r. o. · IČO: <span style={{ opacity: 0.6 }}>[doplniť]</span> · Powered by AMGD
      </p>
    </footer>
  );
}
