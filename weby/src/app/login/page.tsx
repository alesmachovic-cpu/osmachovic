"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Prihlásenie zlyhalo"); return; }
      window.location.href = "/admin";
    } catch { setErr("Chyba siete"); } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 28 }}>
        <div style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600 }}>Vianema</div>
        <h1 style={{ fontSize: 22, margin: "6px 0 18px", fontWeight: 600 }}>Správa webu</h1>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>E‑mail</label>
        <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, margin: "12px 0 4px" }}>Heslo</label>
        <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} />
        {err && <div style={{ color: "var(--warn)", fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ marginTop: 18, width: "100%", padding: "11px 14px", borderRadius: 10, border: 0, background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{busy ? "Prihlasujem…" : "Prihlásiť sa"}</button>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, marginBottom: 0 }}>Heslo ti nastaví alebo zmení správca webov.</p>
      </form>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1.5px solid var(--line)", borderRadius: 10, background: "var(--bg)", color: "var(--ink)" };
