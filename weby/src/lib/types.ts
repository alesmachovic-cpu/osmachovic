/**
 * Weby maklérov — dátový model.
 *
 * Každý web (maklér alebo manažér) je jeden riadok v `web_sites`:
 *   - `draft`      — rozpracovaná verzia (admin ju edituje, autosave)
 *   - `published`  — verejne viditeľná verzia (kópia draftu po „Publikovať")
 * Spoločné texty pobočky sú v `web_nastavenia` (jeden riadok, id = 'default').
 */

export type WebTyp = "makler" | "manazer";

export type PaletteId = "park" | "hrad" | "piesky" | "kamzik" | "mesto" | "fatra" | "dunaj";
export type SkyId = "ba" | "zl";

export const PALETTES: Record<PaletteId, { label: string; acc: string }> = {
  park:   { label: "Horský park (šalviová)",      acc: "#4F6F52" },
  hrad:   { label: "Hrad (tehlová)",              acc: "#9B3B2E" },
  piesky: { label: "Zlaté piesky (jantárová)",    acc: "#B0681A" },
  kamzik: { label: "Kamzík (lesná)",              acc: "#2F5D3A" },
  mesto:  { label: "Nové Mesto (tyrkysová)",      acc: "#157A7A" },
  fatra:  { label: "Malá Fatra (grafit a zlato)", acc: "#8A6A1E" },
  dunaj:  { label: "Dunaj (modrá)",               acc: "#1B5E7B" },
};

export const SKIES: Record<SkyId, string> = {
  ba: "Bratislava (hrad, UFO, Slavín)",
  zl: "Malá Fatra (hory, Budatín)",
};

export type SectionId = "ako" | "ponuky" | "omne" | "tim" | "videa" | "referencie" | "predane" | "ocenenie" | "lokality";

export const SECTIONS_MAKLER: Array<[SectionId, string]> = [
  ["ponuky", "Ponuky"], ["omne", "O mne"], ["tim", "Tím"], ["videa", "Videá"],
  ["referencie", "Referencie"], ["predane", "Predané"], ["ocenenie", "Ocenenie (formulár)"], ["lokality", "Lokality"],
];
export const SECTIONS_MANAZER: Array<[SectionId, string]> = [
  ["ako", "Ako pracujem"], ["ponuky", "Ponuky"], ["omne", "O mne"], ["videa", "Videá"],
  ["referencie", "Referencie"], ["predane", "Predané"], ["ocenenie", "Ocenenie (formulár)"], ["lokality", "Lokality"], ["tim", "Tím"],
];

export interface Listing { type: string; title: string; price: string; meta: string; photo: string; url: string }
export interface Sold { type: string; loc: string; days: string; year: string }
export interface Review { text: string; author: string }
export interface Pair { b: string; s: string }
export interface Step { n: string; h: string; p: string }

/** Spoločné polia oboch šablón. */
export interface SiteBase {
  name: string;
  role: string;
  phone: string;
  email: string;
  ig: string;
  googleUrl: string;
  listingsUrl: string;
  portrait: string;
  listings: Listing[];
  sold: Sold[];
  reviews: Review[];
  videos: string[];
  areas: string[];
  sections: Partial<Record<SectionId, boolean>>;
}

/** Web makléra (šablóna Vianema). */
export interface MaklerData extends SiteBase {
  typ: "makler";
  palette: PaletteId;
  sky: SkyId;
  hero: string;
  headline: string;
  sub: string;
  trust: Pair[];
  bio1: string;
  bio2: string;
  chips: string[];
  team: boolean;
  branch: string;
}

/** Web manažéra pobočky (vlastná šablóna). */
export interface ManazerData extends SiteBase {
  typ: "manazer";
  eyebrow: string;
  h1: string;
  h1em: string;
  lede: string;
  igHandle: string;
  yt: string;
  logo: string;
  address: string;
  facts: Pair[];
  stepsTitle: string;
  steps: Step[];
  big: string;
  bio1: string;
  bio2: string;
  soldNote: string;
  teamTitle: string;
  teamText: string;
  valText: string;
  doneText: string;
}

export type SiteData = MaklerData | ManazerData;

export interface Nastavenia {
  line: string;
  url: string;
  asOf: string;
  gdpr: string;
  videosNote: string;
  areasNote: string;
  manazerSlug: string;
}

/** Riadok tabuľky weby_sites. */
export interface WebSite {
  id: string;
  slug: string;
  typ: WebTyp;
  domain: string | null;
  user_id: string | null;
  poradie: number;
  draft: SiteData;
  published: SiteData | null;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface WebDopyt {
  id: string;
  site_id: string | null;
  site_slug: string;
  data: Record<string, string>;
  vybavene: boolean;
  created_at: string;
}

export type Role = "admin" | "makler";

/** Používateľ adminu (weby_users). `admin` vidí všetky weby, `makler` len svoj. */
export interface WebUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  last_login_at: string | null;
}

/** Verejná adresa webu: vlastná doména, inak cesta /s/slug na hlavnej doméne. */
export function siteUrl(site: { slug: string; domain: string | null }): string {
  return site.domain ? `https://${site.domain}` : `/s/${site.slug}`;
}

export function sectionOn(d: SiteData, key: SectionId): boolean {
  return !d.sections || d.sections[key] !== false;
}

export function telFrom(phone: string): string {
  return String(phone || "").replace(/[^\d+]/g, "");
}

export function initials(n: string): string {
  return String(n || "")
    .replace(/^(Ing\.|Mgr\.|Bc\.|JUDr\.|MUDr\.)\s*/, "")
    .split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export function slugify(s: string): string {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^(Ing|Mgr|Bc|JUDr|MUDr)\.\s*/, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "web";
}
