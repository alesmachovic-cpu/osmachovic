"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

interface Email {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  read: boolean;
}

function parseFromField(from: string) {
  const match = from.match(/^"?(.+?)"?\s*<(.+?)>$/);
  if (match) return { name: match[1], email: match[2] };
  return { name: from, email: from };
}

export default function GmailPage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Check Google connection
    fetch(`/api/auth/google/status?userId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        setGoogleEmail(d.email || "");
        if (d.connected) loadEmails();
        else setLoading(false);
      })
      .catch(() => { setConnected(false); setLoading(false); });
  }, [user?.id]);

  async function loadEmails() {
    try {
      const res = await fetch(`/api/google/gmail?userId=${user!.id}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEmails(data.emails || []);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    if (!user?.id) return;
    window.location.href = `/api/auth/google?userId=${user.id}`;
  }

  const unreadCount = emails.filter(e => !e.read).length;

  // Loading
  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>Gmail</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 32px" }}>Načítavam...</p>
      </div>
    );
  }

  // Not connected
  if (!connected) {
    return (
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>Gmail</h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 32px" }}>Prepoj svoj Google účet pre zobrazenie emailov</p>

        <div style={{
          maxWidth: "440px", margin: "0 auto", padding: "40px",
          background: "var(--bg-surface)", borderRadius: "16px",
          border: "1px solid var(--border)", textAlign: "center",
        }}>
          <div style={{ marginBottom: "16px" }}>
            <svg width="48" height="48" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 8px" }}>
            Pripoj Google účet
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 24px" }}>
            Prihlás sa cez Google a uvidíš tu svoje emaily
          </p>
          <button onClick={handleConnect} style={{
            padding: "12px 32px", background: "#fff", color: "#374151",
            border: "1px solid #D1D5DB", borderRadius: "10px",
            fontSize: "14px", fontWeight: "600", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Prihlásiť sa cez Google
          </button>
        </div>
      </div>
    );
  }

  // Connected - show real emails
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>Gmail</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            {googleEmail} &middot; {unreadCount > 0 ? `${unreadCount} neprečítaných` : "Všetky prečítané"}
          </p>
        </div>
        <button onClick={loadEmails} style={{
          padding: "8px 16px", background: "var(--bg-surface)",
          border: "1px solid var(--border)", borderRadius: "8px",
          fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer",
        }}>
          Obnoviť
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Celkom", value: emails.length },
          { label: "Neprečítané", value: unreadCount },
          { label: "Dnes", value: emails.filter(e => {
            try { return new Date(e.date).toDateString() === new Date().toDateString(); } catch { return false; }
          }).length },
        ].map(s => (
          <div key={s.label} style={{
            padding: "16px", background: "var(--bg-surface)",
            borderRadius: "12px", border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>{s.label}</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#374151" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Email list */}
      {emails.length === 0 ? (
        <div style={{
          padding: "40px", textAlign: "center", background: "var(--bg-surface)",
          borderRadius: "14px", border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Žiadne emaily</div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
          {emails.map((email, i) => {
            const { name, email: addr } = parseFromField(email.from);
            const initials = name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            let dateStr = "";
            try {
              const d = new Date(email.date);
              dateStr = d.toLocaleDateString("sk", { day: "numeric", month: "short" }) + " " +
                d.toLocaleTimeString("sk", { hour: "2-digit", minute: "2-digit" });
            } catch { dateStr = email.date; }

            return (
              <div key={email.id}>
                <div
                  onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                  style={{
                    padding: "14px 20px",
                    borderBottom: i < emails.length - 1 && expandedId !== email.id ? "1px solid var(--border)" : "none",
                    cursor: "pointer",
                    background: !email.read ? "rgba(55, 65, 81, 0.03)" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                  onMouseLeave={e => e.currentTarget.style.background = !email.read ? "rgba(55, 65, 81, 0.03)" : "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: !email.read ? "#374151" : "transparent", flexShrink: 0,
                    }} />
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: "#374151", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: "700", color: "#fff", flexShrink: 0,
                    }}>{initials || "?"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <span style={{ fontSize: "13px", fontWeight: !email.read ? "700" : "600", color: "var(--text-primary)" }}>
                          {name}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0, marginLeft: "12px" }}>
                          {dateStr}
                        </span>
                      </div>
                      <div style={{
                        fontSize: "13px", fontWeight: !email.read ? "600" : "400",
                        color: "var(--text-primary)", whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis",
                      }}>{email.subject}</div>
                      <div style={{
                        fontSize: "12px", color: "var(--text-muted)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px",
                      }}>{email.snippet}</div>
                    </div>
                  </div>
                </div>

                {expandedId === email.id && (
                  <div style={{ padding: "0 20px 16px 76px", borderBottom: i < emails.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{
                      padding: "16px", background: "var(--bg-elevated)", borderRadius: "10px",
                      fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6",
                      marginBottom: "12px",
                    }}>
                      {email.snippet}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <a href={`mailto:${addr}?subject=Re: ${encodeURIComponent(email.subject)}`} style={{
                        padding: "8px 16px", background: "#374151", color: "#fff",
                        borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px",
                      }}>Odpovedať</a>
                      <a href={`https://mail.google.com/mail/u/0/#inbox/${email.threadId}`} target="_blank" rel="noopener" style={{
                        padding: "8px 16px", background: "var(--bg-surface)",
                        border: "1px solid var(--border)", color: "var(--text-secondary)",
                        borderRadius: "8px", fontSize: "12px", fontWeight: "600",
                        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px",
                      }}>Otvoriť v Gmail</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
