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

export default function KupujuciPage() {
  const [klienti, setKlienti] = useState<Klient[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function fetchKlienti() {
    setLoading(true);
    const { data } = await supabase
      .from("klienti")
      .select("*")
      .in("status", ["novy_kontakt", "dohodnuty_naber", "volat_neskor"])
      .order("created_at", { ascending: false });
    setKlienti(data ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchKlienti(); }, []);

  return (
    <div style={{ maxWidth: "1050px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 3px", color: "var(--text-primary)" }}>Kupujúci</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>Aktívni záujemcovia o kúpu — {klienti.length} kontaktov</p>
        </div>
        <button onClick={() => setModal(true)}
          style={{ padding: "9px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13.5px", fontWeight: "600", cursor: "pointer" }}>
          + Nový kupujúci
        </button>
      </div>

      {/* Cards grid */}
      {loading && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Načítavam...</div>}
      {!loading && klienti.length === 0 && (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>🔍</div>
          Žiadni aktívni kupujúci.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
        {klienti.map(k => {
          const sc = statusColors[k.status] ?? statusColors.novy_kontakt;
          return (
            <div key={k.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px" }}>
              {/* Avatar + Meno */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "var(--accent-light)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "13px", color: "var(--accent)", flexShrink: 0 }}>
                  {k.meno.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.meno}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{k.mobil ?? "—"}</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                {k.typ && (
                  <div style={{ display: "flex", gap: "6px", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-muted)", minWidth: "70px" }}>Typ:</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: "500", textTransform: "capitalize" }}>{k.typ}</span>
                  </div>
                )}
                {k.lokalita && (
                  <div style={{ display: "flex", gap: "6px", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-muted)", minWidth: "70px" }}>Lokalita:</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{k.lokalita}</span>
                  </div>
                )}
                {(k.rozpocet_min || k.rozpocet_max) && (
                  <div style={{ display: "flex", gap: "6px", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-muted)", minWidth: "70px" }}>Rozpočet:</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>
                      {k.rozpocet_min ? `${k.rozpocet_min.toLocaleString("sk")} €` : "?"} — {k.rozpocet_max ? `${k.rozpocet_max.toLocaleString("sk")} €` : "?"}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "600", color: sc.color, background: sc.bg }}>
                  {STATUS_LABELS[k.status]}
                </span>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {new Date(k.created_at).toLocaleDateString("sk")}
                </span>
              </div>

              {k.poznamka && (
                <div style={{ marginTop: "10px", padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: "7px", fontSize: "12px", color: "var(--text-secondary)", borderLeft: "3px solid var(--border)" }}>
                  {k.poznamka}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && <NewKlientModal onClose={() => setModal(false)} onSaved={fetchKlienti} />}
    </div>
  );
}
