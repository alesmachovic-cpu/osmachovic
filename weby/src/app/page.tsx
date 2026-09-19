import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SiteView from "@/components/SiteView";
import { loadNastavenia, loadSites, normalizeHost, toRefs } from "@/lib/db";
import NotPublished from "@/components/NotPublished";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = normalizeHost((await headers()).get("host"));
  const site = (await loadSites().catch(() => [])).find(s => s.domain === host);
  if (!site?.published) return { title: "Vianema" };
  const d = site.published;
  const desc = d.typ === "manazer" ? d.lede : d.sub;
  return { title: `${d.name} · Vianema`, description: desc, openGraph: { title: `${d.name} · Vianema`, description: desc, images: d.portrait ? [`https://${host}${d.portrait.startsWith("/") ? d.portrait : "/" + d.portrait}`] : [] } };
}

/**
 * Koreň domény. Každý maklér má vlastnú doménu → ukáže sa jeho publikovaný web.
 * Na hlavnej doméne (PRIMARY_HOST) alebo neznámej doméne presmeruje do adminu.
 */
export default async function RootPage() {
  const host = normalizeHost((await headers()).get("host"));
  const sites = await loadSites();
  const site = sites.find(s => s.domain === host);
  if (!site) redirect("/admin");
  if (!site.published) return <NotPublished />;
  const nastavenia = await loadNastavenia();
  return <SiteView site={site} data={site.published} refs={toRefs(sites, "published")} nastavenia={nastavenia} />;
}
