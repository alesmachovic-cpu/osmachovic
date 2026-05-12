"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";

export default function BottomTabs() {
  const pathname = usePathname();
  const t = useTranslations("nav.items");
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  const tabs = [
    { label: t("home"), href: "/", icon: "🏠" },
    { label: t("portfolio"), href: "/portfolio", icon: "🏘️" },
    { label: t("klienti"), href: "/klienti?tab=predavajuci", icon: "👥", matchPrefix: "/klienti" },
    { label: t("operativa"), href: "/operativa?tab=obhliadky", icon: "📅", matchPrefix: "/operativa" },
    { label: t("more"), href: "/nastavenia", icon: "⋯" },
  ];

  useEffect(() => {
    // Watch the <main> scroll container, fallback to window
    const target =
      (document.querySelector("main") as HTMLElement | null) ?? window;

    function onScroll() {
      const y =
        target instanceof Window
          ? window.scrollY
          : (target as HTMLElement).scrollTop;
      const delta = y - lastY.current;
      if (Math.abs(delta) < 8) return;
      if (delta > 0 && y > 40) setHidden(true);   // scroll down → hide
      else setHidden(false);                       // scroll up → show
      lastY.current = y;
    }

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <nav
      className="bottom-tabs"
      style={{
        display: "none",
        position: "fixed",
        left: "50%",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        transform: `translate(-50%, ${hidden ? "140%" : "0"})`,
        zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "saturate(180%) blur(24px)",
        WebkitBackdropFilter: "saturate(180%) blur(24px)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "999px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        padding: "8px 10px",
        gap: "2px",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s",
        opacity: hidden ? 0 : 1,
      }}
    >
      {tabs.map((t) => {
        const prefix = (t as { matchPrefix?: string }).matchPrefix || t.href.split("?")[0];
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(prefix);
        return (
          <Link
            key={t.label}
            href={t.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: "999px",
              background: active ? "#374151" : "transparent",
              color: active ? "#fff" : "var(--text-secondary)",
              transition: "all 0.2s",
              minWidth: "52px",
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.02em" }}>
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
