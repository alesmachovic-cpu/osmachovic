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

/** Normalizuj text: lowercase, bez diakritiky. */
function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Extrahuje počet izieb z textu (názov + popis). Sanity hranice 1–9.
 * Pokrýva: "3-izb", "3 izb", "3i", "3izb", slovné (jedno/dvoj/troj/štvor/päť-izbový),
 * "garsónka" → 1. Vracia undefined ak sa nedá spoľahlivo určiť.
 */
export function extractIzby(text: string): number | undefined {
  const t = norm(text);
  // Slovné číslovky pred "izb"
  const slovne: Array<[RegExp, number]> = [
    [/garson|garzon|1\s*\+\s*kk|jednoizb/, 1],
    [/dvojizb/, 2], [/trojizb/, 3], [/stvorizb/, 4], [/patizb/, 5], [/sestizb/, 6],
  ];
  for (const [re, n] of slovne) if (re.test(t)) return n;
  // "N-izb", "N izb", "Nizb" (N = 1..9)
  const m1 = t.match(/\b([1-9])\s*[-\s]?\s*izb/);
  if (m1) return parseInt(m1[1]);
  // "Ni" tesne (napr. "3i 68m2") — len ak za ním NEnasleduje písmeno (aby sme
  // nechytili napr. "3input"); a len malé N (1..7).
  const m2 = t.match(/\b([1-7])\s*i\b/);
  if (m2) return parseInt(m2[1]);
  // "N + kk" / "N+1"
  const m3 = t.match(/\b([1-6])\s*\+\s*(?:kk|1)\b/);
  if (m3) return parseInt(m3[1]);
  return undefined;
}

/**
 * Extrahuje úžitkovú plochu (m²) z textu. Sanity hranice 8–3000 m².
 * Preferuje číslo bezprostredne pred "m²"/"m2". Vracia undefined ak mimo hraníc.
 */
export function extractPlocha(text: string): number | undefined {
  const t = norm(text);
  // Všetky výskyty "<číslo> m²/m2" — jednotka POVINNÁ (inak by "200 m od lesa"
  // vyzeralo ako plocha). Akceptuje m2, m², m^2.
  const re = /(\d{1,4}(?:[.,]\d+)?)\s*m\s*(?:2|²|\^2)/g;
  let m: RegExpExecArray | null;
  const candidates: number[] = [];
  while ((m = re.exec(t)) !== null) {
    const n = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(n) && n >= 8 && n <= 3000) candidates.push(n);
  }
  // Ak je viac kandidátov (napr. plocha + pozemok), vezmeme najmenší rozumný
  // (úžitková plocha bytu/domu býva menšia ako plocha pozemku v tom istom inzeráte).
  if (candidates.length > 0) return Math.min(...candidates);
  return undefined;
}

/**
 * Odvodí typ nehnuteľnosti (byt/dom/pozemok/iny) z textu (názov/slug/popis).
 * Poradie: pozemok → dom → byt → iny. Slovné hranice znižujú false-positive
 * (napr. "nábytok" neobsahuje \bbyt).
 */
export function extractTyp(text: string): "byt" | "dom" | "pozemok" | "iny" {
  const t = norm(text);
  // 1) Dom (skôr ako pozemok — „rodinný dom + pozemok 800 m²" je dom so záhradou).
  if (/(rodinny dom|rodinneho domu|\bdom\b|\bdomu\b|\bdome\b|chalup|\bchata\b|\bchaty\b|\bvila\b|\bvily\b|dvojdom|radovy dom)/.test(t)) return "dom";
  // 2) Pozemok (len keď to nie je dom).
  if (/(\bpozemok\b|\bpozemky\b|\bpozemku\b|parcela|orna poda|stavebny pozemok)/.test(t)) return "pozemok";
  // 3) Byt — kľúčové slová alebo počet izieb (Ni / N-izb) ⇒ takmer vždy byt.
  if (/\bbyt/.test(t) || /izbov/.test(t) || /garson|garzon|apartman|mezonet/.test(t)
      || /\b[1-9]\s*-?\s*izb/.test(t) || /\b[1-7]\s*i\b/.test(t)) return "byt";
  return "iny";
}
