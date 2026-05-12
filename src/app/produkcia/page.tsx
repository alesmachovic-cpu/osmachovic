"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { STAV_LABELS, STAV_COLORS } from "@/lib/produkcia/mapping";

type ProdukciaObjednavka = {
  id: string;
  stav: string;
  typ: string;
  snapshot_meno?: string | null;
  snapshot_telefon?: string | null;
  snapshot_lokalita?: string | null;
  makler_id: string;
  scheduled_date?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  details: Record<string, unknown>;
  deliverable_url?: string | null;
};

const TYP_ICON: Record<string, string> = {
  foto_video: "📸", homestaging: "🏠", certifikat: "📄",
};
const TYP_LABEL: Record<string, string> = {
  foto_video: "Foto-video", homestaging: "Homestaging", certifikat: "Certifikát",
};

const STAV_FILTER_OPTIONS = [
  { value: "all",         label: "Všetky" },
  { value: "submitted",   label: "Odoslané" },
  { value: "scheduled",   label: "Naplánované" },
  { value: "in_progress", label: "Prebieha" },
  { value: "completed",   label: "Dokončené" },
  { value: "draft",       label: "Koncepty" },
  { value: "cancelled",   label: "Zrušené" },
];

export default function ProdukciaPrehladPage() {
  const { user } = useAuth();
  const isAdmin = (user as { role?: string } | null)?.role === "super_admin";
  const router = useRouter();

  const [orders, setOrders] = useState<ProdukciaObjednavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [stavFilter, setStavFilter] = useState("all");
  const [detail, setDetail] = useState<ProdukciaObjednavka | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deliverableInput, setDeliverableInput] = useState("");

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/produkcia-objednavky");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStav(id: string, stav: string) {
    setUpdatingId(id);
    await fetch(`/api/produkcia-objednavky/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stav }),
    });
    await load();
    if (detail?.id === id) setDetail(d => d ? { ...d, stav } : null);
    setUpdatingId(null);
  }

  async function saveDeliverable(id: string) {
    await fetch(`/api/produkcia-objednavky/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliverable_url: deliverableInput, stav: "completed" }),
    });
    await load();
    setDetail(d => d ? { ...d, deliverable_url: deliverableInput, stav: "completed" } : null);
    setDeliverableInput("");
  }

  const filtered = orders.filter(o =>
    stavFilter === "all" ? o.stav !== "cancelled" : o.stav === stavFilter,
  );

  const countByStav = (stav: string) => orders.filter(o => o.stav === stav).length;

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-default)", padding: "0" }}>
      {/* Header */}
      <div style={{
        background: "var(--bg-surface)", borderBottom: "1px solid var(--border)",
        padding: "16px 20px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>📸 Produkcia</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Prehľad produkčných objednávok</div>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "7px 14px", borderRadius: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "13px", cursor: "pointer" }}
          >
            ← Späť
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "20px 16px" }}>

        {/* Sumáre */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
          {[
            { label: "Odoslané", stav: "submitted",   color: "#2563eb" },
            { label: "Naplánované", stav: "scheduled", color: "#7c3aed" },
            { label: "Prebieha", stav: "in_progress",  color: "#d97706" },
            { label: "Dokončené", stav: "completed",   color: "#16a34a" },
          ].map(s => (
            <div key={s.stav}
              onClick={() => setStavFilter(f => f === s.stav ? "all" : s.stav)}
              style={{
                padding: "14px", borderRadius: "12px",
                background: stavFilter === s.stav ? s.color + "18" : "var(--bg-surface)",
                border: `1.5px solid ${stavFilter === s.stav ? s.color : "var(--border)"}`,
                cursor: "pointer", textAlign: "center",
              }}
            >
              <div style={{ fontSize: "22px", fontWeight: 700, color: s.color }}>{countByStav(s.stav)}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
          {STAV_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStavFilter(opt.value)}
              style={{
                padding: "6px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: 500,
                border: `1.5px solid ${stavFilter === opt.value ? "#2563eb" : "var(--border)"}`,
                background: stavFilter === opt.value ? "#dbeafe" : "var(--bg-surface)",
                color: stavFilter === opt.value ? "#1d4ed8" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {opt.label}
              {opt.value !== "all" && countByStav(opt.value) > 0 && (
                <span style={{ marginLeft: "5px", fontSize: "11px", opacity: 0.7 }}>({countByStav(opt.value)})</span>
              )}
            </button>
          ))}
        </div>

        {/* Zoznam */}
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>📭</div>
            Žiadne objednávky v tomto filtri
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(o => {
              const services = (o.details.services as string[] | undefined) ?? [];
              return (
                <div
                  key={o.id}
                  onClick={() => { setDetail(o); setDeliverableInput(o.deliverable_url ?? ""); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px", borderRadius: "12px",
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "10px",
                    background: "#eff6ff", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "22px", flexShrink: 0,
                  }}>
                    {TYP_ICON[o.typ] ?? "📦"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {o.snapshot_meno ?? "—"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {o.snapshot_lokalita ?? "—"} · {TYP_LABEL[o.typ]} · {services.join(", ")}
                    </div>
                    {o.scheduled_date && (
                      <div style={{ fontSize: "12px", color: "#7c3aed", marginTop: "2px" }}>
                        📅 {new Date(o.scheduled_date).toLocaleDateString("sk", { day: "numeric", month: "long" })}
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: "3px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                    background: STAV_COLORS[o.stav] + "22", color: STAV_COLORS[o.stav],
                    flexShrink: 0,
                  }}>
                    {STAV_LABELS[o.stav] ?? o.stav}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(o.created_at).toLocaleDateString("sk")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)", borderRadius: "20px 20px 0 0",
              width: "100%", maxWidth: "600px", padding: "20px 20px 36px",
              maxHeight: "85vh", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <div style={{ fontSize: "17px", fontWeight: 700 }}>{TYP_ICON[detail.typ]} {TYP_LABEL[detail.typ]}</div>
              <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--text-muted)" }}>×</button>
            </div>

            <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: STAV_COLORS[detail.stav] + "22", color: STAV_COLORS[detail.stav], marginBottom: "16px" }}>
              {STAV_LABELS[detail.stav]}
            </div>

            {[
              ["Klient", detail.snapshot_meno ?? "—"],
              ["Telefón", detail.snapshot_telefon ?? "—"],
              ["Lokalita", detail.snapshot_lokalita ?? "—"],
              ["Typ nehnuteľnosti", (detail.details.property_type_mapped as string) ?? "—"],
              ["Región", (detail.details.region as string) ?? "—"],
              ["Služby", (detail.details.services as string[] | undefined)?.join(", ") ?? "—"],
              ["Preferované dni", (detail.details.preferred_days as string[] | undefined)?.join(", ") ?? "—"],
              ["Preferovaný čas", (detail.details.preferred_time as string) ?? "—"],
              ["Na mieste", (detail.details.on_site_person as string) ?? "—"],
              ["AI hlas", detail.details.ai_voice_consent ? "Áno" : "Nie"],
              detail.details.highlights ? ["Špecifiká", detail.details.highlights as string] : null,
              detail.details.notes ? ["Poznámka", detail.details.notes as string] : null,
              ["Vytvorená", new Date(detail.created_at).toLocaleString("sk")],
              detail.submitted_at ? ["Odoslaná", new Date(detail.submitted_at).toLocaleString("sk")] : null,
              detail.scheduled_date ? ["Naplánovaná", new Date(detail.scheduled_date).toLocaleDateString("sk")] : null,
            ].filter(Boolean).map(([label, value]) => (
              <div key={label as string} style={{ display: "flex", gap: "12px", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "14px" }}>
                <span style={{ color: "var(--text-muted)", minWidth: "130px" }}>{label}</span>
                <span>{value}</span>
              </div>
            ))}

            {/* Zmena stavu — len pre admin */}
            {isAdmin && detail.stav !== "cancelled" && detail.stav !== "completed" && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Zmena stavu</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(["submitted", "scheduled", "in_progress", "completed"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => updateStav(detail.id, s)}
                      disabled={detail.stav === s || !!updatingId}
                      style={{
                        padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                        border: `1.5px solid ${STAV_COLORS[s]}`,
                        background: detail.stav === s ? STAV_COLORS[s] + "22" : "var(--bg-surface)",
                        color: STAV_COLORS[s],
                        cursor: detail.stav === s ? "default" : "pointer",
                        opacity: updatingId ? 0.6 : 1,
                      }}
                    >
                      {STAV_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Výstupy link */}
            {isAdmin && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>Link na výstupy (Drive)</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={deliverableInput}
                    onChange={e => setDeliverableInput(e.target.value)}
                    placeholder="https://drive.google.com/…"
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: "8px", fontSize: "13px",
                      border: "1px solid var(--border)", background: "var(--bg-elevated)",
                      color: "var(--text-primary)", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => saveDeliverable(detail.id)}
                    disabled={!deliverableInput.trim()}
                    style={{
                      padding: "9px 16px", borderRadius: "8px", background: "#16a34a", color: "#fff",
                      border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                      opacity: deliverableInput.trim() ? 1 : 0.5,
                    }}
                  >
                    Uložiť
                  </button>
                </div>
                {detail.deliverable_url && (
                  <a href={detail.deliverable_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "#2563eb", marginTop: "4px", display: "block" }}>
                    🔗 Otvoriť výstupy
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
