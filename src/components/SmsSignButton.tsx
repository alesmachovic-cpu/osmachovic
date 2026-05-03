"use client";

import { useState } from "react";

/**
 * Reusable tlačidlo "Podpis cez SMS" pre náber/objednávku.
 * Otvorí modal kde maklér zadá telefón klienta → POST /api/sign/request
 * → ak SMS funguje, klient dostane link na podpis cez SMS
 * → ak SMS nedostupné, maklér uvidí OTP ktoré zadiktuje klientovi po telefóne
 */

export default function SmsSignButton({
  entityType,
  entityId,
  defaultPhone,
  userId,
  onSigned,
  buttonStyle,
  buttonLabel = "📱 Podpis cez SMS",
}: {
  entityType: "naber" | "objednavka";
  entityId: string;
  defaultPhone?: string;
  userId?: string;
  onSigned?: () => void;
  buttonStyle?: React.CSSProperties;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ link: string; manual: boolean; otp?: string; expires_at: string } | null>(null);
  const [polling, setPolling] = useState(false);

  async function handleSend() {
    setError(""); setLoading(true);
    try {
      const r = await fetch("/api/sign/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, telefon: phone, user_id: userId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || `HTTP ${r.status}`); setLoading(false); return; }
      setResult(d);
      setLoading(false);
      // Začni poll na podpísanie (každých 5s, max 15 min)
      pollSigned(d.link);
    } catch (e) {
      setError((e as Error).message); setLoading(false);
    }
  }

  function pollSigned(_link: string) {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 180; // 15 min × 60 / 5
    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) { setPolling(false); return; }
      try {
        // Skontroluj či sa entita podpísala (cez sub-endpoint)
        const check = await fetch(`/api/sign/status?entity_type=${entityType}&entity_id=${entityId}`);
        if (check.ok) {
          const cd = await check.json();
          if (cd.signed) {
            setPolling(false);
            setOpen(false);
            onSigned?.();
            return;
          }
        }
      } catch { /* ignore */ }
      setTimeout(poll, 5000);
    };
    setTimeout(poll, 5000);
  }

  function copyLink() {
    if (!result?.link) return;
    navigator.clipboard.writeText(result.link);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); setResult(null); }}
        style={buttonStyle || {
          padding: "9px 16px", borderRadius: "10px",
          background: "#1d4ed8", color: "#fff", border: "none",
          fontSize: "13px", fontWeight: 700, cursor: "pointer",
        }}>{buttonLabel}</button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 20px", zIndex: 2000,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)", borderRadius: "16px", padding: "24px",
            maxWidth: "480px", width: "100%",
            boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                📱 Podpis cez SMS
              </div>
              <button onClick={() => setOpen(false)} style={{
                width: "28px", height: "28px", borderRadius: "50%", border: "none",
                background: "var(--bg-elevated)", cursor: "pointer", color: "var(--text-muted)",
              }}>✕</button>
            </div>

            {!result && (
              <>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.5 }}>
                  Zadaj telefón klienta. Pošleme mu SMS s linkom na podpis a 6-cifrovým overovacím kódom (platí 15 min).
                </p>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+421 905 123 456"
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: "10px",
                    border: "1px solid var(--border)", background: "var(--bg-elevated)",
                    color: "var(--text-primary)", fontSize: "14px", outline: "none",
                  }}
                />
                {error && (
                  <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "8px",
                    background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "12px" }}>
                    {error}
                  </div>
                )}
                <button
                  onClick={handleSend}
                  disabled={loading || !phone.trim()}
                  style={{
                    width: "100%", marginTop: "14px", padding: "12px 16px", borderRadius: "10px",
                    background: "var(--text-primary)", color: "var(--bg-surface)",
                    border: "none", fontSize: "13px", fontWeight: 700,
                    cursor: (loading || !phone.trim()) ? "default" : "pointer",
                    opacity: (loading || !phone.trim()) ? 0.5 : 1,
                  }}>
                  {loading ? "Odosielam..." : "📤 Poslať SMS"}
                </button>
              </>
            )}

            {result && !result.manual && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{
                  padding: "14px", borderRadius: "10px",
                  background: "#dcfce7", border: "1px solid #86efac", color: "#15803d",
                  fontSize: "13px", fontWeight: 600,
                }}>
                  ✓ SMS odoslaná na {phone}
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  Klient otvorí link v SMS, zadá kód a podpíše. Tu uvidíš keď bude hotovo
                  {polling && " (kontrolujem každých 5s...)"}.
                </p>
                <button onClick={copyLink} style={{
                  padding: "10px 14px", borderRadius: "8px",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                }}>
                  📋 Skopírovať link (pre prípad že SMS neprišla)
                </button>
              </div>
            )}

            {result && result.manual && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{
                  padding: "14px", borderRadius: "10px",
                  background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e",
                  fontSize: "13px",
                }}>
                  ⚠️ SMS provider nie je nakonfigurovaný — pošli klientovi tieto údaje cez WhatsApp / volaním:
                </div>
                <div style={{
                  padding: "14px 16px", borderRadius: "10px",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>Link</div>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)", wordBreak: "break-all", marginBottom: "12px" }}>
                    {result.link}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>Kód</div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.3em", fontFamily: "monospace" }}>
                    {result.otp}
                  </div>
                </div>
                <button onClick={copyLink} style={{
                  padding: "10px 14px", borderRadius: "8px",
                  background: "var(--text-primary)", color: "var(--bg-surface)",
                  border: "none", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                }}>📋 Skopírovať link</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
