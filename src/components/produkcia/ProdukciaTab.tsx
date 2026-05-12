"use client";

import { useState, useEffect, useCallback } from "react";
import NovaObjednavkaModal from "./NovaObjednavkaModal";
import { STAV_LABELS, STAV_COLORS } from "@/lib/produkcia/mapping";

interface KlientData {
  id: string;
  meno: string;
  telefon?: string | null;
  lokalita?: string | null;
  typ_nehnutelnosti?: string | null;
}

interface MaklerData {
  id: string;
  name: string;
}

interface Props {
  klient: KlientData;
  makler: MaklerData;
}

type ProdukciaObjednavka = {
  id: string;
  stav: string;
  typ: string;
  snapshot_lokalita?: string | null;
  scheduled_date?: string | null;
  submitted_at?: string | null;
  created_at: string;
  details: Record<string, unknown>;
  deliverable_url?: string | null;
};

const TYP_ICON: Record<string, string> = {
  foto_video:  "📸",
  homestaging: "🏠",
  certifikat:  "📄",
};
const TYP_LABEL: Record<string, string> = {
  foto_video:  "Foto-video",
  homestaging: "Homestaging",
  certifikat:  "Certifikát",
};

export default function ProdukciaTab({ klient, makler }: Props) {
  const [objednavky, setObjednavky] = useState<ProdukciaObjednavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState<ProdukciaObjednavka | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/produkcia-objednavky?klient_id=${klient.id}`);
      const data = await res.json();
      setObjednavky(Array.isArray(data) ? data : []);
    } catch {
      setObjednavky([]);
    } finally {
      setLoading(false);
    }
  }, [klient.id]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id: string) {
    if (!confirm("Zrušiť túto objednávku?")) return;
    await fetch(`/api/produkcia-objednavky/${id}`, { method: "DELETE" });
    load();
    setDetail(null);
  }

  const visible = objednavky.filter(o => o.stav !== "cancelled");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
          📸 Produkcia
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "7px 14px", background: "#2563eb", color: "#fff",
            border: "none", borderRadius: "8px", fontSize: "13px",
            fontWeight: 600, cursor: "pointer",
          }}
        >
          + Nová objednávka
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
          Načítavam…
        </div>
      ) : visible.length === 0 ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          color: "var(--text-muted)", fontSize: "14px",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📷</div>
          Zatiaľ žiadne produkčné objednávky
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {visible.map(o => {
            const services = (o.details.services as string[] | undefined) ?? [];
            return (
              <div
                key={o.id}
                onClick={() => setDetail(o)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px", borderRadius: "10px",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  background: "#eff6ff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "20px", flexShrink: 0,
                }}>
                  {TYP_ICON[o.typ] ?? "📦"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {TYP_LABEL[o.typ] ?? o.typ}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {services.length > 0 ? services.join(", ") : "—"}
                    {o.scheduled_date && ` · 📅 ${new Date(o.scheduled_date).toLocaleDateString("sk")}`}
                  </div>
                </div>
                <div style={{
                  padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                  background: STAV_COLORS[o.stav] + "22",
                  color: STAV_COLORS[o.stav],
                  flexShrink: 0,
                }}>
                  {STAV_LABELS[o.stav] ?? o.stav}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)", borderRadius: "20px 20px 0 0",
              width: "100%", maxWidth: "600px", padding: "20px 20px 32px",
              maxHeight: "80vh", overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700 }}>
                {TYP_ICON[detail.typ]} {TYP_LABEL[detail.typ] ?? detail.typ}
              </div>
              <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--text-muted)" }}>×</button>
            </div>

            <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: STAV_COLORS[detail.stav] + "22", color: STAV_COLORS[detail.stav], marginBottom: "16px" }}>
              {STAV_LABELS[detail.stav] ?? detail.stav}
            </div>

            {/* Detail rows */}
            {[
              ["Klient", klient.meno],
              ["Lokalita", detail.snapshot_lokalita ?? klient.lokalita ?? "—"],
              ["Služby", (detail.details.services as string[] | undefined)?.join(", ") ?? "—"],
              ["Preferované dni", (detail.details.preferred_days as string[] | undefined)?.join(", ") ?? "—"],
              ["Preferovaný čas", (detail.details.preferred_time as string | undefined) ?? "—"],
              ["Na mieste", (detail.details.on_site_person as string | undefined) ?? "—"],
              ["AI hlas", detail.details.ai_voice_consent ? "Áno" : "Nie"],
              detail.details.highlights ? ["Špecifiká", detail.details.highlights as string] : null,
              detail.details.notes ? ["Poznámka", detail.details.notes as string] : null,
              ["Vytvorená", new Date(detail.created_at).toLocaleString("sk")],
              detail.submitted_at ? ["Odoslaná", new Date(detail.submitted_at).toLocaleString("sk")] : null,
              detail.scheduled_date ? ["Naplánovaná", new Date(detail.scheduled_date).toLocaleDateString("sk")] : null,
              detail.deliverable_url ? ["Výstupy", detail.deliverable_url] : null,
            ].filter(Boolean).map(([label, value]) => (
              <div key={label as string} style={{ display: "flex", gap: "12px", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "14px" }}>
                <span style={{ color: "var(--text-muted)", minWidth: "120px" }}>{label}</span>
                <span style={{ color: "var(--text-primary)", wordBreak: "break-all" }}>{value}</span>
              </div>
            ))}

            {(detail.stav === "draft" || detail.stav === "submitted") && (
              <button
                onClick={() => handleCancel(detail.id)}
                style={{
                  marginTop: "20px", width: "100%", padding: "11px",
                  borderRadius: "10px", border: "1px solid #fecaca",
                  background: "#fef2f2", color: "#dc2626",
                  fontSize: "14px", fontWeight: 600, cursor: "pointer",
                }}
              >
                Zrušiť objednávku
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal nová objednávka */}
      {showModal && (
        <NovaObjednavkaModal
          klient={klient}
          makler={makler}
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </>
  );
}
