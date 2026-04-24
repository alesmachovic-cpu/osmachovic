/* ── Shared helpers pre monitor parsery ── */

// Markery ktoré indikujú firmu/realitku v texte inzerátu alebo v mene predajcu.
// Používajú sa prefixy/sub-stringy bezpečné voči false positive v slovenskom texte
// (napr. "realit" chytí "reality", "realitná", "realitka", ale nie bežné slová).
// Zámerne NEobsahujú "invest"/"group" — slová "investícia"/"investor" sú bežné
// v súkromných inzerátoch ("ideálne na investíciu", "pre investora").
// Zoznam STRIKTNÝCH markerov RK — len také kombinácie slov, ktoré sa vo
// vzájomnom kontexte prakticky v súkromnom inzeráte nevyskytujú. Viac „generic"
// slov (ako "realit", "v ponuke", "maklér") sa falošne vyskytujú aj v navigácii
// bazos.sk / reality.sk a označovali by všetky listings ako firma.
const FIREMNE_MARKERY: readonly string[] = [
  // Právne formy — jednoznačne firma
  "s.r.o", "s. r. o", "a.s.", "a. s.", "spol.",
  // Realitná kancelária ako celé slovné spojenie
  "realitná kancelária", "realitna kancelaria",
  // Provízia — viackrát s RK
  "provízia rk", "provizia rk",
  "provízia pre rk", "provizia pre rk",
  "+ provízia", "+ provizia",
  "plus provízia", "plus provizia",
  "cena + provízia", "cena + provizia",
  "cena +provízia", "cena +provizia",
  "maklera prosim nekontaktuj", "makléra prosím nekontaktuj",
  "rk prosim nekontaktuj", "rk prosím nekontaktuj",
  "+rk", "+ rk",
  // Známe slovenské RK brandy (dobré označenie lebo sa používajú v názve inzerátu)
  "herrys", "mikelssen", "re/max", "remax", "century 21", "century21",
  "lexxus", "trigon", "sapientia", "bond reality", "bondreality",
  "frank zicher", "fincentrum", "vianema",
  "globalreal", "globál real", "hyposervis",
  "first real", "top reality", "home reality",
  "ideal reality", "ideál reality", "slov reality",
  "dream reality", "direct reality", "privat reality",
  "gold reality", "best reality",
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
