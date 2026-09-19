import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteView from "@/components/SiteView";
import NotPublished from "@/components/NotPublished";
import { loadNastavenia, loadSites, toRefs } from "@/lib/db";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = (await loadSites().catch(() => [])).find(s => s.slug === slug);
  if (!site?.published) return { title: "Vianema", robots: { index: false } };
  const d = site.published;
  const desc = d.typ === "manazer" ? d.lede : d.sub;
  return { title: `${d.name} · Vianema`, description: desc, openGraph: { title: `${d.name} · Vianema`, description: desc, images: d.portrait ? [d.portrait] : [] } };
}

/** Web makléra na ceste /s/[slug] — pre maklérov bez vlastnej domény a ako záložná adresa. */
export default async function SlugPage({ params }: Params) {
  const { slug } = await params;
  const [sites, nastavenia] = await Promise.all([loadSites(), loadNastavenia()]);
  const site = sites.find(s => s.slug === slug);
  if (!site) notFound();
  if (!site.published) return <NotPublished />;
  return <SiteView site={site} data={site.published} refs={toRefs(sites, "published")} nastavenia={nastavenia} />;
}
