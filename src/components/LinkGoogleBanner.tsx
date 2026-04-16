"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

/**
 * Banner ktorý pozve prihláseného maklera spárovať svoj Google účet,
 * ak ešte login_email nenastavený.
 *
 * Zobrazuje sa až po hesla-login, hore na dashboarde.
 * Dá sa dočasne odložiť (Možno neskôr → skry na 24h).
 */
export default function LinkGoogleBanner() {
  const { user, linkGoogleToCurrent } = useAuth();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(true); // predvolene skryté kým neoveríme
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  useEffect(() => {
    // Success toast po návrate z linking flow
    if (searchParams.get("linked") === "1") {
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 4500);
      // Vyčisti URL
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("linked");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) { setDismissed(true); return; }
    if (user.login_email) { setDismissed(true); return; }
    // Skontroluj skip flag (24h)
    const skipUntil = localStorage.getItem(`skip_link_gmail_${user.id}`);
    if (skipUntil && parseInt(skipUntil) > Date.now()) {
      setDismissed(true);
      return;
    }
    setDismissed(false);
  }, [user]);

  if (!user) return null;

  const handleLink = async () => {
    setLoading(true);
    try {
      await linkGoogleToCurrent();
    } catch (e) {
      console.error("[link-google] failed:", e);
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (!user) return;
    localStorage.setItem(`skip_link_gmail_${user.id}`, String(Date.now() + 24 * 60 * 60 * 1000));
    setDismissed(true);
  };

  if (successToast) {
    return (
      <div style={{
        position: "fixed", top: "16px", right: "16px", zIndex: 200,
        background: "#065F46", color: "#fff",
        padding: "14px 18px", borderRadius: "12px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        fontSize: "14px", fontWeight: 500,
        display: "flex", alignItems: "center", gap: "10px",
        maxWidth: "340px",
        animation: "slideIn 0.3s ease",
      }}>
        <span style={{ fontSize: "20px" }}>✅</span>
        <div>
          <div style={{ fontWeight: 700 }}>Google účet prepojený</div>
          <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>
            Odteraz sa môžeš prihlásiť aj cez "Prihlásiť cez Google".
          </div>
        </div>
        <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>
    );
  }

  if (dismissed) return null;

  return (
    <div style={{
      margin: "0 0 20px",
      background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)",
      border: "1px solid #BFDBFE",
      borderRadius: "16px",
      padding: "20px 24px",
      display: "flex", gap: "18px", alignItems: "flex-start",
      boxShadow: "0 2px 8px rgba(59,130,246,0.08)",
    }}>
      <div style={{
        width: "44px", height: "44px", borderRadius: "12px",
        background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#1E3A8A", marginBottom: "4px" }}>
          Prepoj si Google účet
        </div>
        <div style={{ fontSize: "13px", color: "#1E40AF", lineHeight: 1.55, marginBottom: "12px" }}>
          Aby si mohol naplno využívať CRM, prepoj svoj Gmail účet. Získaš:
          <ul style={{ margin: "6px 0 0 16px", paddingLeft: 0, listStyle: "disc" }}>
            <li><strong>Synchronizáciu s Google Kalendárom</strong> — náberové stretnutia automaticky v kalendári</li>
            <li><strong>Posielanie emailov cez Gmail</strong> priamo z CRM</li>
            <li><strong>Prístup k Google Disku</strong> — dokumenty klientov na jednom mieste</li>
            <li><strong>Bezpečnejšie prihlásenie</strong> cez Google (2FA, rýchlejší login)</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={handleLink}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              height: "36px", padding: "0 16px",
              background: "#2563EB", color: "#fff",
              border: "none", borderRadius: "10px",
              fontSize: "13px", fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.15s",
            }}
          >
            {loading ? (
              <>
                <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Pripájam...
              </>
            ) : "Prepojiť Google účet"}
          </button>
          <button
            onClick={handleSkip}
            style={{
              height: "36px", padding: "0 14px",
              background: "transparent", color: "#1E40AF",
              border: "none", borderRadius: "10px",
              fontSize: "13px", fontWeight: 500, cursor: "pointer",
            }}
          >
            Možno neskôr
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
