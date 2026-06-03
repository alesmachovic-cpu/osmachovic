"use client";

import { useEffect, useState } from "react";

/**
 * Dočasná údržbová brána pre vianema.amgd.sk.
 *
 * Vznik 2026-06-03 02:00 SEČ — Aleš stratil prístup ku prod Supabase projektu
 * (`hokymscytscsewrpwdjf`) počas key/URL rotácie. Vianema.amgd.sk teraz
 * pointuje na test DB (`ntdjsmqzzvqqammmiqye`), čo by maklérom ukazovalo
 * test záznamy ("Test IDOR Check", atď.) namiesto reálnych klientov.
 *
 * Tato brána zabráni maklérom otvoriť app a vidieť chybné dáta. Zostáva
 * aktívna kým Aleš nenájde pôvodný Supabase prístup a env vars sa nezvráti.
 *
 * Dev.amgd.sk NIE JE blokované — Aleš tam môže ďalej pracovať.
 *
 * Bypass cez query param: vianema.amgd.sk/?bypass=true zobrazí app
 * (pre Aleša ak by potreboval otestovať).
 */
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Bypass cez query param
    const params = new URLSearchParams(window.location.search);
    if (params.get("bypass") === "true") {
      try { localStorage.setItem("maintenance_bypass", "1"); } catch { /* noop */ }
    }
    const bypassed = (() => {
      try { return localStorage.getItem("maintenance_bypass") === "1"; } catch { return false; }
    })();
    // Iba vianema.amgd.sk je v údržbe; dev.amgd.sk + localhost funguje normálne
    const isVianemaProd = window.location.host === "vianema.amgd.sk";
    setShow(isVianemaProd && !bypassed);
  }, []);

  if (show === null) {
    // Server-side render — neukáž nič kým neviems prostredie
    return <>{children}</>;
  }

  if (!show) return <>{children}</>;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#F5F5F7",
        padding: "24px",
        textAlign: "center",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ fontSize: "56px", marginBottom: "16px" }}>🛠️</div>
      <h1 style={{ fontSize: "28px", fontWeight: 600, margin: "0 0 12px", color: "#1C1C1E" }}>
        Údržba systému
      </h1>
      <p style={{ fontSize: "16px", color: "#6b7280", maxWidth: "480px", margin: "0 0 8px" }}>
        Pracujeme na obnove databázy. Vrátime sa čo najskôr.
      </p>
      <p style={{ fontSize: "14px", color: "#6b7280", maxWidth: "480px", margin: 0 }}>
        Pre urgentné záležitosti kontaktujte Aleša.
      </p>
    </div>
  );
}
