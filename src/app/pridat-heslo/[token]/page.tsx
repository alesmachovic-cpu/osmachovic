"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";

type TokenState = "loading" | "valid" | "invalid";

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: ok ? "#059669" : "#6B7280" }}>
      <span style={{ fontSize: 14 }}>{ok ? "✓" : "○"}</span>
      {label}
    </div>
  );
}

export default function PridatHesloPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [state, setState] = useState<TokenState>("loading");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/api/users/invite/accept?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setState("valid"); setUserName(d.userName); setUserId(d.userId ?? ""); }
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const rules = {
    minLength:    password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber:    /[0-9]/.test(password),
  };
  const passwordOk = Object.values(rules).every(Boolean);
  const confirmOk = confirm.length > 0 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!passwordOk) { setError("Heslo nespĺňa požiadavky"); return; }
    if (password !== confirm) { setError("Heslá sa nezhodujú"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Chyba"); return; }
      // Nastav nového makléra ako aktívneho usera — cookie je už nastavený serverom
      const uid = data.userId || userId;
      if (uid) localStorage.setItem("crm_user", uid);
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#F5F5F7",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, border: "1px solid #E5E5EA",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        width: "100%", maxWidth: 380, padding: "36px 32px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1d1d1f", letterSpacing: "-0.02em", marginBottom: 2 }}>VIANEMA</div>
          <div style={{ fontSize: 13, color: "#6e6e73" }}>CRM systém</div>
        </div>

        {state === "loading" && (
          <p style={{ textAlign: "center", color: "#6e6e73", fontSize: 13 }}>Overujem odkaz…</p>
        )}

        {state === "invalid" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
            <div style={{ fontWeight: 600, color: "#1d1d1f", marginBottom: 8, fontSize: 15 }}>Odkaz nie je platný</div>
            <div style={{ fontSize: 13, color: "#6e6e73" }}>Odkaz expiroval alebo bol už použitý. Požiadaj administrátora o novú pozvánku.</div>
          </div>
        )}

        {state === "valid" && !done && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#1d1d1f", marginBottom: 4 }}>
                {userName ? `Ahoj, ${userName} 👋` : "Nastav si heslo"}
              </div>
              <div style={{ fontSize: 13, color: "#6e6e73" }}>Vytvor si heslo pre prihlásenie do CRM.</div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1d1d1f", marginBottom: 6 }}>Heslo</label>
                <PasswordInput
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimálne 8 znakov"
                  autoComplete="new-password"
                />
                {password.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", background: "#F9FAFB", borderRadius: 10, border: "1px solid #E5E7EB" }}>
                    <PasswordRule ok={rules.minLength}    label="Aspoň 8 znakov" />
                    <PasswordRule ok={rules.hasUppercase} label="Veľké písmeno (A–Z)" />
                    <PasswordRule ok={rules.hasLowercase} label="Malé písmeno (a–z)" />
                    <PasswordRule ok={rules.hasNumber}    label="Číslica (0–9)" />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1d1d1f", marginBottom: 6 }}>Potvrdiť heslo</label>
                <PasswordInput
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Zopakuj heslo"
                  autoComplete="new-password"
                />
                {confirm.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: confirmOk ? "#059669" : "#DC2626" }}>
                    {confirmOk ? "✓ Heslá sa zhodujú" : "Heslá sa nezhodujú"}
                  </div>
                )}
              </div>

              {error && (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 12 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !passwordOk || !confirmOk}
                style={{
                  width: "100%", padding: "13px 16px", borderRadius: 12,
                  background: "#0071e3", color: "#fff", border: "none",
                  fontSize: 14, fontWeight: 600,
                  cursor: (submitting || !passwordOk || !confirmOk) ? "default" : "pointer",
                  opacity: (submitting || !passwordOk || !confirmOk) ? 0.45 : 1,
                  transition: "opacity 0.15s",
                }}>
                {submitting ? "Ukladám…" : "Nastaviť heslo"}
              </button>
            </form>
          </>
        )}

        {done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ fontWeight: 600, color: "#1d1d1f", marginBottom: 6, fontSize: 15 }}>Heslo nastavené</div>
            <div style={{ fontSize: 13, color: "#6e6e73" }}>Presmerúvam ťa na CRM…</div>
          </div>
        )}
      </div>
    </div>
  );
}
