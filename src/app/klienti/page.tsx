"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Klient } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";
import { useAuth } from "@/components/AuthProvider";
import { getMaklerUuid } from "@/lib/maklerMap";

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
  const { user, accounts } = useAuth();
  const isAdmin = user?.id === "ales";
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingKlient, setEditingKlient] = useState<Klient | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("");
  const [filterTyp, setFilterTyp] = useState<FilterTyp>("");
  const [filterMakler, setFilterMakler] = useState<string>("mine"); // default: my clients
  const [makleri, setMakleri] = useState<{ id: string; meno: string }[]>([]);
  const [myMaklerUuid, setMyMaklerUuid] = useState<string | null>(null);
  // Status change modal state
  const [statusModal, setStatusModal] = useState<{ klient: Klient; status: string } | null>(null);
  const [statusDatum, setStatusDatum] = useState("");
  const [statusMiesto, setStatusMiesto] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  async function fetchKlienti() {
    setLoading(true);

    // Get my makler UUID
    const uuid = user?.id ? await getMaklerUuid(user.id) : null;
    setMyMaklerUuid(uuid);

    // Everyone loads ALL clients — filtering is done client-side
    const { data } = await supabase.from("klienti").select("*").order("created_at", { ascending: false });
    setKlienti((data as Klient[]) ?? []);
    setLoading(false);
  }

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchKlienti();
    // Load makleri list for all users (for filter dropdown)
    supabase.from("makleri").select("id, meno").eq("aktivny", true).then(r => setMakleri(r.data ?? []));
  }, []);

  // Auto-open edit modal from query param (?edit=ID)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && klienti.length > 0) {
      const k = klienti.find(c => c.id === editId);
      if (k) { setEditingKlient(k); setModal(true); }
    }
  }, [searchParams, klienti]);

  const filtered = klienti.filter(k => {
    // Makler filter
    if (filterMakler === "mine" && myMaklerUuid && k.makler_id !== myMaklerUuid) return false;
    if (filterMakler !== "all" && filterMakler !== "mine" && k.makler_id !== filterMakler) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${k.meno} ${k.email || ""} ${k.telefon || ""} ${k.lokalita || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filterStatus && k.status !== filterStatus) return false;
    if (filterTyp && k.typ !== filterTyp) return false;
    return true;
  });

  // Counts based on filtered list (respects makler filter)
  const counts = {
    total: filtered.length,
    novy: filtered.filter(k => k.status === "novy" || k.status === "novy_kontakt").length,
    aktivny: filtered.filter(k => k.status === "aktivny" || k.status === "dohodnuty_naber").length,
    cakajuci: filtered.filter(k => k.status === "caka_na_schvalenie").length,
  };

  // Status change handler — opens modal for dohodnuty_naber / volat_neskor
  function handleStatusChange(k: Klient, newStatus: string) {
    if (newStatus === "dohodnuty_naber" || newStatus === "volat_neskor") {
      setStatusMiesto(k.lokalita || "");
      setStatusDatum("");
      setStatusModal({ klient: k, status: newStatus });
      return;
    }
    // nabrany can't be set manually
    if (newStatus === "nabrany") return;
    // Direct update for other statuses
    supabase.from("klienti").update({ status: newStatus }).eq("id", k.id).then(() => fetchKlienti());
  }

  // Confirm status change with date/location
  async function handleStatusConfirm() {
    if (!statusModal || !statusDatum) return;
    setStatusSaving(true);
    const { klient: k, status: newStatus } = statusModal;
    const isVolat = newStatus === "volat_neskor";
    const durationMs = isVolat ? 15 * 60000 : 60 * 60000; // 15min vs 1h

    // Update status + datum
    const updates: Record<string, unknown> = { status: newStatus };
    if (!isVolat) updates.datum_naberu = new Date(statusDatum).toISOString();
    await supabase.from("klienti").update(updates).eq("id", k.id);

    // Create calendar event
    if (user?.id) {
      try {
        const startDt = new Date(statusDatum).toISOString();
        const endDt = new Date(new Date(statusDatum).getTime() + durationMs).toISOString();
        const summary = isVolat ? `Zavolať — ${k.meno}` : `Náber — ${k.meno}`;
        const res = await fetch("/api/google/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            summary,
            start: startDt,
            end: endDt,
            description: [
              !isVolat && statusMiesto && `Adresa: ${statusMiesto}`,
              k.telefon && `Tel: ${k.telefon}`,
              k.email && `Email: ${k.email}`,
            ].filter(Boolean).join("\n"),
            location: isVolat ? "" : statusMiesto,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.event?.id) {
            await supabase.from("klienti").update({ calendar_event_id: data.event.id }).eq("id", k.id);
          }
        }
      } catch { /* calendar fails silently */ }
    }

    setStatusSaving(false);
    setStatusModal(null);
    setStatusDatum("");
    setStatusMiesto("");
    fetchKlienti();
  }

  // Assign makler to klient (admin only)
  async function assignMakler(klientId: string, newMaklerId: string) {
    await supabase.from("klienti").update({ makler_id: newMaklerId }).eq("id", klientId);
    fetchKlienti();
  }

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
            {filtered.length} klientov
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
        {makleri.length > 0 && (
          <select value={filterMakler} onChange={e => setFilterMakler(e.target.value)} style={selectSt}>
            <option value="mine">Moji klienti</option>
            <option value="all">Všetci</option>
            {makleri.map(m => (
              <option key={m.id} value={m.id}>{m.meno}</option>
            ))}
          </select>
        )}
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
          <div className="table-header" style={{ display: "grid", gridTemplateColumns: isAdmin ? "2fr 1fr 120px 130px 140px 60px" : "2fr 1fr 1fr 120px 130px 60px", padding: "12px 20px", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <span>Klient</span>
            <span>Kontakt</span>
            {!isAdmin && <span>Rozpočet</span>}
            <span>Typ</span>
            <span>Status</span>
            {isAdmin && <span>Makler</span>}
            <span></span>
          </div>
          {filtered.map((k, i) => {
            const sc = statusColors[k.status] ?? statusColors.novy;
            const nameParts = (k.meno || "").split(" ");
            const initials = `${(nameParts[0] || "")[0] || ""}${(nameParts[1] || "")[0] || ""}`.toUpperCase();
            const isInactive = k.status === "caka_na_schvalenie";
            const canEdit = isAdmin || (myMaklerUuid && k.makler_id === myMaklerUuid);
            return (
              <div key={k.id} className="table-row" style={{
                display: "grid", gridTemplateColumns: isAdmin ? "2fr 1fr 120px 130px 140px 60px" : "2fr 1fr 1fr 120px 130px 60px",
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
                {/* Rozpočet - only for non-admin */}
                {!isAdmin && (
                  <div className="table-cell-hide" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {"—"}
                  </div>
                )}
                {/* Typ */}
                <div className="table-cell-hide" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  {typLabels[k.typ] || k.typ || "—"}
                </div>
                {/* Status */}
                <div onClick={e => e.stopPropagation()}>
                  <select
                    value={k.status}
                    disabled={!canEdit}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleStatusChange(k, e.target.value);
                    }}
                    style={{
                      fontSize: "11px", padding: "3px 24px 3px 8px", borderRadius: "20px", fontWeight: "600",
                      color: sc.color, background: sc.bg, border: "none", cursor: canEdit ? "pointer" : "default",
                      appearance: "none", outline: "none", opacity: canEdit ? 1 : 0.7,
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
                    }}
                  >
                    {[
                      { value: "aktivny", label: "Aktívny" },
                      { value: "novy_kontakt", label: "Nový kontakt" },
                      { value: "dohodnuty_naber", label: "Dohod. náber" },
                      ...(k.status === "nabrany" ? [{ value: "nabrany", label: "Nabraný" }] : []),
                      { value: "volat_neskor", label: "Volať neskôr" },
                      { value: "nedovolal", label: "Nedovolal" },
                      { value: "nechce_rk", label: "Nechce RK" },
                      { value: "uz_predal", label: "Už predal" },
                      { value: "realitna_kancelaria", label: "Realitná kanc." },
                    ].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {/* Admin: Assign makler */}
                {isAdmin && (
                  <div onClick={e => e.stopPropagation()}>
                    <select
                      value={k.makler_id || ""}
                      onChange={e => assignMakler(k.id, e.target.value)}
                      style={{
                        fontSize: "10px", padding: "3px 20px 3px 6px", borderRadius: "8px", fontWeight: "600",
                        color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                        cursor: "pointer", appearance: "none", outline: "none", maxWidth: "130px",
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                        backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center",
                      }}
                    >
                      <option value="">—</option>
                      {makleri.map(m => <option key={m.id} value={m.id}>{m.meno}</option>)}
                    </select>
                  </div>
                )}
                {/* Upraviť / Schváliť */}
                <div style={{ textAlign: "center", display: "flex", gap: "4px", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
                  {isAdmin && k.status === "caka_na_schvalenie" ? (
                    <>
                      <button onClick={async () => {
                        await supabase.from("klienti").update({ status: "aktivny" }).eq("id", k.id);
                        fetchKlienti();
                      }} style={{
                        padding: "4px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: "700",
                        background: "#D1FAE5", color: "#065F46", border: "none", cursor: "pointer",
                      }}>✓</button>
                      <button onClick={async () => {
                        if (confirm("Odstrániť klienta " + k.meno + "?")) {
                          await supabase.from("klienti").delete().eq("id", k.id);
                          fetchKlienti();
                        }
                      }} style={{
                        padding: "4px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: "700",
                        background: "#FEE2E2", color: "#991B1B", border: "none", cursor: "pointer",
                      }}>✕</button>
                    </>
                  ) : canEdit ? <button onClick={() => { setEditingKlient(k); setModal(true); }} style={{
                    padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600",
                    background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    ✏️
                  </button> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status change modal — date/location picker */}
      {statusModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={() => { setStatusModal(null); setStatusDatum(""); setStatusMiesto(""); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", borderRadius: "20px", padding: "32px", maxWidth: "400px", width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: statusModal.status === "volat_neskor" ? "#FEF3C7" : "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 16px", border: statusModal.status === "volat_neskor" ? "2px solid #FDE68A" : "2px solid #DDD6FE" }}>
              {statusModal.status === "volat_neskor" ? "📞" : "📅"}
            </div>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
              {statusModal.status === "dohodnuty_naber" ? "Kedy a kde bude náber?" : "Kedy zavolať?"}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
              {statusModal.status === "dohodnuty_naber"
                ? <>Termín stretnutia s <strong style={{ color: "var(--text-primary)" }}>{statusModal.klient.meno}</strong> (1 hodina)</>
                : <>Pripomienka na zavolanie <strong style={{ color: "var(--text-primary)" }}>{statusModal.klient.meno}</strong> (15 min)</>
              }
            </p>
            {/* Location — only for dohodnuty_naber */}
            {statusModal.status === "dohodnuty_naber" && (
              <input
                type="text"
                value={statusMiesto}
                onChange={e => setStatusMiesto(e.target.value)}
                placeholder="Adresa / miesto stretnutia"
                style={{
                  width: "100%", maxWidth: "300px", padding: "12px 16px", marginBottom: "12px",
                  background: "var(--bg-elevated)", border: "2px solid var(--border)",
                  borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)",
                  outline: "none", textAlign: "center",
                }}
              />
            )}
            {/* Date/time */}
            <input
              type="datetime-local"
              value={statusDatum}
              onChange={e => setStatusDatum(e.target.value)}
              style={{
                width: "100%", maxWidth: "300px", padding: "14px 16px",
                background: "var(--bg-elevated)", border: "2px solid var(--border)",
                borderRadius: "12px", fontSize: "15px", color: "var(--text-primary)",
                outline: "none", textAlign: "center",
              }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "24px" }}>
              <button onClick={() => { setStatusModal(null); setStatusDatum(""); setStatusMiesto(""); }} style={{
                padding: "10px 24px", background: "var(--bg-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
              }}>Zrušiť</button>
              <button disabled={!statusDatum || statusSaving} onClick={handleStatusConfirm} style={{
                padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
                borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                opacity: !statusDatum || statusSaving ? 0.5 : 1,
              }}>
                {statusSaving ? "Ukladám..." : statusModal.status === "dohodnuty_naber" ? "Potvrdiť náber" : "Uložiť pripomienku"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && <NewKlientModal open editKlient={editingKlient} showTypKlienta onClose={() => { setModal(false); setEditingKlient(null); }} onSaved={fetchKlienti} />}
    </div>
  );
}
