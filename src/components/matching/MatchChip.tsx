"use client";

type Props = {
  totalMatches: number;
  topScore: number;
  daysSinceCreated: number;
  onClick?: () => void;
};

export function MatchChip({ totalMatches, topScore, daysSinceCreated, onClick }: Props) {
  let bg = "#F3F4F6";
  let color = "#374151";
  let border = "#E5E7EB";
  let icon = "⚪";

  if (totalMatches === 0 && daysSinceCreated > 7) {
    bg = "#FEF2F2"; color = "#991B1B"; border = "#FECACA"; icon = "⚠";
  } else if (topScore >= 80) {
    bg = "#F0FDF4"; color = "#065F46"; border = "#BBF7D0"; icon = "🟢";
  } else if (topScore >= 50) {
    bg = "#FFFBEB"; color = "#92400E"; border = "#FDE68A"; icon = "🟡";
  }

  const label = totalMatches > 0 ? `${totalMatches} zhôd` : "0 zhôd";
  const sub = totalMatches > 0 ? `top ${topScore}%` : daysSinceCreated > 7 ? `${daysSinceCreated}d bez zhôd` : "—";

  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", flexDirection: "column", alignItems: "flex-start",
        gap: "1px", padding: "5px 10px", borderRadius: "8px",
        background: bg, color, border: `1px solid ${border}`,
        cursor: "pointer", fontSize: "12px", fontWeight: "600",
        lineHeight: 1.4, transition: "opacity 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
    >
      <span>{icon} 🎯 {label}</span>
      <span style={{ fontSize: "10px", opacity: 0.75, fontWeight: "400" }}>{sub}</span>
    </button>
  );
}
