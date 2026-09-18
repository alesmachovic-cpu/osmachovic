import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import AppShell from "@/components/AppShell";

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
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
