"use client";

import { useZaujemcoviaPreNehnutelnost } from "@/hooks/useMatching";

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
  const bg = count === 0 ? "var(--bg-elevated)" : topScore >= 80 ? "#F0FDF4" : topScore >= 50 ? "#FFFBEB" : "var(--bg-elevated)";
  const color = count === 0 ? "var(--text-muted)" : topScore >= 80 ? "#065F46" : topScore >= 50 ? "#92400E" : "var(--text-primary)";
  const border = count === 0 ? "var(--border)" : topScore >= 80 ? "#10B981" : topScore >= 50 ? "#F59E0B" : "var(--border)";

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
