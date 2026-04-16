"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/lib/database.types";

interface KlientOdklik {
  id: string;
  meno: string;
  telefon: string;
  email: string;
  lokalita: string;
  typ: string;
  status: string;
  odklik_from_status: string | null;
  odklik_at: string;
  datum_naberu: string | null;
  poznamka: string | null;
}

const FILTERS = [
  { value: "all", label: "Všetci v Odkliku" },
  { value: "predal", label: "Už predali" },
  { value: "rk", label: "Realitné kancelárie" },
];

const typLabels: Record<string, string> = {
  kupujuci: "Kupujúci",
  predavajuci: "Predávajúci",
  oboje: "Kupujúci + Predávajúci",
};

const formatDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
const timeAgo = (iso: string) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "pred chvíľou";
  if (hours < 24) return `pred ${hours} h`;
  const days = Math.floor(hours / 24);
  return `pred ${days} ${days === 1 ? "dňom" : "dňami"}`;
};

export default function OdklikPage() {
  const router = useRouter();
  const [klienti, setKlienti] = useState<KlientOdklik[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/odklik?filter=${filter}`);
    const d = await res.json();
    setKlienti(d.klienti || []);
    setTotal(d.total || 0);
  }, [filter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const runOdklik = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/cron/odklik?key=__internal__");
      const d = await res.json();
      if (res.ok) {
        showToast(d.message || "Presun dokončený");
        await load();
      } else {
        showToast(d.error || "Chyba", "error");
      }
    } finally {
      setRunning(false);
    }
  };

  const vratit = async (klient_id: string, meno: string) => {
    if (!confirm(`Vrátiť klienta ${meno} späť ako "Nový"?`)) return;
    const res = await fetch("/api/odklik", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vratit", klient_id }),
    });
    const d = await res.json();
    if (res.ok) {
      showToast(d.message || "Klient vrátený");
      await load();
    } else {
      showToast(d.error || "Chyba", "error");
    }
  };

  const filtered = klienti.filter((k) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (k.meno || "").toLowerCase().includes(q) ||
      (k.telefon || "").toLowerCase().includes(q) ||
      (k.lokalita || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--text-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Načítavam Odklik...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "16px", right: "16px", zIndex: 100,
          background: toast.type === "error" ? "var(--danger)" : "var(--text-primary)",
          color: "#fff", padding: "12px 18px", borderRadius: "var(--radius-md)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          fontSize: "13px", fontWeight: 500, animation: "slideIn 0.25s ease",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: toast.type === "error" ? "#fca5a5" : "var(--success)" }} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>Odklik</h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Klienti automaticky presunutí po 24h bez akcie
          </p>
        </div>
        <button
          onClick={runOdklik}
          disabled={running}
          style={{
            height: "38px", padding: "0 18px",
            background: running ? "var(--text-muted)" : "var(--text-primary)",
            color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
            fontSize: "14px", fontWeight: 600, cursor: running ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          {running ? (
            <>
              <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
              Spúšťam...
            </>
          ) : "Spustiť presun"}
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: "320px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "14px" }}>🔍</span>
          <input
            type="text"
            placeholder="Hľadať meno, telefón, lokalitu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", height: "38px", paddingLeft: "38px", paddingRight: "12px", background: "var(--bg-base)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "14px", outline: "none" }}
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              height: "38px", padding: "0 16px", borderRadius: "var(--radius-sm)",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
              background: filter === f.value ? "var(--text-primary)" : "var(--bg-base)",
              color: filter === f.value ? "#fff" : "var(--text-secondary)",
              border: "1px solid " + (filter === f.value ? "var(--text-primary)" : "var(--border-subtle)"),
              transition: "all 0.15s",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
        {filtered.length === total ? `${total} klientov` : `${filtered.length} z ${total}`}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "80px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
          <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>
            {total === 0 ? "Odklik je prázdny" : "Nič nenájdené"}
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, maxWidth: "400px" }}>
            {total === 0
              ? "Klienti ktorí nemajú aktualizovaný status po 24h sa tu automaticky objavia."
              : "Skús zmeniť filter alebo vyhľadávanie."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((k) => (
            <div
              key={k.id}
              style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)", padding: "16px",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div
                  style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                  onClick={() => router.push(`/klienti/${k.id}`)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                      {k.meno || "Bez mena"}
                    </h3>
                    {k.typ && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "var(--bg-hover)", color: "var(--text-secondary)", fontWeight: 500 }}>
                        {typLabels[k.typ] || k.typ}
                      </span>
                    )}
                    {k.odklik_from_status && (
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "var(--warning-light)", color: "var(--warning)", fontWeight: 500 }}>
                        pôvodne: {STATUS_LABELS[k.odklik_from_status as keyof typeof STATUS_LABELS] || k.odklik_from_status}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
                    {k.telefon && <span>📞 {k.telefon}</span>}
                    {k.email && <span>✉️ {k.email}</span>}
                    {k.lokalita && <span>📍 {k.lokalita}</span>}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                    Presunutý {timeAgo(k.odklik_at)}
                    {k.datum_naberu && <> · pôvodný termín: {formatDate(k.datum_naberu)}</>}
                  </div>
                  {k.poznamka && (
                    <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                      &quot;{k.poznamka}&quot;
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => vratit(k.id, k.meno)}
                    style={{
                      height: "34px", padding: "0 14px",
                      background: "var(--success-light)", color: "var(--success)",
                      border: "none", borderRadius: "var(--radius-sm)",
                      fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--success)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--success-light)"; (e.currentTarget as HTMLElement).style.color = "var(--success)"; }}
                  >
                    ↩ Vrátiť späť
                  </button>
                  <button
                    onClick={() => router.push(`/klienti/${k.id}`)}
                    style={{
                      height: "34px", padding: "0 14px",
                      background: "var(--bg-base)", color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
                      fontSize: "13px", fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    Otvoriť
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
