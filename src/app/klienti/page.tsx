"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Klient } from "@/lib/database.types";
import { STATUS_LABELS } from "@/lib/database.types";
import NewKlientModal from "@/components/NewKlientModal";

const statusColors: Record<string, { color: string; bg: string }> = {
  novy_kontakt:      { color: "#1D4ED8", bg: "#DBEAFE" },
  dohodnuty_naber:   { color: "#065F46", bg: "#D1FAE5" },
  volat_neskor:      { color: "#92400E", bg: "#FEF3C7" },
  nedovolal:         { color: "#6B7280", bg: "#F3F4F6" },
  nechce_rk:         { color: "#991B1B", bg: "#FEE2E2" },
  uz_predal:         { color: "#5B21B6", bg: "#EDE9FE" },
  realna_kancelaria: { color: "#065F46", bg: "#D1FAE5" },
};

export default function KlientiPage() {
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function fetchKlienti() {
    setLoading(true);
    const { data } = await supabase
      .from("klienti")
      .select("*")
      .order("created_at", { ascending: false });
    setKlienti(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchKlienti(); }, []);

  return (
    <div style={{ maxWidth: "1050px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 3px", color: "var(--text-primary)" }}>Klienti</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            {klienti.length} klientov v databáze
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13.5px", fontWeight: "600", cursor: "pointer" }}
        >
          + Nový klient
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1.5fr 1.3fr 1.3fr 1.2fr", padding: "11px 20px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)", fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Meno</span><span>Telefón</span><span>Status</span><span>Lokalita</span><span>Pridaný</span><span>Typ</span>
        </div>

        {loading && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Načítavam...</div>
        )}
        {!loading && klienti.length === 0 && (
          <div style={{ padding: "50px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>👥</div>
            Žiadni klienti. Klikni na <strong>+ Nový klient</strong>.
          </div>
        )}

        {klienti.map((k, i) => {
          const sc = statusColors[k.status] ?? statusColors.novy_kontakt;
          return (
            <div
              key={k.id}
              style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1.5fr 1.3fr 1.3fr 1.2fr", padding: "13px 20px", alignItems: "center", borderBottom: i < klienti.length - 1 ? "1px solid var(--border-subtle)" : "none", fontSize: "13.5px" }}
            >
              <div>
                <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{k.meno}</div>
                {k.poznamka && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>{k.poznamka}</div>}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{k.mobil ?? "—"}</div>
              <div>
                <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "600", color: sc.color, background: sc.bg }}>
                  {STATUS_LABELS[k.status] ?? k.status}
                </span>
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{k.lokalita ?? "—"}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>{new Date(k.created_at).toLocaleDateString("sk")}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "13px", textTransform: "capitalize" }}>{k.typ ?? "—"}</div>
            </div>
          );
        })}
      </div>

      {modal && (
        <NewKlientModal
          onClose={() => setModal(false)}
          onSaved={fetchKlienti}
        />
      )}
    </div>
  );
}
