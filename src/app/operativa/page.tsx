"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import ObhliadkyPage from "@/app/obhliadky/page";
import NakladyPage from "@/app/naklady/page";
import KalendarPage from "@/app/kalendar/page";

type Tab = "obhliadky" | "naklady" | "kalendar";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "obhliadky", label: "Obhliadky", icon: "👁️" },
  { key: "naklady", label: "Náklady", icon: "💰" },
  { key: "kalendar", label: "Kalendár", icon: "📅" },
];

function OperativaInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get("tab");
  const tab: Tab = (TABS.find(t => t.key === raw)?.key) || "obhliadky";

  return (
    <div>
      {/* Tab strip */}
      <div style={{
        display: "flex", gap: "6px", marginBottom: "20px",
        borderBottom: "1px solid var(--border)", paddingBottom: "0",
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

      {tab === "obhliadky" && <ObhliadkyPage />}
      {tab === "naklady" && <NakladyPage />}
      {tab === "kalendar" && <KalendarPage />}
    </div>
  );
}

export default function OperativaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Načítavam...</div>}>
      <OperativaInner />
    </Suspense>
  );
}
