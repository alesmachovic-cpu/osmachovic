import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/** Fonty šablón sú self-hostované cez next/font (CSP povoľuje len 'self'). */
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-fraunces", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin", "latin-ext"], weight: ["400", "600"], variable: "--font-source-sans", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], weight: ["500", "700", "800"], variable: "--font-bricolage", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: "Vianema · weby maklérov",
  description: "Osobné weby maklérov Vianema",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className={`${fraunces.variable} ${sourceSans.variable} ${bricolage.variable} ${plex.variable}`}>
      <head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /></head>
      <body>{children}</body>
    </html>
  );
}
