"use client";

import { useEffect, useState } from "react";

export default function PreCallBriefModal({
  inzeratId, sourceUrl, onClose,
}: {
  inzeratId: string;
  sourceUrl?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brief, setBrief] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const r = await fetch("/api/pre-call-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inzerat_id: inzeratId }),
        });
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) { setError(body.error || `HTTP ${r.status}`); setLoading(false); return; }
        setBrief(body.brief || "");
        setAiUsed(!!body.ai_used);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message); setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inzeratId]);

  function copy() {
    if (!brief) return;
    navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 20px", overflowY: "auto", zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "16px",
        maxWidth: "640px", width: "100%", maxHeight: "calc(100vh - 80px)",
        overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              📞 Pre-call brief
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Krátky brief čo povedať predajcovi
            </div>
          </div>
          <button onClick={onClose} style={{
            width: "32px", height: "32px", borderRadius: "50%", border: "none",
            background: "var(--bg-elevated)", cursor: "pointer", fontSize: "14px",
            color: "var(--text-muted)",
          }}>✕</button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontSize: "26px", marginBottom: "10px" }}>📊</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Analyzujem inzerát + trh...
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 14px", borderRadius: "10px", background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {!loading && brief && (
            <>
              <div style={{
                background: "var(--bg-elevated)", borderRadius: "12px",
                padding: "18px 20px", border: "1px solid var(--border)",
                fontSize: "13px", lineHeight: "1.7", whiteSpace: "pre-wrap",
                color: "var(--text-primary)",
              }}>
                {brief}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={copy} style={{
                  flex: 1, padding: "11px 16px", borderRadius: "10px",
                  background: copied ? "#15803d" : "var(--text-primary)",
                  color: copied ? "#fff" : "var(--bg-surface)",
                  border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                }}>{copied ? "✓ Skopírované" : "📋 Skopírovať"}</button>
                {sourceUrl && (
                  <a href={sourceUrl} target="_blank" rel="noreferrer" style={{
                    padding: "11px 16px", borderRadius: "10px",
                    background: "var(--bg-elevated)", color: "var(--text-primary)",
                    border: "1px solid var(--border)", fontSize: "13px", fontWeight: 600,
                    textDecoration: "none", display: "flex", alignItems: "center", gap: "6px",
                  }}>🔗 Otvoriť inzerát</a>
                )}
              </div>

              <div style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "right" }}>
                {aiUsed ? "Brief generovaný cez Claude (~0.01 €)" : "Brief generovaný lokálne (AI nedostupné)"}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
