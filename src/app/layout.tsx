import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <Sidebar />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
      </body>
    </html>
  );
}
