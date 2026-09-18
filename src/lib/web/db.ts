/**
 * Server-side prístup k tabuľkám webov (service role — obchádza RLS).
 * Používajú ho verejné stránky (/web/[slug]), náhľad a API.
 */
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Nastavenia, SiteData, WebSite } from "./types";
import { DEFAULT_NASTAVENIA } from "./defaults";
import type { SiteRef } from "@/components/web/SiteView";

export async function loadNastavenia(): Promise<Nastavenia> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("web_nastavenia").select("data").eq("id", "default").maybeSingle();
  return { ...DEFAULT_NASTAVENIA, ...((data?.data as Partial<Nastavenia>) || {}) };
}

export async function loadSites(): Promise<WebSite[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("web_sites").select("*").order("poradie").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as WebSite[];
}

/**
 * Referencie na ostatné weby pre prelinkovanie tímu.
 * `mode = "published"` — verejný web vidí len publikované verzie ostatných.
 * `mode = "draft"`     — náhľad vidí rozpracované verzie (aby manažér videl, ako to bude vyzerať).
 */
export function toRefs(sites: WebSite[], mode: "published" | "draft"): SiteRef[] {
  return sites
    .map(s => {
      const data: SiteData | null = mode === "published" ? s.published : (s.draft || s.published);
      if (!data) return null;
      return { id: s.id, slug: s.slug, typ: s.typ, data, isPublished: !!s.published };
    })
    .filter((x): x is SiteRef => !!x);
}
