"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PLANS } from "@/lib/stripe-plans";
import type { PlanKey } from "@/lib/stripe-plans";

type Plan = PlanKey;

interface Props {
  currentPlan: Plan;
  isSuspended: boolean;
  hasStripeCustomer: boolean;
}

export function BillingPanel({ currentPlan, isSuspended, hasStripeCustomer }: Props) {
  const t = useTranslations("billing");
  const [loading, setLoading] = useState<Plan | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: Plan) {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Chyba pri vytváraní platby");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznáma chyba");
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Chyba pri otváraní portálu");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznáma chyba");
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {isSuspended && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px",
          padding: "14px 16px", fontSize: "13px", color: "#991B1B",
        }}>
          Váš účet je pozastavený z dôvodu neúspešnej platby. Obnovte predplatné nižšie.
        </div>
      )}

      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px",
          padding: "12px 16px", fontSize: "13px", color: "#991B1B",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, plan]) => {
          const isActive = currentPlan === key;
          return (
            <div key={key} style={{
              flex: "1 1 260px", border: `2px solid ${isActive ? "#374151" : "var(--border)"}`,
              borderRadius: "12px", padding: "20px", background: "var(--bg-card)",
              position: "relative",
            }}>
              {isActive && (
                <div style={{
                  position: "absolute", top: "12px", right: "12px",
                  background: "#374151", color: "#fff",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em",
                  padding: "2px 8px", borderRadius: "99px",
                }}>
                  {t("currentPlan").toUpperCase()}
                </div>
              )}
              <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>
                {plan.name}
              </div>
              <div style={{ fontSize: "26px", fontWeight: 700, marginBottom: "12px" }}>
                {(plan.amount / 100).toFixed(0)} €
                <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-muted)" }}>
                  {" "}{t("perMonth")}
                </span>
              </div>
              <ul style={{ margin: "0 0 16px", padding: "0 0 0 16px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {plan.features.map(f => <li key={f}>{f}</li>)}
              </ul>
              {!isActive && (
                <button
                  onClick={() => startCheckout(key)}
                  disabled={loading !== null}
                  style={{
                    width: "100%", padding: "9px", borderRadius: "8px",
                    background: "#374151", color: "#fff", border: "none",
                    fontSize: "13px", fontWeight: 600, cursor: "pointer",
                    opacity: loading !== null ? 0.6 : 1,
                  }}
                >
                  {loading === key ? "Načítavam..." : t("upgrade")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {hasStripeCustomer && (
        <div>
          <button
            onClick={openPortal}
            disabled={loading !== null}
            style={{
              padding: "8px 16px", borderRadius: "8px",
              border: "1px solid var(--border)", background: "var(--bg-card)",
              fontSize: "13px", cursor: "pointer",
              opacity: loading !== null ? 0.6 : 1,
            }}
          >
            {loading === "portal" ? "Načítavam..." : t("manage")}
          </button>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
            Zmeniť platobné údaje, zrušiť predplatné alebo stiahnuť faktúry.
          </p>
        </div>
      )}

      <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
        14-dňové skúšobné obdobie zadarmo · Platba cez Stripe · Zrušenie kedykoľvek
      </p>
    </div>
  );
}
