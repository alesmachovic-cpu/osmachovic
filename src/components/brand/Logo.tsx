import { SVGProps } from "react";

interface LogoProps extends Omit<SVGProps<SVGSVGElement>, "width" | "viewBox"> {
  /** Visible width in px (height auto-scales). Default: 320 */
  width?: number;
}

/**
 * AMGD primary logo — wordmark + horizontal rule + tagline "EST. 2025 — BRATISLAVA".
 *
 * Tier 3 — AMGD samostatne. Použitie: hero kontexty (login, kontrakty footer,
 * vizitky, pitch slides, amgd.sk hero).
 *
 * V klient-facing kontextoch NEPOUŽÍVAŤ — namiesto toho <VianemaBranded /> z
 * CobrandTier1.tsx (Vianema dominuje, AMGD šepká).
 *
 * Farba: dedí cez currentColor — nastavuje sa Tailwind triedami text-white /
 * text-black alebo style.color.
 */
export function Logo({ width = 320, ...rest }: LogoProps) {
  return (
    <svg
      role="img"
      aria-label="AMGD — Est. 2025 Bratislava"
      width={width}
      viewBox="0 0 320 100"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <text
        x="160"
        y="50"
        textAnchor="middle"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="44"
        fontWeight="500"
        letterSpacing="-1.5"
        fill="currentColor"
      >
        AMGD
      </text>
      <line
        x1="130"
        y1="62"
        x2="190"
        y2="62"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.6"
      />
      <text
        x="160"
        y="80"
        textAnchor="middle"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="10"
        fontWeight="400"
        letterSpacing="3"
        fill="currentColor"
        opacity="0.55"
      >
        EST. 2025 — BRATISLAVA
      </text>
    </svg>
  );
}
