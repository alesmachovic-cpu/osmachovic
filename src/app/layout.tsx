import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import BottomTabs from "@/components/BottomTabs";
import SidebarOverlay from "@/components/SidebarOverlay";
import AuthProvider from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Machovič CRM — Realitný Systém",
  description: "Inteligentný systém pre správu klientov a nehnuteľností",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('dragover', function(e) { e.preventDefault(); });
          document.addEventListener('drop', function(e) { e.preventDefault(); });
          (function() {
            function applyTheme() {
              var h = new Date().getHours();
              if (h >= 20 || h < 6) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            }
            applyTheme();
            setInterval(applyTheme, 60000);
          })();
        `}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
