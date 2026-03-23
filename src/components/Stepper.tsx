"use client";

import Link from "next/link";

interface StepDef {
  key: string;
  label: string;
  num: number;
}

interface Props {
  steps: StepDef[];
  currentStep: string;
  onStepClick?: (key: string) => void;
  /** Show home button - defaults to true */
  showHome?: boolean;
}

export default function Stepper({ steps, currentStep, onStepClick, showHome = true }: Props) {
  const currentIdx = steps.findIndex(s => s.key === currentStep);

  function canGoTo(key: string): boolean {
    const idx = steps.findIndex(s => s.key === key);
    return idx <= currentIdx;
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0", marginBottom: "28px",
      background: "var(--bg-surface)", borderRadius: "12px", padding: "12px 16px",
      border: "1px solid var(--border)",
    }}>
      {/* Home button */}
      {showHome && (
        <Link href="/" style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", color: "var(--text-muted)", textDecoration: "none",
          flexShrink: 0, marginRight: "14px",
          transition: "border-color 0.15s, background 0.15s",
        }}
          title="Späť na prehľad"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.background = "#F3F4F6"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-elevated)"; }}
        >
          🏠
        </Link>
      )}

      {steps.map((s, i) => {
        const isActive = s.key === currentStep;
        const isDone = i < currentIdx;
        const clickable = canGoTo(s.key) && onStepClick;

        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div
              onClick={() => clickable && onStepClick?.(s.key)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                cursor: clickable ? "pointer" : "default",
                opacity: clickable || isActive ? 1 : 0.4,
                transition: "opacity 0.15s",
              }}
              title={clickable ? `Prejsť na: ${s.label}` : ""}
            >
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: isActive ? "#374151" : isDone ? "#374151" : "#E5E7EB",
                color: isActive || isDone ? "#fff" : "#9CA3AF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: "700", flexShrink: 0,
                transition: "transform 0.1s",
              }}
                onMouseEnter={e => { if (clickable) e.currentTarget.style.transform = "scale(1.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {isDone ? "✓" : s.num}
              </div>
              <span className="stepper-label" style={{
                fontSize: "13px", fontWeight: isActive ? "700" : "500",
                color: isActive ? "var(--text-primary)" : isDone ? "var(--text-secondary)" : "var(--text-muted)",
                whiteSpace: "nowrap",
              }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="stepper-line" style={{
                flex: 1, height: "2px", margin: "0 12px",
                background: isDone ? "#374151" : "#E5E7EB",
                borderRadius: "1px",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
