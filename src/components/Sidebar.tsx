"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { isFeatureEnabled } from "@/lib/featureToggles";
import { supabase } from "@/lib/supabase";

const ROUTE_FEATURE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/portfolio": "portfolio",
  "/klienti": "klienti",
  "/kupujuci": "kupujuci",
  "/naber": "nabery",
  "/inzerat": "ai_writer",
  "/kalendar": "kalendar",
  "/nastavenia": "nastavenia",
};

const mainNavBase = [
  { label: "Prehľad",      href: "/",           icon: "📊" },
  { label: "Portfólio",    href: "/portfolio",  icon: "🏠" },
  { label: "Klienti",      href: "/klienti",    icon: "👥" },
  { label: "Kupujúci",     href: "/kupujuci",   icon: "🔍" },
];

const toolsNav = [
  { label: "Náberový list",   href: "/naber",      icon: "📝" },
  { label: "Inzerát",         href: "/inzerat",    icon: "📰" },
  { label: "Analýza trhu",    href: "/analyzy",    icon: "📈" },
  { label: "Kalkulátor",      href: "/kalkulator", icon: "🧮" },
  { label: "Matching",        href: "/matching",   icon: "🔗" },
  { label: "Štatistiky",      href: "/statistiky", icon: "📉" },
];

const operativaNav = [
  { label: "Obhliadky",       href: "/obhliadky",           icon: "👁️" },
  { label: "Náklady",         href: "/naklady",             icon: "💰" },
  { label: "Produkcia",       href: "/produkcia",           icon: "📦" },
  { label: "Vyťaženosť tímu", href: "/vytazenost",          icon: "👷" },
  { label: "Provízie",        href: "/potvrdenie-provizii", icon: "✅" },
  { label: "Odberatelia",     href: "/odberatelia",         icon: "🏷️" },
  { label: "Faktúry",         href: "/faktury",             icon: "🧾" },
  { label: "Prehľad financií",href: "/prehlad-financii",    icon: "💶" },
  { label: "Provízie maklérov",href: "/provizie-maklerov",  icon: "💼" },
  { label: "Účtovný prehľad", href: "/uctovny-prehlad",     icon: "📊" },
  { label: "Pravidelné náklady",href: "/pravidelne-naklady",icon: "🔁" },
];

const systemNav = [
  { label: "Gmail",           href: "/gmail",      icon: "✉️" },
  { label: "Kalendár",        href: "/kalendar",   icon: "📅" },
  { label: "Google Disk",     href: "/disk",       icon: "💾" },
  { label: "Upozornenia",     href: "/upozornenia", icon: "🔔" },
  { label: "Tím",             href: "/tim",        icon: "👥" },
  { label: "Manažér",         href: "/manazer",    icon: "📊" },
  { label: "Klientská zóna",  href: "/klientska-zona", icon: "🌐" },
  { label: "Plán systému",    href: "/plan",       icon: "🗺️" },
  { label: "Nastavenia",      href: "/nastavenia", icon: "⚙️" },
  { label: "Notifikácie",     href: "/notifikacie", icon: "🔕", badge: 2 },
  { label: "System Log",      href: "/log",        icon: "📋" },
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
  const { user, logout } = useAuth();
  const [counts, setCounts] = useState<{ portfolio?: number; klienti?: number; kupujuci?: number }>({});

  useEffect(() => {
    (async () => {
      try {
        const [pf, kl, kp] = await Promise.all([
          supabase.from("nehnutelnosti").select("id", { count: "exact", head: true }),
          supabase.from("klienti").select("id", { count: "exact", head: true }).eq("typ", "predavajuci"),
          supabase.from("klienti").select("id", { count: "exact", head: true }).eq("typ", "kupujuci"),
        ]);
        setCounts({
          portfolio: pf.count ?? 0,
          klienti: kl.count ?? 0,
          kupujuci: kp.count ?? 0,
        });
      } catch { /* ignore */ }
    })();
  }, [pathname]);

  const mainNav: NavItem[] = mainNavBase.map((it) => {
    if (it.href === "/portfolio") return { ...it, badge: counts.portfolio };
    if (it.href === "/klienti") return { ...it, badge: counts.klienti };
    if (it.href === "/kupujuci") return { ...it, badge: counts.kupujuci };
    return it;
  });

  const filterNav = (items: NavItem[]) =>
    user ? items.filter(item => {
      const feat = ROUTE_FEATURE_MAP[item.href];
      return !feat || isFeatureEnabled(user.id, feat);
    }) : items;

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
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>v10.0 · Realitný systém</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
        <SectionLabel label="HLAVNÉ" />
        {filterNav(mainNav).map(item => <NavLink key={item.href} item={item} active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)} />)}
        <SectionLabel label="NÁSTROJE" />
        {filterNav(toolsNav).map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
        <SectionLabel label="OPERATÍVA" />
        {filterNav(operativaNav).map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
        <SectionLabel label="SYSTÉM" />
        {filterNav(systemNav).map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
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
            {user?.initials || "AM"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{user?.name || "Aleš Machovič"}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{user?.role || "Maklér · Vianema"}</div>
          </div>
          <button onClick={logout} title="Odhlásiť" style={{
            width: "28px", height: "28px", borderRadius: "50%",
            border: "1px solid var(--border)", background: "var(--bg-elevated)",
            cursor: "pointer", fontSize: "12px", color: "var(--text-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>↪</button>
        </div>
      </div>
    </aside>
  );
}
