"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/lib/database.types";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { getMaklerUuid } from "@/lib/maklerMap";

interface KlientVolny {
  id: string;
  meno: string;
  telefon: string;
  email: string;
  lokalita: string;
  typ: string;
  status: string;
  volny_dovod: string | null;
  volny_at: string;
  datum_naberu: string | null;
  poznamka: string | null;
  makler_id: string | null;
}

const FILTERS = [
  { value: "all", label: "Všetci voľní" },
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

export default function VolniKlientiPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [klienti, setKlienti] = useState<KlientVolny[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [maklerFilter, setMaklerFilter] = useState<string>("all");      // pôvodný maklér (makler_id)
  const [lokalitaFilter, setLokalitaFilter] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [myMaklerUuid, setMyMaklerUuid] = useState<string | null>(null);
  const [makleri, setMakleri] = useState<Array<{ id: string; meno: string }>>([]);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (user?.id) getMaklerUuid(user.id).then(setMyMaklerUuid);
    fetch("/api/makleri").then(r => r.json()).then(data => setMakleri(data || []));
  }, [user?.id]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/volni-klienti?filter=${filter}`);
    const d = await res.json();
    setKlienti(d.klienti || []);
    setTotal(d.total || 0);
  }, [filter]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const runCron = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/cron/volni-klienti?key=__internal__");
      const d = await res.json();
      if (res.ok) {
        showToast(d.message || "SLA spustená");
        await load();
      } else showToast(d.error || "Chyba", "error");
    } finally {
      setRunning(false);
    }
  };

  const vratit = async (klient_id: string, meno: string) => {
    if (!confirm(`Vrátiť klienta ${meno} späť ako "Nový" pôvodnému makléron?`)) return;
    const res = await fetch("/api/volni-klienti", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vratit", klient_id, by_user_id: user?.id }),
    });
    const d = await res.json();
    if (res.ok) { showToast(d.message || "Klient vrátený"); await load(); }
    else showToast(d.error || "Chyba", "error");
  };

  const prebrat = async (klient_id: string, meno: string) => {
    if (!myMaklerUuid) { showToast("Nie si zaregistrovaný ako maklér", "error"); return; }
    if (!confirm(`Prebrať klienta ${meno}? Stane sa tvojím a začne plynúť 24h SLA.`)) return;
    const res = await fetch("/api/volni-klienti", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prebrat", klient_id, makler_id: myMaklerUuid, by_user_id: user?.id }),
    });
    const d = await res.json();
    if (res.ok) { showToast(`Klient ${meno} je teraz tvoj`); await load(); }
    else showToast(d.error || "Chyba", "error");
  };

  // Unique lokality — pre filter dropdown
  const uniqueLokality = useMemo(() => {
    const set = new Set<string>();
    for (const k of klienti) {
      if (k.lokalita) set.add(k.lokalita);
    }
    return Array.from(set).sort();
  }, [klienti]);

  const filtered = klienti.filter((k) => {
    if (search) {
      const q = search.toLowerCase();
      const match = (k.meno || "").toLowerCase().includes(q)
        || (k.telefon || "").toLowerCase().includes(q)
        || (k.lokalita || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (maklerFilter !== "all") {
      if (maklerFilter === "none" && k.makler_id) return false;
      if (maklerFilter !== "none" && k.makler_id !== maklerFilter) return false;
    }
    if (lokalitaFilter !== "all" && k.lokalita !== lokalitaFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--text-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Načítavam voľných klientov...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {toast && (
        <div style={{
          position: "fixed", top: "16px", right: "16px", zIndex: 100,
          background: toast.type === "error" ? "var(--danger)" : "var(--text-primary)",
          color: "#fff", padding: "12px 18px", borderRadius: "var(--radius-md)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          fontSize: "13px", fontWeight: 500,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: toast.type === "error" ? "#fca5a5" : "var(--success)" }} />
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>Voľní klienti</h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Klienti ktorých si môže prevziať akýkoľvek maklér z kancelárie. Po prebratí sa štartuje 24h SLA.
          </p>
        </div>
        <button
          onClick={runCron}
          disabled={running}
          style={{
            height: "38px", padding: "0 18px",
            background: running ? "var(--text-muted)" : "var(--text-primary)",
            color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
            fontSize: "14px", fontWeight: 600, cursor: running ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          {running ? "Spúšťam..." : "Spustiť SLA cron"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
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
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Detailné filtre — pôvodný maklér + lokalita */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <select value={maklerFilter} onChange={e => setMaklerFilter(e.target.value)} style={{
          height: "34px", padding: "0 12px", borderRadius: "var(--radius-sm)",
          background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
          fontSize: "13px", color: "var(--text-secondary)",
        }}>
          <option value="all">Pôvodný maklér: Všetci</option>
          <option value="none">Bez prideleného makléra</option>
          {makleri.map(m => (
            <option key={m.id} value={m.id}>{m.meno}</option>
          ))}
        </select>
        <select value={lokalitaFilter} onChange={e => setLokalitaFilter(e.target.value)} style={{
          height: "34px", padding: "0 12px", borderRadius: "var(--radius-sm)",
          background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
          fontSize: "13px", color: "var(--text-secondary)",
        }}>
          <option value="all">Lokalita: Všetky</option>
          {uniqueLokality.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {(maklerFilter !== "all" || lokalitaFilter !== "all" || search) && (
          <button
            onClick={() => { setMaklerFilter("all"); setLokalitaFilter("all"); setSearch(""); }}
            style={{
              height: "34px", padding: "0 12px", borderRadius: "var(--radius-sm)",
              background: "transparent", border: "1px solid var(--border-subtle)",
              fontSize: "12px", color: "var(--text-muted)", cursor: "pointer",
            }}
          >Zrušiť filtre</button>
        )}
      </div>

      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
        {filtered.length === total ? `${total} klientov` : `${filtered.length} z ${total}`}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "80px 32px", textAlign: "center" }}>
          <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>
            {total === 0 ? "Žiadni voľní klienti" : "Nič nenájdené"}
          </h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
            {total === 0
              ? "Klienti po vypršaní SLA sa tu automaticky objavia."
              : "Skús zmeniť filter alebo vyhľadávanie."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((k) => {
            const isMine = k.makler_id && k.makler_id === myMaklerUuid;
            return (
              <div key={k.id} style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)", padding: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => router.push(`/klienti/${k.id}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                        {k.meno || "Bez mena"}
                      </h3>
                      {k.typ && (
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "var(--bg-hover)", color: "var(--text-secondary)", fontWeight: 500 }}>
                          {typLabels[k.typ] || k.typ}
                        </span>
                      )}
                      {k.volny_dovod && (
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "6px", background: "var(--warning-light)", color: "var(--warning)", fontWeight: 500 }}>
                          {STATUS_LABELS[k.volny_dovod as keyof typeof STATUS_LABELS] || k.volny_dovod}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
                      {k.telefon && <span>📞 {k.telefon}</span>}
                      {k.email && <span>✉️ {k.email}</span>}
                      {k.lokalita && <span>📍 {k.lokalita}</span>}
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                      Uvoľnený {timeAgo(k.volny_at)}
                      {k.datum_naberu && <> · pôvodný termín: {formatDate(k.datum_naberu)}</>}
                    </div>
                    {(() => {
                      // Vyčistíme historické "Adresa: . ." / prázdne "Typ:" riadky
                      // a slugy nehnuteľnosti zmeníme na ľudské názvy.
                      const TYP_HUMAN: Record<string, string> = {
                        "1-izbovy-byt": "1-izbový byt", "2-izbovy-byt": "2-izbový byt",
                        "3-izbovy-byt": "3-izbový byt", "4-izbovy-byt": "4-izbový byt",
                        "5-izbovy-byt": "5-izbový byt", "garsonka": "garsónka",
                        "rodinny-dom": "rodinný dom", "rodinny_dom": "rodinný dom",
                        "vila": "vila", "chata": "chata", "pozemok": "pozemok",
                        "kancelaria": "kancelária", "garaz": "garáž",
                      };
                      const cleaned = (k.poznamka || "")
                        .split("\n")
                        .map(line => {
                          // Adresa cleanup
                          const addrM = line.match(/^Adresa:\s*(.+)$/i);
                          if (addrM) {
                            const parts = addrM[1].split(/[,·]/)
                              .map(p => p.trim())
                              .filter(p => p && p !== "." && p !== "..");
                            return parts.length > 0 ? `Adresa: ${parts.join(", ")}` : "";
                          }
                          // Typ slug → human label
                          const typM = line.match(/^Typ(?:\s+nehnute(?:ľ|l)nosti)?:\s*(.+)$/i);
                          if (typM) {
                            const slug = typM[1].trim().toLowerCase();
                            if (!slug || slug === "." || slug === "..") return "";
                            const human = TYP_HUMAN[slug] || typM[1].trim();
                            return `Typ: ${human}`;
                          }
                          return line.trim();
                        })
                        .filter(Boolean)
                        .join(" · ");
                      return cleaned ? (
                        <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                          &quot;{cleaned}&quot;
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    {!isMine && (
                      <button
                        onClick={() => prebrat(k.id, k.meno)}
                        style={{
                          height: "34px", padding: "0 14px",
                          background: "var(--text-primary)", color: "#fff",
                          border: "none", borderRadius: "var(--radius-sm)",
                          fontSize: "13px", fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        + Prebrať klienta
                      </button>
                    )}
                    <button
                      onClick={() => vratit(k.id, k.meno)}
                      style={{
                        height: "34px", padding: "0 14px",
                        background: "var(--success-light)", color: "var(--success)",
                        border: "none", borderRadius: "var(--radius-sm)",
                        fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      }}
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
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
