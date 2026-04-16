"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * OAuth callback page.
 * Supabase Google sign-in (implicit flow) redirects here with #access_token=... in URL hash.
 * Supabase client auto-processes the hash and stores session. We just wait and redirect.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Prihlasujem...");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const errorDescription = url.searchParams.get("error_description") || url.hash.includes("error_description");
        if (errorDescription && typeof errorDescription === "string") {
          setError(errorDescription);
          setTimeout(() => router.push("/"), 3000);
          return;
        }

        setStatus("Overujem účet...");

        // Supabase client automaticky spracuje URL hash (#access_token=...).
        // Počkáme kým sa session uloží (polling max 3s).
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
