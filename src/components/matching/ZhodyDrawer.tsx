"use client";

import { useRouter } from "next/navigation";
import { useZhodyPreObjednavku } from "@/hooks/useMatching";
import type { ZhodaItem } from "@/hooks/useMatching";

type Props = {
  objednavkaId: string;
  onClose: () => void;
  onPlanovatObhliadku?: (nehnutelnostId: string) => void;
};

function scoreStyle(score: number) {
  if (score >= 80) return { color: "#065F46", bg: "#F0FDF4", dot: "🟢" };
  if (score >= 50) return { color: "#92400E", bg: "#FFFBEB", dot: "🟡" };
  return { color: "#374151", bg: "#F9FAFB", dot: "⚪" };
}

export function ZhodyDrawer({ objednavkaId, onClose, onPlanovatObhliadku }: Props) {
  const router = useRouter();
  const { data, loading } = useZhodyPreObjednavku(objednavkaId, 20);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200 }}
      />
      {/* Drawer */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)",
        background: "var(--bg-surface)", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
        zIndex: 201, display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        <div style={{
          position: "sticky", top: 0, background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)", padding: "16px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
            🎯 Zhody pre objednávku
          </h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={() => router.push(`/nastroje?tab=matching&objednavka=${objednavkaId}`)}
              style={{ fontSize: "12px", color: "#3B82F6", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
            >
              Otvoriť plný matching →
            </button>
            <button onClick={onClose} style={{
              width: "28px", height: "28px", borderRadius: "50%", border: "none",
              background: "var(--bg-elevated)", cursor: "pointer", fontSize: "16px",
              color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Hľadám zhody...
            </div>
          )}
          {!loading && (!data || data.length === 0) && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Žiadne zhody (≥30 %). Skús upraviť parametre objednávky.
            </div>
          )}
          {!loading && data && data.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {data.map((m: ZhodaItem) => {
                const n = m.nehnutelnost;
                const st = scoreStyle(m.score);
                return (
                  <li key={n.id} style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--border)",
                    borderLeft: `4px solid ${st.bg === "#F0FDF4" ? "#10B981" : st.bg === "#FFFBEB" ? "#F59E0B" : "#E5E7EB"}`,
                    background: st.bg,
                  }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <div style={{ fontSize: "15px", fontWeight: "700", color: st.color, minWidth: "48px" }}>
                        {st.dot} {m.score}%
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "2px" }}>
                          {n.nazov || [n.typ, n.lokalita].filter(Boolean).join(" — ") || "—"}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {[n.okres || n.lokalita, n.cena ? `${n.cena.toLocaleString("sk")} €` : null, n.plocha ? `${n.plocha} m²` : null, n.izby ? `${n.izby}i` : null].filter(Boolean).join(" · ")}
                        </div>
                        {n.predavajuci && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {n.predavajuci.meno}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                      {n.predavajuci?.telefon && (
                        <a href={`tel:${n.predavajuci.telefon}`} onClick={e => e.stopPropagation()} style={{
                          padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                          borderRadius: "7px", fontSize: "12px", color: "var(--text-primary)", textDecoration: "none",
                        }}>📞 Zavolať</a>
                      )}
                      {onPlanovatObhliadku && (
                        <button onClick={() => onPlanovatObhliadku(n.id)} style={{
                          padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                          borderRadius: "7px", fontSize: "12px", color: "var(--text-primary)", cursor: "pointer",
                        }}>📅 Obhliadka</button>
                      )}
                      <button onClick={() => router.push(`/inzerat?id=${n.id}`)} style={{
                        padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                        borderRadius: "7px", fontSize: "12px", color: "#3B82F6", cursor: "pointer",
                      }}>Inzerát →</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
