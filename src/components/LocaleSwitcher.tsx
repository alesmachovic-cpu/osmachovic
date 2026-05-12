"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n";

const LOCALE_LABELS: Record<Locale, string> = {
  sk: "🇸🇰 Slovenčina",
  cs: "🇨🇿 Čeština",
  en: "🇬🇧 English",
};

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function setLocale(locale: Locale) {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {LOCALES.map((loc) => (
        <button
          key={loc}
          disabled={pending || loc === current}
          onClick={() => setLocale(loc)}
          style={{
            padding: "6px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: loc === current ? "var(--accent)" : "var(--bg-card)",
            color: loc === current ? "#fff" : "var(--text-primary)",
            fontSize: "13px",
            fontWeight: loc === current ? 600 : 400,
            cursor: loc === current ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
            transition: "all 0.15s",
          }}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
