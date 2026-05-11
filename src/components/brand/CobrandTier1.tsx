import type { ReactNode } from "react";

interface PoweredByAMGDProps {
  /** Visual scale: "sm" pre vizitky/email patičky, "md" pre login screen */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Tichá AMGD signatúra "POWERED BY  AMGD" pre Tier 1 (klient-facing).
 *
 * Použitie pod Vianema brandingom v:
 *   - Login footer
 *   - Email signatúrach
 *   - PDF dokumentoch
 *   - Vizitkách
 *
 * NIKDY samostatne bez Vianema brandingu prítomného v rovnakej ploche.
 *
 * Farba: dedí cez currentColor.
 */
export function PoweredByAMGD({ size = "md", className = "" }: PoweredByAMGDProps) {
  const isSmall = size === "sm";
  const labelSize = isSmall ? "text-[7px]" : "text-[9px]";
  const markSize = isSmall ? "text-[9px]" : "text-[11px]";
  const gap = isSmall ? "gap-1.5" : "gap-2.5";

  return (
    <div
      className={className}
      aria-label="Powered by AMGD"
      style={{ display: "inline-flex", alignItems: "center", gap: isSmall ? "6px" : "10px", opacity: 0.6 }}
    >
      <span style={{ fontSize: isSmall ? "7px" : "9px", letterSpacing: "0.12em", color: "currentColor" }}>
        POWERED BY
      </span>
      <span style={{
        fontSize: isSmall ? "9px" : "11px",
        fontWeight: 500,
        color: "currentColor",
        letterSpacing: "-0.02em",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}>
        AMGD
      </span>
    </div>
  );
}

interface VianemaBrandedProps {
  children?: ReactNode;
  /** Či sa pod Vianemou má zobraziť POWERED BY AMGD whisper. Default: true */
  showPoweredBy?: boolean;
  /** Vertical (login, vizitka) vs horizontal (header). Default: vertical */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * Tier 1 lockup — Vianema dominuje, AMGD šepká.
 *
 * Použitie: login screen, klient-facing dokumenty, kontrakty footer,
 * email signatúry, vizitky.
 *
 * Skladá Vianema wordmark s voliteľnou POWERED BY AMGD signatúrou pod ním.
 *
 * Vianema wordmark je momentálne typografický placeholder (Inter font).
 * Pred produkciou nahradiť oficiálnym SVG z vianemareal.eu — viď BRAND.md.
 *
 * Farba: dedí cez currentColor.
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
      className={className}
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        alignItems: "center",
        justifyContent: isVertical ? undefined : "space-between",
        width: isVertical ? undefined : "100%",
        gap: isVertical ? "24px" : undefined,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.03em",
            color: "currentColor",
            lineHeight: 1,
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          VIANEMA
        </span>
        <span
          style={{
            fontSize: "9px",
            marginTop: "4px",
            opacity: 0.55,
            letterSpacing: "0.25em",
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
