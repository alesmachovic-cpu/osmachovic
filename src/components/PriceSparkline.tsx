"use client";

import { useEffect, useState } from "react";

/**
 * Mini SVG sparkline cien zo `monitor_inzeraty_snapshots` pre konkrétny inzerát.
 * Žiadny external chart library — čisté SVG (cca 80×24 px).
 *
 * Ak má inzerát menej ako 2 snapshoty, zobrazí jednoduchý text "—".
 */
export default function PriceSparkline({ inzeratId, currentPrice }: { inzeratId: string; currentPrice?: number | null }) {
  const [snaps, setSnaps] = useState<Array<{ snapshot_date: string; cena: number }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/monitor/${inzeratId}/snapshots`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setSnaps(d.snapshots || []); })
      .catch(() => { if (!cancelled) setSnaps([]); });
    return () => { cancelled = true; };
  }, [inzeratId]);

  if (!snaps) return <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>·</span>;
  if (snaps.length < 2) {
    return <span style={{ fontSize: "10px", color: "var(--text-muted)" }} title="Iba 1 snapshot — graf bude po viacerých dňoch">{snaps.length === 1 ? "📊 1d" : "—"}</span>;
  }

  const prices = snaps.map(s => Number(s.cena));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 80, H = 24, pad = 2;

  const points = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (W - 2 * pad);
    const y = pad + ((max - p) / range) * (H - 2 * pad);
    return `${x},${y}`;
  }).join(" ");

  const first = prices[0];
  const last = currentPrice ?? prices[prices.length - 1];
  const diff = last - first;
  const diffPct = first > 0 ? (diff / first) * 100 : 0;
  const color = diffPct < -1 ? "#15803d" : diffPct > 1 ? "#dc2626" : "#6b7280";
  const label = diffPct < -0.5 ? `▼ ${Math.abs(Math.round(diffPct * 10) / 10)}%` :
                diffPct > 0.5 ? `▲ ${Math.round(diffPct * 10) / 10}%` :
                "—";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }} title={`${snaps.length} dní snapshotov · od ${snaps[0].snapshot_date} (${first.toLocaleString("sk")} €) → dnes (${last.toLocaleString("sk")} €)`}>
      <svg width={W} height={H} style={{ display: "block" }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
        {prices.map((p, i) => {
          const x = pad + (i / (prices.length - 1)) * (W - 2 * pad);
          const y = pad + ((max - p) / range) * (H - 2 * pad);
          return <circle key={i} cx={x} cy={y} r="1.5" fill={color} />;
        })}
      </svg>
      <span style={{ fontSize: "10px", fontWeight: 700, color }}>{label}</span>
    </span>
  );
}
