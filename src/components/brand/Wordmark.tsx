import { SVGProps } from "react";

interface WordmarkProps extends Omit<SVGProps<SVGSVGElement>, "width" | "viewBox"> {
  /** Visible width in px (height auto-scales). Default: 96 */
  width?: number;
}

/**
 * AMGD wordmark bez tagline.
 *
 * Tier 3 — AMGD samostatne. Použitie: app header, navigácia, mobile bar,
 * embedded UI keď je málo miesta.
 *
 * Farba: dedí cez currentColor.
 */
export function Wordmark({ width = 96, ...rest }: WordmarkProps) {
  return (
    <svg
      role="img"
      aria-label="AMGD"
      width={width}
      viewBox="0 0 240 60"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <text
        x="120"
        y="42"
        textAnchor="middle"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="44"
        fontWeight="500"
        letterSpacing="-1.5"
        fill="currentColor"
      >
        AMGD
      </text>
    </svg>
  );
}
