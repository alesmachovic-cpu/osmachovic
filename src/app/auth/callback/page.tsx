"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * OAuth callback page.
 * Podporuje dva režimy:
 * 1) Normálne prihlásenie cez Google — session sa vytvorí a AuthProvider matchne whitelist
 * 2) Prepojenie Google k existujúcemu userovi (pending_link_user_id v localStorage)
 *    — uloží google email do users.login_email pre tohto user, potom zahodí Supabase session
 *    (ostane prihlásený cez pôvodný password session)
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Prihlasujem...");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const errorDescription = url.searchParams.get("error_description");
        if (errorDescription) {
          setError(errorDescription);
          setTimeout(() => router.push("/"), 3000);
          return;
        }

        setStatus("Overujem účet...");

        // Počkaj kým Supabase spracuje URL hash a uloží session
        let tries = 0;
        while (tries < 30) {
          const { data } = await supabase.auth.getSession();
          if (data.session) break;
          await new Promise((r) => setTimeout(r, 100));
          tries++;
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setError("Session sa neuložila. Skús znova.");
          setTimeout(() => router.push("/"), 3000);
          return;
        }

        const sessionEmail = data.session.user?.email;
        const pendingLinkId = localStorage.getItem("pending_link_user_id");

        if (pendingLinkId && sessionEmail) {
          // LINKING MODE: uloź google email k tomuto userovi, potom zahoď Supabase session
          setStatus("Ukladám prepojenie...");
          await supabase.from("users")
            .update({ login_email: sessionEmail })
            .eq("id", pendingLinkId);
          await supabase.auth.signOut();
          localStorage.removeItem("pending_link_user_id");
          localStorage.setItem("crm_user", pendingLinkId); // zostaň prihlásený cez heslo
          router.push("/?linked=1");
          return;
        }

        // NORMÁLNY MODE: redirect na dashboard, AuthProvider matchne whitelist
        setStatus("Hotovo! Presmerovávam...");
        await new Promise((r) => setTimeout(r, 200));
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setTimeout(() => router.push("/"), 3000);
      }
    })();
  }, [router]);

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
