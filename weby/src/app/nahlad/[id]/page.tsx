import { notFound } from "next/navigation";
import SiteView from "@/components/SiteView";
import { loadNastavenia, loadSites, toRefs } from "@/lib/db";
import { canEditSite, currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ dark?: string }> };

/** Náhľad rozpracovanej verzie (iframe v admine). Vyžaduje prihlásenie a prístup k webu. */
export default async function NahladPage({ params, searchParams }: Params) {
  const { id } = await params;
  const { dark } = await searchParams;
  const user = await currentUser();
  if (!user) notFound();
  const [sites, nastavenia] = await Promise.all([loadSites(), loadNastavenia()]);
  const site = sites.find(s => s.id === id);
  if (!site || !(user.role === "admin" || canEditSite(user, site))) notFound();
  return <SiteView site={site} data={site.draft} refs={toRefs(sites, "draft")} nastavenia={nastavenia} preview dark={dark === "1"} />;
}
