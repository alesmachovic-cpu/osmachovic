"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * OAuth callback page.
 * Po úspešnom Google OAuth:
 * 1) Počká kým sa Supabase session uloží
 * 2) Nájde usera v `users` tabuľke podľa emailu
 * 3) Ak existuje "pending_link_user_id" (linking flow) → uloží login_email k tomu userovi
 * 4) Nastaví localStorage.crm_user → hard reload na dashboard
 *
 * AuthProvider potom prečíta crm_user a zobrazí dashboard.
 */
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Prihlasujem...");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const errDesc = url.searchParams.get("error_description");
        if (errDesc) {
          setError(errDesc);
          setTimeout(() => { window.location.href = "/"; }, 3000);
          return;
        }

        setStatus("Overujem Google účet...");

        // Počkaj kým Supabase spracuje URL hash a uloží session (max 3s)
        let session = null;
        for (let i = 0; i < 30; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) { session = data.session; break; }
          await new Promise((r) => setTimeout(r, 100));
        }

        if (!session?.user?.email) {
          setError("Google prihlásenie zlyhalo — session sa neuložila.");
          setTimeout(() => { window.location.href = "/"; }, 3000);
          return;
        }

        const gmailEmail = session.user.email;

        // Linking flow: pripoj Gmail k existujúcemu userovi
        const pendingLinkId = localStorage.getItem("pending_link_user_id");
        if (pendingLinkId) {
          setStatus("Pripájam Google účet...");
          // Cez API endpoint (admin client) — users tabuľka je chránená RLS
          try {
            await fetch(`/api/users?id=${encodeURIComponent(pendingLinkId)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ login_email: gmailEmail }),
            });
          } catch (e) { console.warn("[callback] link update error:", e); }

          await supabase.auth.signOut();
          localStorage.removeItem("pending_link_user_id");
          localStorage.setItem("crm_user", pendingLinkId);
          setStatus("Prepojenie úspešné! Presmerovávam...");
          setTimeout(() => { window.location.href = "/?linked=1"; }, 300);
          return;
        }

        // Normálny Google login: nájdi usera podľa emailu
        setStatus("Hľadám účet...");
        const usersRes = await fetch("/api/users").then(r => r.json());
        const accs = usersRes.users ?? [];
        const matched = accs.find((a) => {
          const gEmail = gmailEmail.toLowerCase();
          return (
            (a.login_email || "").toLowerCase() === gEmail ||
            (a.email || "").toLowerCase() === gEmail
          );
        });

        if (!matched) {
          setError(`Google účet ${gmailEmail} nie je povolený. Požiadaj admina o prístup.`);
          await supabase.auth.signOut();
          setTimeout(() => { window.location.href = "/"; }, 4000);
          return;
        }

        // Auto-naviaž login_email ak prvýkrát (cez API)
        if (!matched.login_email) {
          try {
            await fetch(`/api/users?id=${encodeURIComponent(matched.id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ login_email: gmailEmail }),
            });
          } catch (e) { console.warn("[callback] auto-link error:", e); }
        }

        localStorage.setItem("crm_user", matched.id);

        // Vystav HMAC session cookie SYNCHRONOUSLY pred reloadom,
        // inak prvý load po Google OAuth má prázdny cookie → guard endpointy
        // 401 → user vidí "Google nepripojený" a musí prihlásiť znova.
        setStatus("Vystavujem session...");
        try {
          await fetch("/api/auth/session-bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ user_id: matched.id }),
          });
        } catch (e) {
          console.warn("[callback] session-bootstrap error:", e);
        }

        setStatus("Hotovo! Presmerovávam...");
        setTimeout(() => { window.location.href = "/"; }, 200);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setTimeout(() => { window.location.href = "/"; }, 3000);
      }
    })();
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#F5F5F7",
    }}>
      <div style={{ textAlign: "center" }}>
        {error ? (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#991B1B", margin: "0 0 8px" }}>
              Prihlásenie zlyhalo
            </h2>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0, maxWidth: "400px" }}>{error}</p>
          </>
        ) : (
          <>
            <div style={{
              width: "40px", height: "40px",
              border: "3px solid #e5e7eb", borderTopColor: "#374151",
              borderRadius: "50%", margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>{status}</p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
