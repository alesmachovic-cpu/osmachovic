"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { PoweredByAMGD } from "@/components/brand";
import { isFeatureEnabled } from "@/lib/featureToggles";
import { useGoogleConnected } from "@/lib/useGoogleConnected";
import { mainNavBase, operativaNav, systemNav, devNav } from "@/lib/navItems";
import type { NavItem } from "@/lib/navItems";

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

const toolsNav: NavItem[] = []; // zrušená sekcia — všetko v hlavnom menu

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
  const tNav = useTranslations("nav");
  const [counts, setCounts] = useState<{ portfolio?: number; klienti?: number; kupujuci?: number }>({});
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pfRes, klRes] = await Promise.all([
          fetch("/api/nehnutelnosti", { credentials: "include" }),
          fetch("/api/klienti", { credentials: "include" }),
        ]);
        const [pf, kl]: [unknown[], { typ?: string }[]] = await Promise.all([
          pfRes.ok ? pfRes.json() : Promise.resolve([]),
          klRes.ok ? klRes.json() : Promise.resolve([]),
        ]);
        const predavajuciTypy = new Set(["predavajuci", "oboje", "prenajimatel"]);
        const kupujuciTypy = new Set(["kupujuci", "oboje"]);
        setCounts({
          portfolio: Array.isArray(pf) ? pf.length : 0,
          klienti: Array.isArray(kl) ? kl.filter(k => predavajuciTypy.has(k.typ ?? "")).length : 0,
          kupujuci: Array.isArray(kl) ? kl.filter(k => kupujuciTypy.has(k.typ ?? "")).length : 0,
        });
      } catch { /* ignore */ }
    })();
  }, [pathname, user?.id]);

  const mainNav: NavItem[] = mainNavBase.map((it) => {
    if (it.href === "/portfolio") return { ...it, badge: counts.portfolio };
    // Klienti zlúčuje Predávajúci + Kupujúci → badge = súčet všetkých klientov
    if (it.matchPrefix === "/klienti") return { ...it, badge: (counts.klienti || 0) + (counts.kupujuci || 0) };
    return it;
  });

  const filterNav = (items: NavItem[]) =>
    user ? items.filter(item => {
      if (item.href === "/inzerat" && user.id !== "ales") return false;
      if (user.id !== "ales") {
        const hidden = user.nav_prefs ?? [];
        if (hidden.includes(item.href)) return false;
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
        <SectionLabel label={tNav("sections.main")} />
        {filterNav(mainNav).map(item => {
          const prefix = item.matchPrefix || (item.href.split("?")[0]);
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(prefix);
          return <NavLink key={item.label} item={item} active={active} />;
        })}
        {toolsNav.length > 0 && (
          <>
            <SectionLabel label={tNav("sections.tools")} />
            {filterNav(toolsNav).map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
          </>
        )}
        <SectionLabel label={tNav("sections.admin")} />
        {filterNav(operativaNav).map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
        <SectionLabel label={tNav("sections.system")} />
        {filterNav(systemNav).map(item => <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />)}
        {user?.id === "ales" && (
          <>
            <button onClick={() => setDevOpen(o => !o)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 12px 4px", background: "transparent", border: "none", cursor: "pointer",
              fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.02em",
            }}>
              <span>DEV</span>
              <span style={{ fontSize: "9px", opacity: 0.6 }}>{devOpen ? "▲" : "▼"}</span>
            </button>
            {devOpen && devNav.map(item => {
              const prefix = item.matchPrefix || item.href.split("?")[0];
              const active = pathname.startsWith(prefix);
              return <NavLink key={item.href} item={item} active={active} />;
            })}
          </>
        )}
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
