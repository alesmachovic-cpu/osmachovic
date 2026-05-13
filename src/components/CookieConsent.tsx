"use client";

import { useEffect, useState } from "react";
import { hasConsent, setConsent, type ConsentPrefs } from "@/lib/consent";

// Banner je momentálne SKRYTÝ — žiadne analytické/marketingové cookies.
// Aktivuj zmenou SHOW_BANNER na true keď pridáš 3rd party tracking.
const SHOW_BANNER = false;

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [custom, setCustom] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPrefs>({ analytics: false, marketing: false });

  useEffect(() => {
    if (!SHOW_BANNER) return;
    const saved = localStorage.getItem("cookie_consent_v1");
    if (!saved) setVisible(true);
  }, []);

  function acceptAll() {
    setConsent({ analytics: true, marketing: true });
    setVisible(false);
  }

  function acceptNecessary() {
    setConsent({ analytics: false, marketing: false });
    setVisible(false);
  }

  function saveCustom() {
    setConsent(prefs);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Nastavenie cookies"
      style={{
        position: "fixed", bottom: "20px", left: "20px", right: "20px", maxWidth: "480px",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "14px", padding: "20px", zIndex: 9999,
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      }}
    >
      <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Nastavenie cookies</p>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "12px" }}>
        Používame technické cookies nevyhnutné pre fungovanie systému.{" "}
        <a href="/cookies" style={{ color: "var(--accent)", textDecoration: "none" }}>Viac info</a>
      </p>

      {custom && (
        <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" checked disabled /> Nevyhnutné (vždy aktívne)
          </label>
          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" checked={prefs.analytics} onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))} />
            Analytické
          </label>
          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" checked={prefs.marketing} onChange={e => setPrefs(p => ({ ...p, marketing: e.target.checked }))} />
            Marketingové
          </label>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {custom ? (
          <button onClick={saveCustom} style={btnPrimary}>Uložiť</button>
        ) : (
          <>
            <button onClick={acceptAll} style={btnPrimary}>Prijať všetko</button>
            <button onClick={() => setCustom(true)} style={btnSecondary}>Vlastné nastavenia</button>
            <button onClick={acceptNecessary} style={btnSecondary}>Iba nevyhnutné</button>
          </>
        )}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { background: "#374151", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" };
