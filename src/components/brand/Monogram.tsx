interface MonogramProps {
  className?: string;
  /** Pixel size of the square. Default: 32 */
  size?: number;
}

/**
 * AMGD monogram — single-letter mark for compact contexts (favicon-sized,
 * sidebar collapsed state, mobile nav).
 *
 * Tier 3. Filled square with the letter A. Color inherits currentColor.
 */
export function Monogram({ className = "", size = 32 }: MonogramProps) {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * 0.22)}px`,
        background: "currentColor",
        color: "transparent",
      }}
      aria-label="AMGD"
    >
      <span
        style={{
          fontSize: `${Math.round(size * 0.55)}px`,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          // Inversion trick: letter "transparently" cuts through the filled square
          mixBlendMode: "difference",
          color: "#fff",
        }}
      >
        A
      </span>
    </div>
  );
}
