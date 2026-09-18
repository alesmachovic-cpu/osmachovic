import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteView from "@/components/web/SiteView";
import { loadNastavenia, loadSites, toRefs } from "@/lib/web/db";
import type { SiteData } from "@/lib/web/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

function describe(d: SiteData): string {
  return d.typ === "manazer" ? d.lede : d.sub;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const sites = await loadSites().catch(() => []);
  const site = sites.find(s => s.slug === slug && s.published);
  if (!site?.published) return { title: "Web nenájdený · Vianema" };
  const d = site.published;
  return {
    title: `${d.name} · Vianema`,
    description: describe(d),
    openGraph: { title: `${d.name} · Vianema`, description: describe(d), images: d.portrait ? [d.portrait] : [] },
    robots: { index: true, follow: true },
  };
}

/** Verejný web makléra / manažéra — zobrazuje publikovanú verziu. */
export default async function WebPage({ params }: Params) {
  const { slug } = await params;
  const [sites, nastavenia] = await Promise.all([loadSites(), loadNastavenia()]);
  const site = sites.find(s => s.slug === slug);
  if (!site || !site.published) notFound();
  return <SiteView site={site} data={site.published} refs={toRefs(sites, "published")} nastavenia={nastavenia} />;
}
