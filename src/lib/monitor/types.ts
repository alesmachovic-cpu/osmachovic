/* ── Typy pre Realitný Monitor ── */

export interface ScrapedInzerat {
  portal: string;
  external_id: string;
  url: string;
  nazov: string;
  typ?: string;
  lokalita?: string;
  cena?: number;
  mena?: string;
  plocha?: number;
  izby?: number;
  popis?: string;
  foto_url?: string;
  predajca_meno?: string;
  predajca_telefon?: string;
  predajca_typ?: string; // 'sukromny' | 'realitka' | 'developer'
  raw_data?: Record<string, unknown>;
}

export interface MonitorFilter {
  id: string;
  nazov: string;
  portal: string;
  typ?: string | null;
  lokalita?: string | null;
  cena_od?: number | null;
  cena_do?: number | null;
  plocha_od?: number | null;
  plocha_do?: number | null;
  izby_od?: number | null;
  izby_do?: number | null;
  klucove_slova?: string | null;
  search_url?: string | null;
  notify_email: boolean;
  notify_telegram: boolean;
  is_active: boolean;
  makler_id?: string | null;
}

export interface ScrapeResult {
  portal: string;
  status: "success" | "error" | "timeout";
  total_found: number;
  new_count: number;
  updated_count: number;
  duration_ms: number;
  error_msg?: string;
}

export interface PortalParser {
  portal: string;
  buildSearchUrl(filter: MonitorFilter): string;
  parseListings(html: string): ScrapedInzerat[];
}
