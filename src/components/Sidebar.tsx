"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mainNav = [
  { label: "Prehľad",      href: "/",           icon: "📊" },
  { label: "Portfólio",    href: "/portfolio",  icon: "🏠", badge: 12, badgeColor: "var(--accent)" },
  { label: "Klienti",      href: "/klienti",    icon: "👥", badge: 3,  badgeColor: "var(--success)" },
  { label: "Kupujúci",     href: "/kupujuci",   icon: "🔍", badge: 7,  badgeColor: "var(--warning)" },
];

const toolsNav = [
  { label: "AI Writer",       href: "/ai-writer",  icon: "✍️" },
  { label: "Tvorba inzerátu", href: "/inzerat",    icon: "📝" },
  { label: "Analýza trhu",    href: "/analyzy",    icon: "📈" },
  { label: "Kalkulátor",      href: "/kalkulator", icon: "🧮" },
  { label: "Matching",        href: "/matching",   icon: "🔗" },
];

const systemNav = [
  { label: "Export portály", href: "/export",     icon: "📤" },
  { label: "Nastavenia",     href: "/nastavenia", icon: "⚙️" },
  { label: "System Log",     href: "/log",        icon: "📋" },
];

type NavItem = { label: string; href: string; icon: string; badge?: number; badgeColor?: string };

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: "7px", fontSize: "13px", fontWeight: active ? "600" : "400", color: active ? "var(--accent)" : "var(--text-secondary)", background: active ? "var(--accent-light)" : "transparent", textDecoration: "none" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "14px", lineHeight: 1 }}>{item.icon}</span>
        {item.label}
      </span>
      {item.badge !== undefined && (
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", background: item.badgeColor, borderRadius: "10px", padding: "1px 7px" }}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", letterSpacing: "0.08em", padding: "12px 10px 3px", textTransform: "uppercase" }}>
      {label}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{ width: "205px", minWidth: "205px", height: "100vh", background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "sticky", top: 0 }}>
      {/* Logo */}
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #3B82F6, #6366F1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>
            🏢
          </div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.2 }}>Machovič CRM</div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>v9.6 · Realitný systém</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto" }}>
        <SectionLabel label="Hlavné" />
        {mainNav.map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}
        <SectionLabel label="Nástroje" />
        {toolsNav.map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}
        <SectionLabel label="Systém" />
        {systemNav.map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}
      </nav>

      {/* User */}
      <div style={{ padding: "10px 8px 14px", borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "8px 10px", borderRadius: "8px", background: "var(--bg-elevated)" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #3B82F6, #6366F1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "#fff", flexShrink: 0 }}>
            N
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Aleš Machovič</div>
            <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>Maklér · Vianema</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
