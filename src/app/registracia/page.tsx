"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegistraciaPage() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { user?: unknown; error?: string };
      if (!res.ok) {
        setError(data.error || "Registrácia zlyhala");
        setSubmitting(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Chyba siete");
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
        backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.12)",
        padding: "36px 32px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Vianema CRM
          </div>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: "8px 0 0" }}>
            Registrácia novej realitnej kancelárie
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px", padding: "12px 14px",
            fontSize: "13px", color: "#FCA5A5", marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[
            { key: "companyName" as const, label: "Názov kancelárie", placeholder: "napr. Reality Novák s.r.o.", type: "text", autoComplete: "organization" },
            { key: "name" as const, label: "Vaše meno", placeholder: "Ján Novák", type: "text", autoComplete: "name" },
            { key: "email" as const, label: "Email", placeholder: "jan.novak@firma.sk", type: "email", autoComplete: "email" },
            { key: "password" as const, label: "Heslo (min. 8 znakov)", placeholder: "••••••••", type: "password", autoComplete: "new-password" },
          ].map(({ key, label, placeholder, type, autoComplete }) => (
            <div key={key}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
              </label>
              <input
                type={type}
                autoComplete={autoComplete}
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                required
                disabled={submitting}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />
            </div>
          ))}

          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, margin: "4px 0 0" }}>
            Registráciou súhlasíte s{" "}
            <Link href="/obchodne-podmienky" target="_blank" style={{ color: "rgba(255,255,255,0.65)", textDecoration: "underline" }}>
              Obchodnými podmienkami
            </Link>{" "}
            a{" "}
            <Link href="/gdpr" target="_blank" style={{ color: "rgba(255,255,255,0.65)", textDecoration: "underline" }}>
              Zásadami ochrany osobných údajov
            </Link>.
            Máte právo odstúpiť od zmluvy do 30 dní (zákon č. 108/2024 Z. z.).
          </p>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "13px", borderRadius: "12px",
              background: submitting ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.15)",
              color: "#fff", border: "1px solid rgba(255,255,255,0.2)",
              fontSize: "14px", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
              marginTop: "4px",
            }}
          >
            {submitting ? "Registrujem..." : "Vytvoriť kanceláriu"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
          Máte účet?{" "}
          <Link href="/" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline" }}>
            Prihláste sa
          </Link>
        </p>

        <p style={{ textAlign: "center", marginTop: "14px", fontSize: "11px", color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
          14 dní zadarmo · Platba cez Stripe · Zrušenie kedykoľvek
        </p>
      </div>
    </div>
  );
}
