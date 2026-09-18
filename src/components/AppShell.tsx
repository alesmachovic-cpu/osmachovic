"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import BottomTabs from "@/components/BottomTabs";
import SidebarOverlay from "@/components/SidebarOverlay";

/** Verejné cesty bez CRM chrome (sidebar, navbar, bottom tabs) a bez prihlásenia. */
export const PUBLIC_PREFIXES = ["/web/"];

export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

/**
 * Obal aplikácie: pre CRM stránky vykreslí sidebar + navbar + main,
 * pre verejné weby (/web/...) vráti len obsah bez chrome.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isPublicPath(pathname)) return <>{children}</>;

  return (
    <>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* Desktop sidebar */}
        <div className="sidebar-desktop">
          <Sidebar />
        </div>
        {/* Mobile sidebar overlay + drawer */}
        <SidebarOverlay />
        <div className="sidebar-mobile" style={{ display: "none" }}>
          <Sidebar />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <Navbar />
          <main
            style={{
              flex: 1,
              overflow: "auto",
              background: "var(--bg-base)",
              padding: "24px 28px",
            }}
          >
            {children}
          </main>
        </div>
      </div>
      <BottomTabs />
    </>
  );
}
