"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import KalkulatorPage from "@/app/kalkulator/page";
import MatchingPage from "@/app/matching/page";

type Tab = "kalkulator" | "matching";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "kalkulator", label: "Kalkulátor", icon: "🧮" },
  { key: "matching", label: "Zhody", icon: "🔗" },
];

function NastrojeInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get("tab");
  const tab: Tab = (TABS.find(t => t.key === raw)?.key) || "kalkulator";

  return (
    <div>
      <div style={{
        display: "flex", gap: "6px", marginBottom: "20px",
        borderBottom: "1px solid var(--border)",
      }}>
        {TABS.map(t => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => router.push(`${pathname}?tab=${t.key}`)}
              style={{
                padding: "10px 18px", borderRadius: "10px 10px 0 0",
                border: "none", background: active ? "var(--bg-elevated)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "13px", fontWeight: active ? 700 : 500, cursor: "pointer",
                borderBottom: active ? "2px solid var(--accent, #3B82F6)" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <span style={{ marginRight: "6px" }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "kalkulator" && <KalkulatorPage />}
      {tab === "matching" && <MatchingPage />}
    </div>
  );
}

export default function NastrojePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Načítavam...</div>}>
      <NastrojeInner />
    </Suspense>
  );
}
