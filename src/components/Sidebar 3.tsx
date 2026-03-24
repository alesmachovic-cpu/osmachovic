"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mainNav = [
  { label: "Prehľad",      href: "/",           icon: "📊" },
  { label: "Portfólio",    href: "/portfolio",  icon: "🏠", badge: 12 },
  { label: "Klienti",      href: "/klienti",    icon: "👥", badge: 3 },
  { label: "Kupujúci",     href: "/kupujuci",   icon: "🔍", badge: 7 },
];

const toolsNav = [
  { label: "Náberový list",   href: "/naber",      icon: "📝" },
  { label: "Analýza trhu",    href: "/analyzy",    icon: "📈" },
  { label: "Kalkulátor",      href: "/kalkulator", icon: "🧮" },
  { label: "Matching",        href: "/matching",   icon: "🔗" },
];

const systemNav = [
  { label: "Nastavenia",     href: "/nastavenia", icon: "⚙️" },
  { label: "Notifikácie",    href: "/notifikacie", icon: "🔔", badge: 2 },
  { label: "System Log",     href: "/log",        icon: "📋" },
];

type NavItem = { label: string; href: string; icon: string; badge?: number };

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} onClick={() => document.body.classList.remove("sidebar-open")} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", borderRadius: "8px", fontSize: "13px",
      fontWeight: active ? "600" : "400",
      color: active ? "var(--accent)" : "var(--text-primary)",
      background: active ? "var(--sidebar-active)" : "transparent",
      textDecoration: "none", transition: "all 0.15s ease",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "15px", lineHeight: 1, width: "20px", textAlign: "center" }}>{item.icon}</span>
        {item.label}
      </span>
      {item.badge !== undefined && (
        <span style={{
          fontSize: "11px", fontWeight: "600",
          color: active ? "var(--accent)" : "var(--text-muted)",
          background: active ? "rgba(0,122,255,0.1)" : "var(--bg-elevated)",
          borderRadius: "10px", padding: "2px 8px", minWidth: "24px", textAlign: "center",
        }}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
      letterSpacing: "0.02em", padding: "16px 12px 4px",
    }}>
      {label}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: "220px", minWidth: "220px", height: "100vh",
      background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px", height: "34px",
            background: "#374151",
            borderRadius: "10px", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "16px", flexShrink: 0,
          }}>
            🏢
          </div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.2 }}>Machovič CRM</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>v9.6 · Realitný systém</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
        <SectionLabel label="HLAVNÉ" />
        {mainNav.map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}
        <SectionLabel label="NÁSTROJE" />
        {toolsNav.map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}
        <SectionLabel label="SYSTÉM" />
        {systemNav.map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}
      </nav>

      {/* User */}
      <div style={{ padding: "12px 8px 16px", borderTop: "1px solid var(--border)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 12px", borderRadius: "10px",
        }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            background: "#374151",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", fontWeight: "700", color: "#fff", flexShrink: 0,
          }}>
            AM
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>Aleš Machovič</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Maklér · Vianema</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
