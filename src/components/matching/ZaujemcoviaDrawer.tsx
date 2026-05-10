"use client";

import { useRouter } from "next/navigation";
import { useZaujemcoviaPreNehnutelnost } from "@/hooks/useMatching";
import type { ZaujemcaItem } from "@/hooks/useMatching";

type Props = {
  nehnutelnostId: string;
  nehnutelnostNazov?: string;
  onClose: () => void;
};

function scoreColors(score: number) {
  if (score >= 80) return { dot: "🟢", border: "#10B981", bg: "#F0FDF4", text: "#065F46" };
  if (score >= 50) return { dot: "🟡", border: "#F59E0B", bg: "#FFFBEB", text: "#92400E" };
  return { dot: "⚪", border: "#E5E7EB", bg: "#F9FAFB", text: "#374151" };
}

export function ZaujemcoviaDrawer({ nehnutelnostId, nehnutelnostNazov, onClose }: Props) {
  const router = useRouter();
  const { data, loading } = useZaujemcoviaPreNehnutelnost(nehnutelnostId);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)" }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: "min(440px, 95vw)",
        background: "var(--bg-surface)", borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        boxShadow: "-12px 0 40px rgba(0,0,0,0.12)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
              👥 Záujemcovia
            </div>
            {nehnutelnostNazov && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{nehnutelnostNazov}</div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: "18px", cursor: "pointer",
            color: "var(--text-muted)", padding: "0 4px", lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Hľadám záujemcov...
            </div>
          )}
          {!loading && (!data || data.length === 0) && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.5 }}>
              Žiadni záujemcovia. Počkaj na nové objednávky alebo skontroluj parametre inzerátu.
            </div>
          )}
          {!loading && data && data.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.map((z: ZaujemcaItem) => {
                const o = z.objednavka;
                const c = scoreColors(z.score);
                const kupujuci = o.kupujuci;
                return (
                  <li key={o.id} style={{
                    border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.border}`,
                    borderRadius: "10px", padding: "12px 14px",
                    background: c.bg,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: c.text, minWidth: "52px" }}>
                        {c.dot} {z.score}%
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "2px" }}>
                          {kupujuci?.meno || "Neznámy kupujúci"}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {[
                            o.druh ? (Array.isArray(o.druh) ? o.druh.join(", ") : o.druh) : null,
                            o.cena_do ? `do ${o.cena_do.toLocaleString("sk")} €` : null,
                          ].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                        {kupujuci?.telefon && (
                          <a href={`tel:${kupujuci.telefon}`} onClick={e => e.stopPropagation()} style={{
                            padding: "5px 9px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                            borderRadius: "7px", fontSize: "12px", textDecoration: "none", color: "var(--text-primary)",
                          }}>📞</a>
                        )}
                        <button onClick={() => router.push(`/klienti/${o.klient_id}`)} style={{
                          padding: "5px 9px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                          borderRadius: "7px", fontSize: "12px", cursor: "pointer", color: "#3B82F6",
                        }}>→</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => router.push(`/nastroje?tab=matching&nehnutelnost=${nehnutelnostId}`)}
            style={{
              width: "100%", padding: "10px", fontSize: "13px", fontWeight: "600",
              background: "#374151", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer",
            }}
          >
            Plný matching →
          </button>
        </div>
      </div>
    </>
  );
}
