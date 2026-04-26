interface WordmarkProps {
  className?: string;
  /** Pixel height for the wordmark text. Default: 22 */
  size?: number;
}

/**
 * AMGD wordmark — typographic brand mark.
 *
 * Tier 3 (AMGD-only). For klient-facing surfaces use <VianemaBranded /> from
 * Tier1ClientFacing.tsx. For B2B partnership lockup use <PartnershipLockup />
 * from Tier2Partnership.tsx.
 *
 * Color: inherits currentColor — set with text-white / text-black or style.color.
 */
export function Wordmark({ className = "", size = 22 }: WordmarkProps) {
  return (
    <span
      className={`font-medium ${className}`}
      style={{
        fontSize: `${size}px`,
        letterSpacing: "-0.035em",
        color: "currentColor",
        lineHeight: 1,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
      aria-label="AMGD"
    >
      AMGD
    </span>
  );
}
