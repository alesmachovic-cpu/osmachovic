interface PartnershipLockupProps {
  /** Veľkostná škála. Default: "md" */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Tier 2 lockup — VIANEMA | AMGD ako rovnocenné, oddelené tenkým vertikálnym
 * separátorom.
 *
 * Použitie (B2B): pitch decky pre iné realitky (title slide), case studies,
 * blog posts o systéme, joint webináre, partnership stránky, press materiály.
 *
 * NIKDY v klient-facing kontextoch (Tier 1) — implikuje to, že Vianema a AMGD
 * sú zameniteľné z pohľadu kupujúceho/predávajúceho, čo mätie vzťah.
 *
 * Farba: dedí cez currentColor.
 */
export function PartnershipLockup({ size = "md", className = "" }: PartnershipLockupProps) {
  const config = {
    sm: { vianemaSize: 14, amgdSize: 14, realSize: 7,  dividerHeight: 14, gap: "gap-3.5" },
    md: { vianemaSize: 22, amgdSize: 22, realSize: 6,  dividerHeight: 36, gap: "gap-6" },
    lg: { vianemaSize: 32, amgdSize: 32, realSize: 9,  dividerHeight: 50, gap: "gap-8" },
  }[size];

  return (
    <div
      className={`flex items-center ${config.gap} ${className}`}
      aria-label="Vianema and AMGD partnership"
    >
      <div className="flex flex-col items-center">
        <span
          className="font-medium"
          style={{
            fontSize: `${config.vianemaSize}px`,
            letterSpacing: "-0.035em",
            color: "currentColor",
            lineHeight: 1,
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          VIANEMA
        </span>
        {size !== "sm" && (
          <span
            className="opacity-55 mt-0.5"
            style={{
              fontSize: `${config.realSize}px`,
              letterSpacing: "0.3em",
              color: "currentColor",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            }}
          >
            REAL
          </span>
        )}
      </div>
      <div
        className="opacity-25"
        style={{
          width: "1px",
          height: `${config.dividerHeight}px`,
          background: "currentColor",
        }}
      />
      <span
        className="font-medium"
        style={{
          fontSize: `${config.amgdSize}px`,
          letterSpacing: "-0.035em",
          color: "currentColor",
          lineHeight: 1,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        AMGD
      </span>
    </div>
  );
}
