interface PoweredByAMGDProps {
  /** Color theme — auto adapts; pass to override */
  className?: string;
  /** Visual scale: "sm" for vizitka/email footers, "md" for login screens */
  size?: "sm" | "md";
}

/**
 * AMGD signature for use under Vianema branding (Tier 1 — klient-facing).
 *
 * Visual: "POWERED BY  AMGD" in muted small caps, ~55% opacity.
 *
 * Use under Vianema logo on:
 * - Login screen footer
 * - Email signatures
 * - Contracts / PDF documents
 * - Business cards
 *
 * NEVER use without Vianema branding present in the same view.
 */
export function PoweredByAMGD({ className = "", size = "md" }: PoweredByAMGDProps) {
  const isSmall = size === "sm";
  const labelSize = isSmall ? "text-[7px]" : "text-[9px]";
  const markSize = isSmall ? "text-[9px]" : "text-[11px]";
  const gap = isSmall ? "gap-1.5" : "gap-2.5";

  return (
    <div
      className={`inline-flex items-center ${gap} opacity-60 ${className}`}
      aria-label="Powered by AMGD"
    >
      <span
        className={`${labelSize} tracking-[0.12em]`}
        style={{ color: "currentColor" }}
      >
        POWERED BY
      </span>
      <span
        className={`${markSize} font-medium`}
        style={{
          color: "currentColor",
          letterSpacing: "-0.02em",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        AMGD
      </span>
    </div>
  );
}

interface VianemaBrandedProps {
  children?: React.ReactNode;
  /** Show Powered by AMGD line below. Default: true */
  showPoweredBy?: boolean;
  /** Vertical layout (login, vizitka) vs horizontal (header). Default: vertical */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * Tier 1 lockup — Vianema dominates, AMGD whispers.
 *
 * Use as the brand block in klient-facing contexts. Composes Vianema
 * wordmark with optional Powered by AMGD signature.
 *
 * Color: inherits currentColor — set with text-white / text-black.
 */
export function VianemaBranded({
  children,
  showPoweredBy = true,
  orientation = "vertical",
  className = "",
}: VianemaBrandedProps) {
  const isVertical = orientation === "vertical";

  return (
    <div
      className={`flex ${
        isVertical
          ? "flex-col items-center gap-6"
          : "flex-row items-center justify-between w-full"
      } ${className}`}
    >
      <div className="flex flex-col items-center">
        <span
          className="text-[32px] font-medium"
          style={{
            letterSpacing: "-0.03em",
            color: "currentColor",
            lineHeight: 1,
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          VIANEMA
        </span>
        <span
          className="text-[9px] mt-1 opacity-55"
          style={{
            letterSpacing: "0.4em",
            color: "currentColor",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          REAL
        </span>
      </div>
      {children}
      {showPoweredBy && <PoweredByAMGD size={isVertical ? "md" : "sm"} />}
    </div>
  );
}
