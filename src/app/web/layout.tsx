import type { Metadata } from "next";
import { Fraunces, Source_Sans_3, Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";

/**
 * Layout verejných webov maklérov. Fonty sú self-hostované cez next/font
 * (CSP povoľuje len 'self' pre style-src/font-src). Chrome CRM-ka (sidebar,
 * navbar) skrýva AppShell podľa cesty /web/*.
 */
const fraunces = Fraunces({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-fraunces", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin", "latin-ext"], weight: ["400", "600"], variable: "--font-source-sans", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], weight: ["500", "700", "800"], variable: "--font-bricolage", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: "Vianema · web makléra",
  robots: { index: true, follow: true },
};

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${sourceSans.variable} ${bricolage.variable} ${plex.variable}`}>
      {children}
    </div>
  );
}
