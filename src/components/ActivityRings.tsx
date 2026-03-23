"use client";

interface RingData {
  current: number;
  target: number;
  label: string;
  color: string;
}

interface Props {
  obrat: { current: number; target: number };
  zmluvy: { current: number; target: number };
  nabery: { current: number; target: number };
}

function Ring({ cx, cy, r, strokeWidth, progress, color }: {
  cx: number; cy: number; r: number; strokeWidth: number; progress: number; color: string;
}) {
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const offset = circumference * (1 - clamped);

  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} opacity={0.3} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
    </>
  );
}

export default function ActivityRings({ obrat, zmluvy, nabery }: Props) {
  const rings: (RingData & { r: number })[] = [
    { ...obrat, label: "Obrat", color: "#FF3B30", r: 80 },
    { ...zmluvy, label: "Zmluvy", color: "#34C759", r: 60 },
    { ...nabery, label: "Nábery", color: "#007AFF", r: 40 },
  ];

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map(ring => (
          <Ring key={ring.label} cx={cx} cy={cy} r={ring.r} strokeWidth={13}
            progress={ring.target > 0 ? ring.current / ring.target : 0} color={ring.color} />
        ))}
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[...rings].reverse().map(ring => {
          const pct = ring.target > 0 ? Math.round((ring.current / ring.target) * 100) : 0;
          return (
            <div key={ring.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: ring.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                  {ring.label} <span style={{ fontWeight: "400", color: "var(--text-muted)" }}>{pct}%</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {ring.label === "Obrat"
                    ? `${ring.current.toLocaleString("sk")} / ${ring.target.toLocaleString("sk")} €`
                    : `${ring.current} / ${ring.target}`
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
