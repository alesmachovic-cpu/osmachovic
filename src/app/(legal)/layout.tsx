import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

const LEGAL_LINKS = [
  { href: "/gdpr", label: "GDPR" },
  { href: "/cookies", label: "Cookies" },
  { href: "/podmienky-pouzitia", label: "Podmienky používania" },
  { href: "/obchodne-podmienky", label: "Obchodné podmienky" },
  { href: "/reklamacny-poriadok", label: "Reklamačný poriadok" },
  { href: "/aml-poucenie", label: "AML poučenie" },
  { href: "/eticky-kodex", label: "Etický kódex" },
  { href: "/o-nas", label: "O nás" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/bezpecnost", label: "Bezpečnosť" },
  { href: "/pristupnost", label: "Prístupnosť" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "780px", margin: "0 auto", paddingBottom: "60px" }}>
      {children}
      <nav
        aria-label="Právne dokumenty"
        style={{
          marginTop: "48px",
          paddingTop: "24px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
          Právne dokumenty
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          {LEGAL_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{ fontSize: "12px", color: "var(--text-secondary)", textDecoration: "none" }}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "16px" }}>
          © 2026 Vianema s. r. o. · Powered by AMGD
        </p>
      </nav>
    </div>
  );
}
