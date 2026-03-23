"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Klient } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";

const statusColors: Record<string, { color: string; bg: string }> = {
  novy:                { color: "#374151", bg: "#F3F4F6" },
  novy_kontakt:        { color: "#374151", bg: "#F3F4F6" },
  aktivny:             { color: "#374151", bg: "#E5E7EB" },
  dohodnuty_naber:     { color: "#374151", bg: "#E5E7EB" },
  pasivny:             { color: "#6B7280", bg: "#F3F4F6" },
  volat_neskor:        { color: "#6B7280", bg: "#F3F4F6" },
  nedovolal:           { color: "#9CA3AF", bg: "#F9FAFB" },
  nechce_rk:           { color: "#6B7280", bg: "#F3F4F6" },
  uz_predal:           { color: "#6B7280", bg: "#F3F4F6" },
  realitna_kancelaria: { color: "#6B7280", bg: "#F3F4F6" },
  uzavrety:            { color: "#9CA3AF", bg: "#F9FAFB" },
  caka_na_schvalenie:  { color: "#9CA3AF", bg: "#F9FAFB" },
};

const typLabels: Record<string, string> = {
  kupujuci: "Kupujúci",
  predavajuci: "Predávajúci",
  oboje: "Kupujúci + Predávajúci",
};

type FilterStatus = "" | "novy" | "aktivny" | "pasivny" | "uzavrety" | "caka_na_schvalenie";
type FilterTyp = "" | "kupujuci" | "predavajuci" | "oboje";

export default function KlientiPage() {
  return <Suspense><KlientiContent /></Suspense>;
}

function KlientiContent() {
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingKlient, setEditingKlient] = useState<Klient | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("");
  const [filterTyp, setFilterTyp] = useState<FilterTyp>("");

  async function fetchKlienti() {
    setLoading(true);
    const { data } = await supabase
      .from("klienti")
      .select("*")
      .order("created_at", { ascending: false });
    setKlienti((data as Klient[]) ?? []);
    setLoading(false);
  }

  const searchParams = useSearchParams();

  useEffect(() => { fetchKlienti(); }, []);

  // Auto-open edit modal from query param (?edit=ID)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && klienti.length > 0) {
      const k = klienti.find(c => c.id === editId);
      if (k) { setEditingKlient(k); setModal(true); }
    }
  }, [searchParams, klienti]);

  const filtered = klienti.filter(k => {
    if (search) {
      const q = search.toLowerCase();
      const hay = `${k.meno} ${k.email || ""} ${k.telefon || ""} ${k.lokalita || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterStatus && k.status !== filterStatus) return false;
    if (filterTyp && k.typ !== filterTyp) return false;
    return true;
  });

  const counts = {
    total: klienti.length,
    novy: klienti.filter(k => k.status === "novy" || k.status === "novy_kontakt").length,
    aktivny: klienti.filter(k => k.status === "aktivny" || k.status === "dohodnuty_naber").length,
    cakajuci: klienti.filter(k => k.status === "caka_na_schvalenie").length,
  };

  const selectSt: React.CSSProperties = {
    padding: "9px 30px 9px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", cursor: "pointer", outline: "none",
    appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Klienti</h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            {filtered.length} z {counts.total} klientov
          </p>
        </div>
        <button onClick={() => { setEditingKlient(null); setModal(true); }} style={{
          padding: "10px 20px", background: "#374151", color: "#fff", borderRadius: "10px",
          fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "6px",
        }}>+ Nový klient</button>
      </div>

      {/* Stat cards */}
      <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Celkom", value: counts.total, color: "#374151" },
          { label: "Noví", value: counts.novy, color: "#374151" },
          { label: "Aktívni", value: counts.aktivny, color: "#374151" },
          { label: "Čaká na schválenie", value: counts.cakajuci, color: "#6B7280" },
        ].map(s => (
          <div key={s.label} style={{ padding: "16px", background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>{s.label}</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "360px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "var(--text-muted)", pointerEvents: "none" }}>&#x1F50D;</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Hľadať meno, email, telefón..."
            style={{ width: "100%", padding: "9px 14px 9px 36px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", color: "var(--text-primary)", outline: "none" }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)} style={selectSt}>
          <option value="">Všetky statusy</option>
          <option value="novy">Nový</option>
          <option value="aktivny">Aktívny</option>
          <option value="pasivny">Pasívny</option>
          <option value="uzavrety">Uzavretý</option>
          <option value="caka_na_schvalenie">Čaká na schválenie</option>
        </select>
        <select value={filterTyp} onChange={e => setFilterTyp(e.target.value as FilterTyp)} style={selectSt}>
          <option value="">Všetky typy</option>
          <option value="kupujuci">Kupujúci</option>
          <option value="predavajuci">Predávajúci</option>
          <option value="oboje">Oboje</option>
        </select>
      </div>

      {/* Loading */}
      {loading && <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>Načítavam...</div>}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "var(--bg-surface)", borderRadius: "16px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>👥</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
            {search || filterStatus || filterTyp ? "Žiadne výsledky" : "Zatiaľ žiadni klienti"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            {search || filterStatus || filterTyp ? "Skús zmeniť filtre" : "Pridaj prvého klienta"}
          </div>
          {!search && !filterStatus && !filterTyp && (
            <button onClick={() => setModal(true)} style={{ display: "inline-flex", padding: "10px 24px", background: "#374151", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "600", border: "none", cursor: "pointer" }}>+ Nový klient</button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div style={{ background: "var(--bg-surface)", borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden" }}>
          <div className="table-header" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 100px", padding: "12px 20px", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Klient</span>
            <span>Kontakt</span>
            <span>Rozpočet</span>
            <span>Typ</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>
          {filtered.map((k, i) => {
            const sc = statusColors[k.status] ?? statusColors.novy;
            const nameParts = (k.meno || "").split(" ");
            const initials = `${(nameParts[0] || "")[0] || ""}${(nameParts[1] || "")[0] || ""}`.toUpperCase();
            const isInactive = k.status === "caka_na_schvalenie";
            return (
              <div key={k.id} className="table-row" style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 100px",
                padding: "14px 20px", alignItems: "center",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                fontSize: "13px", cursor: "pointer", transition: "background 0.1s",
                opacity: isInactive ? 0.5 : 1,
                background: isInactive ? "#F9FAFB" : "transparent",
              }}
                onClick={() => { window.location.href = `/klienti/${k.id}`; }}
                onMouseEnter={e => (e.currentTarget.style.background = isInactive ? "#F3F4F6" : "var(--bg-elevated)")}
                onMouseLeave={e => (e.currentTarget.style.background = isInactive ? "#F9FAFB" : "transparent")}>
                {/* Klient */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: isInactive ? "#D1D5DB" : "#374151",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: "700", color: "#fff", flexShrink: 0,
                  }}>{initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: "600", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {k.meno}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {k.lokalita || "—"} · {new Date(k.created_at).toLocaleDateString("sk")}
                    </div>
                  </div>
                </div>
                {/* Kontakt */}
                <div className="table-cell-hide" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {k.telefon || "—"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {k.email || "—"}
                  </div>
                </div>
                {/* Rozpočet */}
                <div className="table-cell-hide" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {"—"}
                </div>
                {/* Typ */}
                <div className="table-cell-hide" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {typLabels[k.typ] || k.typ || "—"}
                </div>
                {/* Status */}
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    fontSize: "11px", padding: "3px 10px", borderRadius: "20px", fontWeight: "600",
                    color: sc.color, background: sc.bg,
                  }}>
                    {STATUS_LABELS[k.status] || k.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <NewKlientModal open editKlient={editingKlient} showTypKlienta onClose={() => { setModal(false); setEditingKlient(null); }} onSaved={fetchKlienti} />}
    </div>
  );
}
