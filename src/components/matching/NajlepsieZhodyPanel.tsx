"use client";

import { useRouter } from "next/navigation";
import { useZhodyPreObjednavku } from "@/hooks/useMatching";
import type { ZhodaItem } from "@/hooks/useMatching";

type Props = {
  objednavkaId: string;
  onPlanovatObhliadku?: (nehnutelnostId: string) => void;
};

function scoreColors(score: number) {
  if (score >= 80) return { dot: "🟢", border: "#10B981", bg: "#F0FDF4", text: "#065F46" };
  if (score >= 50) return { dot: "🟡", border: "#F59E0B", bg: "#FFFBEB", text: "#92400E" };
  return { dot: "⚪", border: "#E5E7EB", bg: "#F9FAFB", text: "#374151" };
}

export function NajlepsieZhodyPanel({ objednavkaId, onPlanovatObhliadku }: Props) {
  const router = useRouter();
  const { data, loading } = useZhodyPreObjednavku(objednavkaId, 5);

  if (loading) {
    return (
      <div style={{ padding: "14px", background: "var(--bg-elevated)", borderRadius: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
        🎯 Hľadám zhody...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: "14px 16px", background: "var(--bg-elevated)", borderRadius: "12px", border: "1px solid var(--border)", fontSize: "13px", color: "var(--text-muted)" }}>
        🎯 Žiadne zhody. Skús upraviť parametre objednávky alebo počkaj na nové inzeráty.
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginTop: "12px" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
          🎯 Najlepšie zhody ({data.length})
        </span>
        <button
          onClick={() => router.push(`/nastroje?tab=matching&objednavka=${objednavkaId}`)}
          style={{ fontSize: "12px", color: "#3B82F6", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Plný matching →
        </button>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {data.map((m: ZhodaItem, i: number) => {
          const n = m.nehnutelnost;
          const c = scoreColors(m.score);
          return (
            <li key={n.id} style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              padding: "12px 16px",
              borderBottom: i < data.length - 1 ? "1px solid var(--border)" : "none",
              background: c.bg,
              borderLeft: `3px solid ${c.border}`,
            }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: c.text, minWidth: "52px" }}>
                {c.dot} {m.score}%
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: "500", marginBottom: "2px" }}>
                  {[n.okres || n.lokalita, n.cena ? `${n.cena.toLocaleString("sk")} €` : null, n.plocha ? `${n.plocha} m²` : null, n.izby ? `${n.izby}i` : null].filter(Boolean).join(" · ")}
                </div>
                {n.predavajuci && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{n.predavajuci.meno}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                {n.predavajuci?.telefon && (
                  <a href={`tel:${n.predavajuci.telefon}`} style={{
                    padding: "4px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                    borderRadius: "6px", fontSize: "11px", textDecoration: "none", color: "var(--text-primary)",
                  }}>📞</a>
                )}
                {onPlanovatObhliadku && (
                  <button onClick={() => onPlanovatObhliadku(n.id)} style={{
                    padding: "4px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                    borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "var(--text-primary)",
                  }}>📅</button>
                )}
                <button onClick={() => router.push(`/inzerat?id=${n.id}`)} style={{
                  padding: "4px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)",
                  borderRadius: "6px", fontSize: "11px", cursor: "pointer", color: "#3B82F6",
                }}>→</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
