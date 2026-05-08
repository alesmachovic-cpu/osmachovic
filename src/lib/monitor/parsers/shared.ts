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

/**
 * Extrahuje číslo poschodia z kontextového textu.
 * Príklady: "4. poschodie", "4/8", "posch. 3", "4p", "prízemie", "podkrovie"
 * Vracia normalizovaný string napr. "4/8", "prízemie", "4"
 */
export function extractPoschodie(text: string): string | undefined {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t.includes("prizemie") || t.includes("prizemne")) return "prízemie";
  if (t.includes("podkrovie") || t.includes("podkrovne")) return "podkrovie";
  if (t.includes("suteren") || t.includes("polosuteren")) return "suterén";
  // "4/8 poschodí", "4. poschodie", "4 poschodie"
  const m1 = t.match(/(\d+)\s*\/\s*(\d+)\s*poschod/);
  if (m1) return `${m1[1]}/${m1[2]}`;
  const m2 = t.match(/(\d+)\s*[\.\s]?\s*p(?:oschodie|oschod|\.)/);
  if (m2) return m2[1];
  // "poschodie 4" alebo "p. 4"
  const m3 = t.match(/poschod[^\d]{0,5}(\d+)/);
  if (m3) return m3[1];
  return undefined;
}

/**
 * Extrahuje stav nehnuteľnosti z kontextového textu.
 * Vracia jeden z normalizovaných stavov pre analýzy.
 */
export function extractStav(text: string): string | undefined {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (t.includes("novostavba") || t.includes("nova stavba")) return "novostavba";
  if (t.includes("po rekonstrukcii") || t.includes("kompletna rekonstrukcia") || t.includes("plna rekonstrukcia")) return "po rekonštrukcii";
  if (t.includes("ciastocna rekonstrukcia") || t.includes("ciastocne zrekon")) return "čiastočná rekonštrukcia";
  if (t.includes("povodni stav") || t.includes("povodny stav") || t.includes("originalny stav")) return "pôvodný stav";
  if (t.includes("vyborny stav") || t.includes("perfektny stav") || t.includes("luxusny stav")) return "výborný stav";
  if (t.includes("dobry stav") || t.includes("zachovaly stav")) return "dobrý stav";
  if (t.includes("na rekonstrukciu") || t.includes("vyzaduje rekonstrukciu") || t.includes("potrebuje rekonstrukciu")) return "na rekonštrukciu";
  if (t.includes("developer") || t.includes("developersky")) return "novostavba";
  return undefined;
}
