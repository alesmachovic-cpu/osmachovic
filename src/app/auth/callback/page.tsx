"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * OAuth callback page.
 * Supabase Google sign-in redirects here after successful auth.
 * We verify the session is set, then redirect to Prehľad.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Supabase auto-processes URL hash fragments.
        // We just need to wait for session to be available.
        await new Promise((r) => setTimeout(r, 500));
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          setError("Prihlásenie sa nepodarilo. Skús znova.");
          setTimeout(() => router.push("/"), 2500);
          return;
        }
        // Logged in — redirect to dashboard. AuthProvider will match whitelist.
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
      background: "var(--bg-base, #F5F5F7)",
    }}>
      <div style={{ textAlign: "center" }}>
        {error ? (
          <>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#991B1B", margin: "0 0 8px" }}>
              Prihlásenie zlyhalo
            </h2>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>{error}</p>
          </>
        ) : (
          <>
            <div style={{
              width: "40px", height: "40px",
              border: "3px solid #e5e7eb", borderTopColor: "#374151",
              borderRadius: "50%", margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>Prihlasujem...</p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
