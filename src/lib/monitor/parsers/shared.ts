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
  "realit", "estate", "broker", "property",
  // Typické slovenské RK formulácie
  "exkluzívn", "v zastúpení", "v ponuke", "ponúkame",
  "provízia rk", "provizia rk", "+ provízia", "+ provizia",
  "cena + provízia", "cena + provizia",
  " rk ", " rk:", "naša kancelária",
  // Známe slovenské RK brandy (často ako prefix v názve inzerátu)
  "herrys", "mikelssen", "re/max", "remax", "century 21",
  "lexxus", "trigon", "sapientia", "bond reality",
  "frank zicher", "fincentrum", "vianema",
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
