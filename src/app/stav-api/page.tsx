"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type ApiStatus = "ok" | "credit_low" | "error" | "no_key";
type ApiStatuses = { anthropic: ApiStatus; gemini: ApiStatus; openai: ApiStatus };

const API_CACHE_KEY = "vianema_api_status";
const API_CACHE_TTL = 30 * 60 * 1000; // 30 min

const API_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
  openai: "OpenAI (GPT)",
};
const STATUS_LABEL: Record<ApiStatus, string> = {
  ok: "OK",
  credit_low: "Nízke kredity",
  error: "Chyba",
  no_key: "Chýba kľúč",
};
const STATUS_COLOR: Record<ApiStatus, { bg: string; color: string }> = {
  ok:         { bg: "#ECFDF5", color: "#10B981" },
  credit_low: { bg: "#FEF3C7", color: "#F59E0B" },
  error:      { bg: "#FEE2E2", color: "#DC2626" },
  no_key:     { bg: "#F3F4F6", color: "#6B7280" },
};

const API_DESCRIPTIONS: Record<string, string> = {
  anthropic: "Claude pre AI Writer, AI Analyze, AI Fill (Anthropic API)",
  gemini: "Gemini pre parse-doc (DOCX/PDF extrakcia)",
  openai: "GPT (záložný model) — momentálne nepoužívaný",
};

/**
 * Stav API — admin/manager only. Presunuté zo zvončeka v navbare do
 * samostatnej stránky aby zvonček mohol byť plne dedikovaný notifikáciám.
 */
export default function StavApiPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<ApiStatuses | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Admin gate
  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "manager") {
      router.replace("/");
    }
  }, [user, router]);

  const fetchStatus = async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(API_CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < API_CACHE_TTL) {
            setStatuses(data);
            setLastChecked(new Date(ts));
            setLoading(false);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    try {
      const res = await fetch("/api/api-status");
      const data: ApiStatuses = await res.json();
      setStatuses(data);
      const ts = Date.now();
      setLastChecked(new Date(ts));
      localStorage.setItem(API_CACHE_KEY, JSON.stringify({ data, ts }));
    } catch (e) {
      console.error("[stav-api] fetch failed:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
        Nemáš oprávnenie zobraziť túto stránku.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Stav API
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Stav externých služieb (AI modely) ktoré CRM používa
            {lastChecked && <> · skontrolované {lastChecked.toLocaleTimeString("sk", { hour: "2-digit", minute: "2-digit" })}</>}
          </p>
        </div>
        <button onClick={() => fetchStatus(true)} disabled={loading} style={{
          height: "36px", padding: "0 16px", background: "#374151",
          color: "#fff", border: "none", borderRadius: "8px",
          fontSize: "13px", fontWeight: 600, cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}>{loading ? "Kontrolujem..." : "Skontrolovať znova"}</button>
      </div>

      {loading && !statuses ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Načítavam...
        </div>
      ) : statuses && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(Object.entries(statuses) as [keyof ApiStatuses, ApiStatus][]).map(([key, status]) => {
            const cfg = STATUS_COLOR[status];
            return (
              <div key={key} style={{
                padding: "16px 18px", background: "var(--bg-surface)",
                border: "1px solid var(--border)", borderRadius: "12px",
                display: "flex", alignItems: "center", gap: "16px",
              }}>
                <div style={{
                  width: "12px", height: "12px", borderRadius: "50%",
                  background: cfg.color, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {API_LABELS[key]}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {API_DESCRIPTIONS[key]}
                  </div>
                </div>
                <div style={{
                  padding: "6px 12px", borderRadius: "8px",
                  background: cfg.bg, color: cfg.color,
                  fontSize: "12px", fontWeight: 700,
                }}>{STATUS_LABEL[status]}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: "20px", padding: "14px 16px",
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: "10px", fontSize: "12px", color: "var(--text-secondary)",
      }}>
        <strong style={{ color: "var(--text-primary)" }}>Tipy:</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: "20px", lineHeight: 1.6 }}>
          <li><strong>OK</strong> — služba beží a je dostatok kreditov</li>
          <li><strong>Nízke kredity</strong> — funkcia môže prestať fungovať čoskoro</li>
          <li><strong>Chyba</strong> — služba teraz nedostupná (napr. rate limit)</li>
          <li><strong>Chýba kľúč</strong> — API key nie je nastavený v .env (admin)</li>
        </ul>
      </div>
    </div>
  );
}
