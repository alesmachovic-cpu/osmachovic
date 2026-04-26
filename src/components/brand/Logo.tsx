import { Monogram } from "./Monogram";
import { Wordmark } from "./Wordmark";

interface LogoProps {
  className?: string;
  /** Visible width target in px (controls overall scale). Default: 140 */
  width?: number;
}

/**
 * AMGD primary logo — monogram + wordmark.
 *
 * Tier 3 (AMGD-only). For klient-facing surfaces (login, contracts, klient
 * portal) DO NOT use this directly — use <VianemaBranded /> instead so
 * Vianema dominates and AMGD is the whisper.
 *
 * Color: inherits currentColor.
 */
export function Logo({ className = "", width = 140 }: LogoProps) {
  // monogram sized ~28% of overall width, wordmark fills the rest
  const monoSize = Math.round(width * 0.28);
  const wordSize = Math.round(width * 0.18);
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} aria-label="AMGD">
      <Monogram size={monoSize} />
      <Wordmark size={wordSize} />
    </div>
  );
}
