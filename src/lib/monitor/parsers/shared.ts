/* ── Shared helpers pre monitor parsery ── */

// Markery ktoré indikujú firmu/realitku v texte inzerátu alebo v mene predajcu.
// Používajú sa prefixy/sub-stringy bezpečné voči false positive v slovenskom texte
// (napr. "realit" chytí "reality", "realitná", "realitka", ale nie bežné slová).
const FIREMNE_MARKERY: readonly string[] = [
  "s.r.o", "s. r. o", "a.s.", "a. s.", "spol.",
  "realit", "invest", "group", "estate", "broker", "property",
  "exkluzívn", "v zastúpení", "v ponuke", "ponúkame",
  " rk ", " rk:", "naša kancelária",
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
