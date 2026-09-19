/**
 * Supabase klient so service_role kľúčom — len na serveri. Tabuľky majú prefix
 * `weby_`, takže projekt môže zdieľať Supabase s inou aplikáciou bez kolízií.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Nastavenia, SiteData, WebSite } from "./types";
import { siteUrl } from "./types";
import { DEFAULT_NASTAVENIA } from "./defaults";
import type { SiteRef } from "@/components/SiteView";

let _sb: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!_sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Chýba NEXT_PUBLIC_SUPABASE_URL alebo SUPABASE_SERVICE_ROLE_KEY");
    _sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return _sb;
}

export async function loadNastavenia(): Promise<Nastavenia> {
  const { data } = await sb().from("weby_settings").select("data").eq("id", "default").maybeSingle();
  return { ...DEFAULT_NASTAVENIA, ...((data?.data as Partial<Nastavenia>) || {}) };
}

export async function loadSites(): Promise<WebSite[]> {
  const { data, error } = await sb().from("weby_sites").select("*").order("poradie").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as WebSite[];
}

/** Referencie na ostatné weby (prelinkovanie tímu). */
export function toRefs(sites: WebSite[], mode: "published" | "draft"): SiteRef[] {
  return sites
    .map(s => {
      const data: SiteData | null = mode === "published" ? s.published : (s.draft || s.published);
      if (!data) return null;
      return { id: s.id, slug: s.slug, url: siteUrl(s), typ: s.typ, data, isPublished: !!s.published };
    })
    .filter((x): x is SiteRef => !!x);
}

/** Normalizovaný host bez portu a bez www. */
export function normalizeHost(host: string | null | undefined): string {
  return String(host || "").toLowerCase().split(":")[0].replace(/^www\./, "");
}
