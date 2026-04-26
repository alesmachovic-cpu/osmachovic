"use client";

import { useEffect, useState } from "react";

interface KlientLike {
  status: string;
  updated_at?: string | null;
  datum_naberu?: string | null;
  je_volny?: boolean | null;
  sla_warning_at?: string | null;
  sla_critical_at?: string | null;
}

/**
 * SLA Timer banner — odpočítava do najbližšej akcie podľa statusu klienta.
 *
 * Pravidlá (zhodné s /api/cron/volni-klienti):
 *   - novy / novy_kontakt    → 24h od updated_at      → uvolní sa
 *   - volat_neskor           → 24h od datum_naberu   → uvolní sa
 *   - dohodnuty_naber (bez inzerátu) → 48h od datum_naberu → SLA warning
 *                                       72h               → SLA critical (manažér)
 *   - nechce_rk              → uvolnený ihneď
 *
 * Update každých 30s pre real-time pocit.
 */
export default function SlaTimer({ klient, hasInzerat }: { klient: KlientLike; hasInzerat?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Voľný klient — ukáž zelený banner namiesto timeru
  if (klient.je_volny) {
    return (
      <div style={{
        marginBottom: "16px", padding: "12px 16px",
        background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px",
        fontSize: "13px", color: "#065F46",
      }}>
        Klient je <strong>voľný</strong> — ktorýkoľvek maklér ho môže prebrať v sekcii „Voľní klienti".
      </div>
    );
  }

  // SLA critical — červený banner
  if (klient.sla_critical_at) {
    return (
      <div style={{
        marginBottom: "16px", padding: "12px 16px",
        background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "10px",
        fontSize: "13px", color: "#991B1B",
      }}>
        SLA prekročené 72h — manažér rozhoduje (presunutie / napomenutie).
      </div>
    );
  }

  // SLA warning — oranžový banner
  if (klient.sla_warning_at) {
    return (
      <div style={{
        marginBottom: "16px", padding: "12px 16px",
        background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "10px",
        fontSize: "13px", color: "#92400E",
      }}>
        Pozor: SLA prekročené 48h bez inzerátu. Vytvor inzerát do 24h, inak rozhoduje manažér.
      </div>
    );
  }

  // Vypočítaj timer
  let label: string | null = null;
  let warningLevel: "info" | "warning" | "danger" = "info";
  let triggerMs: number | null = null;

  if (klient.status === "novy" || klient.status === "novy_kontakt") {
    if (klient.updated_at) {
      triggerMs = new Date(klient.updated_at).getTime() + 24 * 3600 * 1000;
      label = "Uvolní sa";
    }
  } else if (klient.status === "volat_neskor" && klient.datum_naberu) {
    triggerMs = new Date(klient.datum_naberu).getTime() + 24 * 3600 * 1000;
    label = "Uvolní sa";
  } else if (klient.status === "dohodnuty_naber" && klient.datum_naberu && !hasInzerat) {
    triggerMs = new Date(klient.datum_naberu).getTime() + 48 * 3600 * 1000;
    label = "SLA warning bez inzerátu";
  } else if (klient.status === "nechce_rk") {
    return (
      <div style={{
        marginBottom: "16px", padding: "12px 16px",
        background: "#F3F4F6", border: "1px solid var(--border)", borderRadius: "10px",
        fontSize: "13px", color: "var(--text-secondary)",
      }}>
        Klient sa stane <strong>voľným</strong> pri najbližšom SLA cykle (status „nechce RK").
      </div>
    );
  }

  if (!triggerMs || !label) return null;

  const remainMs = triggerMs - now;
  if (remainMs <= 0) return null; // SLA už uplynulo (cron to spracuje)

  const remainH = Math.floor(remainMs / 3600000);
  const remainM = Math.floor((remainMs % 3600000) / 60000);
  if (remainH < 1) warningLevel = "danger";
  else if (remainH < 6) warningLevel = "warning";

  const colors = {
    info:    { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
    warning: { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" },
    danger:  { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B" },
  }[warningLevel];

  return (
    <div style={{
      marginBottom: "16px", padding: "12px 16px",
      background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "10px",
      fontSize: "13px", color: colors.text,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap",
    }}>
      <div>
        {label}: <strong>{remainH > 0 ? `${remainH} h ${remainM} min` : `${remainM} min`}</strong>
      </div>
      <div style={{ fontSize: "11px", opacity: 0.7 }}>
        do {new Date(triggerMs).toLocaleString("sk", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}
