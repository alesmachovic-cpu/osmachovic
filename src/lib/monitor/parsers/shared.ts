/* ── Shared helpers pre monitor parsery ── */

// Markery ktoré indikujú firmu/realitku v texte inzerátu alebo v mene predajcu.
// Používajú sa prefixy/sub-stringy bezpečné voči false positive v slovenskom texte
// (napr. "realit" chytí "reality", "realitná", "realitka", ale nie bežné slová).
// Zámerne NEobsahujú "invest"/"group" — slová "investícia"/"investor" sú bežné
// v súkromných inzerátoch ("ideálne na investíciu", "pre investora").
const FIREMNE_MARKERY: readonly string[] = [
  // Právne formy
  "s.r.o", "s. r. o", "a.s.", "a. s.", "spol.",
  // Anglické / medzinárodné
  "realit", "estate", "broker", "property", "agency", "agentúra",
  // Typické slovenské RK formulácie — ponuka / sprostredkovanie
  "exkluzívn", "v zastúpení", "v ponuke", "ponúkame", "na predaj ponúkame",
  "ponúka na predaj", "ponúka vám", "ponúka klientom",
  "pre klienta hľadáme", "pre nášho klienta", "našej klientke",
  "sprostredkúvame", "sprostredkovanie", "realitný servis",
  // Makléri / kancelária
  "maklér", "maklerka", "realitný agent", "realitný maklér",
  "realitná kancelária", "realitna kancelaria",
  "naša kancelária", "nasa kancelaria",
  "naši klienti", "naš i klienti", "naši spokojní klienti",
  // Provízia / poplatky
  "provízia rk", "provizia rk",
  "provízia pre rk", "provizia pre rk",
  "+ provízia", "+ provizia",
  "plus provízia", "plus provizia",
  "cena + provízia", "cena + provizia",
  "cena +provízia", "cena +provizia",
  "vrátane provízie", "vratane provizie",
  "+rk", "+ rk",
  " rk ", " rk:", " rk,", " rk.",
  // Typické procesné frázy RK
  "právny servis", "pravny servis",
  "kompletný servis", "kompletny servis",
  "komplexný servis", "komplexny servis",
  "technická obhliadka", "technicka obhliadka",
  "virtuálna prehliadka", "virtualna prehliadka",
  "3d obhliadka", "home staging",
  "overujeme právny stav", "overujeme pravny stav",
  // Známe slovenské RK brandy (často ako prefix v názve inzerátu)
  "herrys", "mikelssen", "re/max", "remax", "century 21", "century21",
  "lexxus", "trigon", "sapientia", "bond reality", "bondreality",
  "frank zicher", "fincentrum", "vianema",
  "globalreal", "globál real", "hyposervis",
  "first real", "top reality", "home reality",
  "ideal reality", "ideál reality", "slov reality",
  "ng reality", "my reality", "vila real",
  "dream reality", "direct reality", "privat reality",
  "gold reality", "new reality", "best reality",
];

/**
 * Vráti true ak niektorý z textových fragmentov obsahuje firemný marker.
 * Case-insensitive. undefined/null hodnoty sú ignorované.
 */
export function detectFirma(...parts: Array<string | undefined | null>): boolean {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  if (!text) return false;
  return FIREMNE_MARKERY.some((m) => text.includes(m));
}
