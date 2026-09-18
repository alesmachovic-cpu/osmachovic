import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import SiteView from "@/components/web/SiteView";
import { loadNastavenia, loadSites, toRefs } from "@/lib/web/db";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ dark?: string }> };

/**
 * Náhľad rozpracovanej (draft) verzie webu — používa ho iframe v admine.
 * Vyžaduje platnú CRM session cookie (crm_session), inak 404.
 */
export default async function NahladPage({ params, searchParams }: Params) {
  const { id } = await params;
  const { dark } = await searchParams;
  const jar = await cookies();
  const session = verifySession(jar.get(SESSION_COOKIE_NAME)?.value);
  if (!session) notFound();

  const [sites, nastavenia] = await Promise.all([loadSites(), loadNastavenia()]);
  const site = sites.find(s => s.id === id);
  if (!site) notFound();
  return <SiteView site={site} data={site.draft} refs={toRefs(sites, "draft")} nastavenia={nastavenia} preview dark={dark === "1"} />;
}
