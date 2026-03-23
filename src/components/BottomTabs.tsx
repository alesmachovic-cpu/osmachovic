"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Prehľad", href: "/", icon: "📊" },
  { label: "Portfólio", href: "/portfolio", icon: "🏠" },
  { label: "Klienti", href: "/klienti", icon: "👥" },
  { label: "Kupujúci", href: "/kupujuci", icon: "🔍" },
  { label: "Viac", href: "/nastavenia", icon: "⚙️" },
];

export default function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="bottom-tabs" style={{
      display: "none",
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)",
      borderTop: "1px solid var(--border)",
      justifyContent: "space-around", alignItems: "center",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      height: "calc(56px + env(safe-area-inset-bottom, 0px))",
    }}>
      {tabs.map(t => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            textDecoration: "none", padding: "6px 0", flex: 1,
            color: active ? "#374151" : "var(--text-muted)",
          }}>
            <span style={{ fontSize: "20px", lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: "10px", fontWeight: active ? "600" : "400" }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
