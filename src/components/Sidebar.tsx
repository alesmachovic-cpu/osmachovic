"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PoweredByAMGD } from "@/components/brand";
import { isFeatureEnabled } from "@/lib/featureToggles";
import { supabase } from "@/lib/supabase";
import { useGoogleConnected } from "@/lib/useGoogleConnected";

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

// TASK 1 — Konsolidované menu (14 → 8 hlavných položiek)
// Každá zlúčená položka rieši taby v cieľovej stránke.
const mainNavBase = [
  { label: "Prehľad",                 href: "/",                         icon: "📊" },
  { label: "Portfólio",               href: "/portfolio",                icon: "🏠" },
  { label: "Klienti",                 href: "/klienti?tab=predavajuci",  icon: "👥", matchPrefix: "/klienti" },
  { label: "Náberový list",           href: "/naber",                    icon: "📝" },
  { label: "Monitor & Analýza",       href: "/monitor?tab=scraping",     icon: "📡", matchPrefix: "/monitor" },
  { label: "Kalkulátor & Matching",   href: "/nastroje?tab=kalkulator",  icon: "🧮", matchPrefix: "/nastroje" },
  { label: "Štatistiky",              href: "/statistiky",               icon: "📉" },
  { label: "Operatíva",               href: "/operativa?tab=obhliadky",  icon: "📋", matchPrefix: "/operativa" },
];

const toolsNav: NavItem[] = []; // zrušená sekcia — všetko v hlavnom menu

const operativaNav = [
  // Operatíva → Obhliadky/Náklady/Kalendár sú v /operativa taboch.
  // Tu necháme finančno-administratívne nástroje ktoré nie sú v hlavnom menu.
  { label: "Produkcia",          href: "/produkcia",            icon: "📦" },
  { label: "Vyťaženosť tímu",    href: "/vytazenost",           icon: "👷" },
  { label: "Provízie",           href: "/potvrdenie-provizii",  icon: "✅" },
  { label: "Odberatelia",        href: "/odberatelia",          icon: "🏷️" },
  { label: "Faktúry",            href: "/faktury",              icon: "🧾" },
  { label: "Prehľad financií",   href: "/prehlad-financii",     icon: "💶" },
  { label: "Provízie maklérov",  href: "/provizie-maklerov",    icon: "💼" },
  { label: "Účtovný prehľad",    href: "/uctovny-prehlad",      icon: "📊" },
  { label: "Pravidelné náklady", href: "/pravidelne-naklady",   icon: "🔁" },
];

const systemNav = [
  { label: "Gmail",           href: "/gmail",      icon: "✉️" },
  { label: "Kalendár",        href: "/kalendar",   icon: "📅" },
  { label: "Google Disk",     href: "/disk",       icon: "💾" },
  { label: "Upozornenia",     href: "/upozornenia", icon: "🔔" },
  { label: "Tím",             href: "/tim",        icon: "👥" },
  { label: "Klientská zóna",  href: "/klientska-zona", icon: "🌐" },
  { label: "Plán systému",    href: "/plan",       icon: "🗺️" },
  { label: "Nastavenia",      href: "/nastavenia", icon: "⚙️" },
  { label: "Notifikácie",     href: "/notifikacie", icon: "🔕", badge: 2 },
  { label: "System Log",      href: "/log",        icon: "📋" },
];

type NavItem = { label: string; href: string; icon: string; badge?: number; matchPrefix?: string };

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
          // Klienti badge = predávajúci + oboje + prenajímateľ (všetci okrem "kupujuci")
          supabase.from("klienti").select("id", { count: "exact", head: true }).in("typ", ["predavajuci", "oboje", "prenajimatel"]),
          // Kupujúci badge = kupujuci + oboje (oboje sa zobrazujú na /kupujuci stránke)
          supabase.from("klienti").select("id", { count: "exact", head: true }).in("typ", ["kupujuci", "oboje"]),
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
    // Klienti zlúčuje Predávajúci + Kupujúci → badge = súčet všetkých klientov
    if (it.matchPrefix === "/klienti") return { ...it, badge: (counts.klienti || 0) + (counts.kupujuci || 0) };
    return it;
  });

  const filterNav = (items: NavItem[]) =>
    user ? items.filter(item => {
      // "Inzerát" v sidebar vidí iba admin (Aleš). Ostatní makléri inzerát
      // nevytvárajú — dostanú ho z Portfolia až keď admin vytvorí.
      if (item.href === "/inzerat" && user.id !== "ales") return false;
      // "Matching" v menu vidí iba super_admin / majitel / manazer.
      // Maklér používa matching len kontextovo cez tlačidlo "Hľadať zhody"
      // z karty objednávky v /kupujuci (?objednavka=ID).
      if (item.href === "/matching") {
        const elevated = user.role === "super_admin" || user.role === "majitel" || user.role === "manazer";
        if (!elevated && user.id !== "ales") return false;
      }
      const feat = ROUTE_FEATURE_MAP[item.href];
      return !feat || isFeatureEnabled(user.id, feat);
    }) : items;

  return (
    <aside style={{
      width: "220px", minWidth: "220px", height: "100vh",
      background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", position: "sticky", top: 0,
    }}>
      {/* Brand — Tier 1: VIANEMA dominant, AMGD whisper */}
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", color: "var(--text-primary)" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{
              fontSize: "20px", fontWeight: 500, letterSpacing: "-0.03em",
              lineHeight: 1, color: "var(--text-primary)",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            }}>VIANEMA</span>
            <span style={{
              fontSize: "8px", letterSpacing: "0.4em", color: "var(--text-muted)",
              marginTop: "2px",
            }}>REAL</span>
          </div>
          <div style={{ marginTop: "6px", color: "var(--text-muted)" }}>
            <PoweredByAMGD size="sm" />
          </div>
        </div>
      </div>

      <GoogleNotConnectedBanner userId={user?.id} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
        <SectionLabel label="HLAVNÉ" />
        {filterNav(mainNav).map(item => {
          const prefix = item.matchPrefix || (item.href.split("?")[0]);
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(prefix);
          return <NavLink key={item.label} item={item} active={active} />;
        })}
        {toolsNav.length > 0 && (
          <>
            <SectionLabel label="NÁSTROJE" />
            {filterNav(toolsNav).map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
          </>
        )}
        <SectionLabel label="ADMINISTRATÍVA" />
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

function GoogleNotConnectedBanner({ userId }: { userId?: string | null }) {
  const connected = useGoogleConnected(userId);
  if (connected !== false) return null; // loading alebo OK → nezobraz
  return (
    <Link href="/nastavenia" style={{
      display: "block", margin: "0 12px 8px", padding: "10px 12px",
      borderRadius: "8px", background: "var(--warning-light)",
      border: "1px solid var(--warning)", color: "var(--warning)",
      fontSize: "11px", fontWeight: 600, lineHeight: 1.4, textDecoration: "none",
    }}>
      ⚠️ Google nepripojený<br />
      <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
        Pripomienky a obhliadky sa nepridajú do kalendára. Kliknutím prejdi do Nastavení.
      </span>
    </Link>
  );
}
