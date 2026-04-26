interface MonogramProps {
  /** Pixel size of the square (width = height). Default: 40 */
  size?: number;
  /** Inverted — biele pozadie + čierny text. Default: false (čierne pozadie + biely text) */
  inverted?: boolean;
  className?: string;
}

/**
 * AMGD monogram — AM/GD štvorec.
 *
 * Použitie: app icon, avatar, watermark. Nezvolený tier — funguje samostatne
 * (na klient-facing aj AMGD plochách). Self-contained: NEpoužíva currentColor,
 * vždy renderuje vlastný farebný blok.
 */
export function Monogram({ size = 40, inverted = false, className = "" }: MonogramProps) {
  const bg = inverted ? "#FFFFFF" : "#000000";
  const fg = inverted ? "#000000" : "#FFFFFF";
  return (
    <svg
      role="img"
      aria-label="AMGD"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="120" height="120" rx="22" fill={bg} />
      <text
        x="60"
        y="56"
        textAnchor="middle"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="28"
        fontWeight="500"
        letterSpacing="-0.5"
        fill={fg}
      >
        AM
      </text>
      <line
        x1="36"
        y1="64"
        x2="84"
        y2="64"
        stroke={fg}
        strokeWidth="0.8"
        opacity="0.4"
      />
      <text
        x="60"
        y="92"
        textAnchor="middle"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="28"
        fontWeight="500"
        letterSpacing="-0.5"
        fill={fg}
      >
        GD
      </text>
    </svg>
  );
}
