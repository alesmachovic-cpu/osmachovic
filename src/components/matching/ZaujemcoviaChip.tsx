"use client";

import { useZaujemcoviaPreNehnutelnost } from "@/hooks/useMatching";
import { skoreUroven } from "@/lib/matching";

type Props = {
  nehnutelnostId: string;
  onClick: () => void;
};

export function ZaujemcoviaChip({ nehnutelnostId, onClick }: Props) {
  const { data, loading } = useZaujemcoviaPreNehnutelnost(nehnutelnostId);

  if (loading) {
    return (
      <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
        padding: "7px 10px", fontSize: "11px", fontWeight: 700,
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: "8px", cursor: "pointer", color: "var(--text-muted)",
        flex: 1,
      }}>
        👥 ...
      </button>
    );
  }

  const count = data?.length ?? 0;
  const topScore = data?.length ? Math.max(...data.map(z => z.score)) : 0;
  const uroven = count === 0 ? null : skoreUroven(topScore);
  const bg = uroven === "vyborna" ? "#F0FDF4" : uroven === "dobra" ? "#FFFBEB" : "var(--bg-elevated)";
  const color = uroven === "vyborna" ? "#065F46" : uroven === "dobra" ? "#92400E" : count === 0 ? "var(--text-muted)" : "var(--text-primary)";
  const border = uroven === "vyborna" ? "#10B981" : uroven === "dobra" ? "#F59E0B" : "var(--border)";

  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{
      padding: "7px 10px", fontSize: "11px", fontWeight: 700,
      background: bg, border: `1px solid ${border}`,
      borderRadius: "8px", cursor: "pointer", color,
      flex: 1,
    }}>
      👥 {count} záujemcov
    </button>
  );
}
