"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Alert {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  klientId: string;
  klientMeno: string;
  type: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  high: { label: "Urgentné", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  medium: { label: "Bežné", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  low: { label: "Informačné", color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB" },
};

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function UpozorneniaPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | "high" | "medium" | "low">("");

  useEffect(() => {
    generateAlerts();
  }, []);

  async function generateAlerts() {
    setLoading(true);
    const { data: klienti } = await supabase
      .from("klienti")
      .select("id, meno, status, created_at, datum_kontaktu, telefon")
      .order("created_at", { ascending: false });

    const generated: Alert[] = [];

    (klienti ?? []).forEach((k) => {
      const daysSinceCreated = daysSince(k.created_at);
      const daysSinceContact = daysSince(k.datum_kontaktu || k.created_at);

      // Dohodnutý náber > 3 dni
      if (k.status === "dohodnuty_naber" && daysSinceContact > 3) {
        generated.push({
          id: `naber-${k.id}`,
          priority: "high",
          title: "Ozvať sa, čaká na náber",
          detail: `${k.meno} má dohodnutý náber už ${daysSinceContact} dní. Treba dohodnúť termín stretnutia.`,
          klientId: k.id,
          klientMeno: k.meno,
          type: "dohodnuty_naber",
        });
      }

      // Nový kontakt > 5 dní
      if (k.status === "novy_kontakt" && daysSinceCreated > 5) {
        generated.push({
          id: `kontakt-${k.id}`,
          priority: "high",
          title: "Prvý kontakt ešte neprebehol",
          detail: `${k.meno} bol pridaný pred ${daysSinceCreated} dňami a stále nemá prvý kontakt.`,
          klientId: k.id,
          klientMeno: k.meno,
          type: "novy_kontakt",
        });
      }

      // Volať neskôr
      if (k.status === "volat_neskor") {
        generated.push({
          id: `volat-${k.id}`,
          priority: "medium",
          title: "Zavolať späť",
          detail: `${k.meno} čaká na spätný hovor. Telefón: ${k.telefon || "neuvedený"}.`,
          klientId: k.id,
          klientMeno: k.meno,
          type: "volat_neskor",
        });
      }

      // Nedovolal
      if (k.status === "nedovolal") {
        generated.push({
          id: `nedovolal-${k.id}`,
          priority: "medium",
          title: "Skúsiť znova zavolať",
          detail: `${k.meno} — predchádzajúci pokus o kontakt bol neúspešný. Telefón: ${k.telefon || "neuvedený"}.`,
          klientId: k.id,
          klientMeno: k.meno,
          type: "nedovolal",
        });
      }

      // Nový klient > 7 dní bez pohybu
      if (k.status === "novy" && daysSinceCreated > 7) {
        generated.push({
          id: `novy-${k.id}`,
          priority: "low",
          title: "Nový klient bez aktivity",
          detail: `${k.meno} je v systéme ${daysSinceCreated} dní bez zmeny statusu.`,
          klientId: k.id,
          klientMeno: k.meno,
          type: "novy",
        });
      }
    });

    // Sort by priority
    const order = { high: 0, medium: 1, low: 2 };
    generated.sort((a, b) => order[a.priority] - order[b.priority]);

    setAlerts(generated);
    setLoading(false);
  }

  const filtered = filter ? alerts.filter((a) => a.priority === filter) : alerts;
  const highCount = alerts.filter((a) => a.priority === "high").length;
  const mediumCount = alerts.filter((a) => a.priority === "medium").length;
  const lowCount = alerts.filter((a) => a.priority === "low").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", margin: "0 0 4px" }}>
            Inteligentné upozornenia
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
            Denný prehľad aktivít vyžadujúcich pozornosť
          </p>
        </div>
        <button
          onClick={generateAlerts}
          style={{
            padding: "8px 16px",
            background: "#374151",
            color: "#fff",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
          }}
        >
          Aktualizovať
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Celkom", value: alerts.length, color: "#374151", filterVal: "" as const },
          { label: "Urgentné", value: highCount, color: "#DC2626", filterVal: "high" as const },
          { label: "Bežné", value: mediumCount, color: "#D97706", filterVal: "medium" as const },
          { label: "Informačné", value: lowCount, color: "#6B7280", filterVal: "low" as const },
        ].map((s) => (
          <div
            key={s.label}
            onClick={() => setFilter(s.filterVal)}
            style={{
              padding: "16px",
              background: filter === s.filterVal && s.filterVal ? "var(--bg-elevated)" : "var(--bg-surface)",
              borderRadius: "12px",
              border: filter === s.filterVal && s.filterVal ? `2px solid ${s.color}` : "1px solid var(--border)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>
              {s.label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "14px" }}>
          Analyzujem klientov...
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "var(--bg-surface)",
            borderRadius: "16px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#10003;</div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "6px" }}>
            {filter ? "Žiadne upozornenia tohto typu" : "Všetko v poriadku"}
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            {filter ? "Skúste iný filter" : "Žiadni klienti nevyžadujú okamžitú pozornosť"}
          </div>
        </div>
      )}

      {/* Alert list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((alert) => {
            const cfg = PRIORITY_CONFIG[alert.priority];
            return (
              <div
                key={alert.id}
                style={{
                  padding: "16px 20px",
                  background: "var(--bg-surface)",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${cfg.color}`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                }}
              >
                {/* Priority badge */}
                <div
                  style={{
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: cfg.color,
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {cfg.label}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>
                    {alert.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px", lineHeight: "1.5" }}>
                    {alert.detail}
                  </div>
                  <Link
                    href={`/klienti/${alert.klientId}`}
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#374151",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    Otvoriť kartu klienta &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
