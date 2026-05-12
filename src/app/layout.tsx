import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import BottomTabs from "@/components/BottomTabs";
import SidebarOverlay from "@/components/SidebarOverlay";
import AuthProvider from "@/components/AuthProvider";

// Inter ako primárny font — latin-ext potrebný pre slovenské diakritiky
// (č, š, ž, ľ, ť, á, í, é). Brand komponenty (Logo, Wordmark, Monogram,
// VianemaBranded, ...) hardcodujú "Inter, system-ui, ..." v štýle.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Tier 1 — klient-facing browser tab. Vianema first, AMGD as system whisper.
  title: "VIANEMA Real — Realitný Systém",
  description: "Inteligentný realitný CRM pre Vianema Real · Powered by AMGD",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "VIANEMA",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('dragover', function(e) { e.preventDefault(); });
          document.addEventListener('drop', function(e) { e.preventDefault(); });
          (function() {
            function applyTheme() {
              var h = new Date().getHours();
              var isDark = h >= 20 || h < 6;
              if (isDark) {
                document.documentElement.classList.add('dark');
                document.documentElement.style.backgroundColor = '#1C1C1E';
                document.documentElement.style.colorScheme = 'dark';
              } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.style.backgroundColor = '#F5F5F7';
                document.documentElement.style.colorScheme = 'light';
              }
            }
            applyTheme();
            setInterval(applyTheme, 60000);
          })();
        `}} />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
