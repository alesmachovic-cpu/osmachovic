"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type CheckResult = {
  name: string;
  status: "ok" | "warn" | "fail";
  message: string;
  detail?: string;
  ownerName?: string;
  department?: string;
};

type AuditRun = {
  id: string;
  run_at: string;
  source: string;
  counts: { ok: number; warn: number; fail: number };
  results: CheckResult[];
  email_summary?: {
    push?: { sent: boolean; error?: string };
    diffCounts?: { resolved: number; new: number; persistent: number; unchanged_ok: number };
  };
};

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  ok: { bg: "#E2EFDA", border: "#70AD47", text: "#1F5018", icon: "✓" },
  warn: { bg: "#FFF2CC", border: "#FFC000", text: "#7F6000", icon: "⚠" },
  fail: { bg: "#FCE4D6", border: "#C00000", text: "#7F1818", icon: "🚨" },
};

export default function AuditDashboard() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [pushStatus, setPushStatus] = useState<"unknown" | "granted" | "denied" | "subscribing" | "subscribed">("unknown");
  const [pushError, setPushError] = useState("");

  const isAdmin = user?.role === "super_admin" || user?.role === "majitel";

  // Check push permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      // Skontroluj či máme aktívnu subscription
      navigator.serviceWorker?.ready?.then(reg => reg.pushManager.getSubscription()).then(sub => {
        setPushStatus(sub ? "subscribed" : "granted");
      }).catch(() => setPushStatus("granted"));
    } else if (Notification.permission === "denied") {
      setPushStatus("denied");
    }
  }, []);

  async function enablePush() {
    setPushError("");
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushError("Tento prehliadač nepodporuje push notifikácie");
      return;
    }
    setPushStatus("subscribing");
    try {
      // 1) Permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushStatus("denied");
        setPushError("Povolenie zamietnuté. Otvor Nastavenia prehliadača → Notifikácie pre dev.amgd.sk");
        return;
      }

      // 2) Service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // 3) VAPID key z env (musí byť NEXT_PUBLIC_)
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublic) {
        setPushError("NEXT_PUBLIC_VAPID_PUBLIC_KEY chýba v env");
        setPushStatus("granted");
        return;
      }

      // 4) Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
      });

      // 5) Send to backend
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userId: user?.id,
          userAgent: navigator.userAgent,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setPushError(d.error || `HTTP ${r.status}`);
        setPushStatus("granted");
        return;
      }
      setPushStatus("subscribed");
    } catch (e) {
      setPushError(String(e).slice(0, 200));
      setPushStatus("granted");
    }
  }

  function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function loadRuns() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/audit-history", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Načítanie zlyhalo");
        setRuns([]);
      } else {
        setRuns(d.runs || []);
      }
    } catch (e) {
      setError(String(e).slice(0, 200));
    }
    setLoading(false);
  }

  async function runNow() {
    setTriggering(true);
    setError("");
    try {
      // Spusti cron endpoint manuálne
      const r = await fetch("/api/cron/daily-audit", { credentials: "include" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || `HTTP ${r.status}`);
      } else {
        // Reload history
        await loadRuns();
      }
    } catch (e) {
      setError(String(e).slice(0, 200));
    }
    setTriggering(false);
  }

  useEffect(() => {
    if (isAdmin) loadRuns();
    else setLoading(false);
  }, [isAdmin]);

  if (!user) {
    return <div style={{ padding: 24 }}>Prihlás sa.</div>;
  }
  if (!isAdmin) {
    return <div style={{ padding: 24, color: "#C00000" }}>Iba pre admin / majiteľ.</div>;
  }

  const latest = runs[0];
  const previous = runs[1];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1F3864", margin: 0 }}>
            🛡️ Internal Audit Dashboard
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Inspector General (E023 Bc. Mária Hlavatá) — kontrolný orgán
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pushStatus !== "subscribed" && (
            <button
              onClick={enablePush}
              disabled={pushStatus === "subscribing" || pushStatus === "denied"}
              title={pushStatus === "denied" ? "Otvor Nastavenia prehliadača → Notifikácie → povol pre dev.amgd.sk" : ""}
              style={{
                background: pushStatus === "denied" ? "#888" : "#10B981", color: "white", border: "none",
                borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600,
                cursor: pushStatus === "denied" ? "not-allowed" : "pointer",
              }}
            >
              {pushStatus === "subscribing"
                ? "Pripájam…"
                : pushStatus === "denied"
                ? "🔕 Blokované prehliadačom"
                : "🔔 Zapnúť push notifikácie"}
            </button>
          )}
          {pushStatus === "subscribed" && (
            <div style={{ padding: "10px 16px", background: "#E2EFDA", color: "#1F5018", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
              🔔 Push aktívne
            </div>
          )}
          <button
            onClick={runNow}
            disabled={triggering}
            style={{
              background: "#1F3864", color: "white", border: "none",
              borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600,
              cursor: triggering ? "wait" : "pointer", opacity: triggering ? 0.6 : 1,
            }}
          >
            {triggering ? "Spúšťam audit…" : "▶ Spusti audit teraz"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: "#FCE4D6", color: "#7F1818", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {pushError && (
        <div style={{ padding: 12, background: "#FFF2CC", color: "#7F6000", borderRadius: 8, marginBottom: 16 }}>
          🔔 Push: {pushError}
        </div>
      )}

      {loading && <div>Načítavam…</div>}

      {!loading && latest && (
        <>
          {/* Counts summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Card label="OK" value={latest.counts.ok} color={STATUS_COLOR.ok} />
            <Card label="Warning" value={latest.counts.warn} color={STATUS_COLOR.warn} />
            <Card label="Fail" value={latest.counts.fail} color={STATUS_COLOR.fail} />
            {latest.email_summary?.diffCounts && (
              <>
                <Card label="✓ Vyriešené" value={latest.email_summary.diffCounts.resolved} color={STATUS_COLOR.ok} />
                <Card label="🚨 Nový" value={latest.email_summary.diffCounts.new} color={STATUS_COLOR.fail} />
                <Card label="⚠ Pretrváva" value={latest.email_summary.diffCounts.persistent} color={STATUS_COLOR.warn} />
              </>
            )}
          </div>

          {/* Latest run findings */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1F3864", marginBottom: 12 }}>
            Aktuálny stav <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}>
              ({new Date(latest.run_at).toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" })})
            </span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {latest.results.map((r, i) => (
              <FindingCard key={i} finding={r} prevStatus={previous?.results.find(p => p.name === r.name)?.status} />
            ))}
          </div>

          {/* History */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1F3864", marginBottom: 12 }}>
            História (posledných {runs.length} behov)
          </h2>
          <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Kedy</th>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Zdroj</th>
                  <th style={{ textAlign: "center", padding: 8, fontWeight: 600 }}>OK</th>
                  <th style={{ textAlign: "center", padding: 8, fontWeight: 600 }}>⚠</th>
                  <th style={{ textAlign: "center", padding: 8, fontWeight: 600 }}>🚨</th>
                  <th style={{ textAlign: "center", padding: 8, fontWeight: 600 }}>Push</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: 8 }}>
                      {new Date(run.run_at).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td style={{ padding: 8 }}>{run.source}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>{run.counts.ok}</td>
                    <td style={{ padding: 8, textAlign: "center", color: run.counts.warn > 0 ? "#7F6000" : "#888" }}>{run.counts.warn}</td>
                    <td style={{ padding: 8, textAlign: "center", color: run.counts.fail > 0 ? "#C00000" : "#888", fontWeight: run.counts.fail > 0 ? 700 : 400 }}>{run.counts.fail}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>{run.email_summary?.push?.sent ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 24, padding: 12, background: "#F0F0F0", borderRadius: 8, fontSize: 12, color: "#666" }}>
            <strong>Automatický beh:</strong> denne o 02:30 UTC (= 04:30 SK).<br />
            <strong>Push notifikácia:</strong> pri NOVOM fail dostaneš push do prehliadača (žiadne emaily).<br />
            <strong>Detail / lokálny audit:</strong> spusti <code>./scripts/audit-all.sh</code> v repe.
          </div>
        </>
      )}

      {!loading && !latest && (
        <div style={{ padding: 24, background: "var(--bg-elevated)", borderRadius: 8 }}>
          Žiadne audit behy zatial. Klikni "Spusti audit teraz".
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: typeof STATUS_COLOR.ok }) {
  return (
    <div style={{
      background: color.bg, border: `2px solid ${color.border}`, borderRadius: 10,
      padding: "14px 16px", color: color.text,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function FindingCard({ finding, prevStatus }: { finding: CheckResult; prevStatus?: string }) {
  const c = STATUS_COLOR[finding.status];
  const changed = prevStatus && prevStatus !== finding.status;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 16px",
      display: "flex", gap: 14, alignItems: "flex-start",
    }}>
      <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{c.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, color: c.text }}>{finding.name}</div>
          {changed && (
            <div style={{ fontSize: 11, padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: 12, color: "#666" }}>
              zmena: {prevStatus} → {finding.status}
            </div>
          )}
        </div>
        <div style={{ marginTop: 4, color: c.text }}>{finding.message}</div>
        {finding.detail && (
          <div style={{ marginTop: 4, fontSize: 12, color: c.text, opacity: 0.85, fontStyle: "italic" }}>{finding.detail}</div>
        )}
        {finding.ownerName && (
          <div style={{ marginTop: 8, fontSize: 12, color: c.text, opacity: 0.85 }}>
            <strong>Owner:</strong> {finding.ownerName}
            {finding.department && <> · <span>{finding.department}</span></>}
          </div>
        )}
      </div>
    </div>
  );
}
