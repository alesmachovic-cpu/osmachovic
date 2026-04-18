"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResetPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError("Neplatný odkaz — chýba token.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Heslo musí mať aspoň 8 znakov"); return; }
    if (password !== password2) { setError("Heslá sa nezhodujú"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Chyba");
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: "420px",
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(40px)",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.12)",
        padding: "36px 32px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 auto 14px",
          }}>🔑</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>
            Nové heslo
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
            {done ? "Heslo bolo úspešne zmenené. Presmerovávam..." : "Zadaj nové heslo pre svoj účet"}
          </p>
        </div>

        {!done && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "6px", display: "block", textTransform: "uppercase" }}>
                Nové heslo
              </label>
              <input
                type="password" autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimálne 8 znakov"
                disabled={submitting || !token}
                style={{
                  width: "100%", padding: "13px 16px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff", fontSize: "14px", outline: "none",
                }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: "6px", display: "block", textTransform: "uppercase" }}>
                Potvrdiť heslo
              </label>
              <input
                type="password" autoComplete="new-password"
                value={password2} onChange={e => setPassword2(e.target.value)}
                placeholder="••••••••"
                disabled={submitting || !token}
                style={{
                  width: "100%", padding: "13px 16px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff", fontSize: "14px", outline: "none",
                }} />
            </div>

            {error && (
              <div style={{
                padding: "10px 12px", borderRadius: "10px",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fecaca", fontSize: "12px",
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={submitting || !token || !password || password !== password2}
              style={{
                width: "100%", padding: "14px 16px", borderRadius: "12px",
                background: "#fff", color: "#111827",
                border: "none", fontSize: "14px", fontWeight: 700,
                cursor: (submitting || !token || !password || password !== password2) ? "default" : "pointer",
                opacity: (submitting || !token || !password || password !== password2) ? 0.5 : 1,
                marginTop: "6px",
              }}>
              {submitting ? "Ukladám..." : "Nastaviť heslo"}
            </button>
          </form>
        )}

        {done && (
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", margin: 0 }}>
              Heslo bolo zmenené.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Načítavam...</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
