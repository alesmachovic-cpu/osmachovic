/* ── Klasifikátor predajcu (sukromny | rk | unknown) — v2 ──
 *
 * Pôvodný klasifikátor mal len 2 naivné pravidlá:
 *   - rule_scraper: bazos.sk → vždy "sukromny" s confidence 0.7
 *   - rule_keywords: pár fráz v názve s confidence 0.7
 * To produkovalo veľa false positive na oboch stranách (Mgr. Marek Kohútik
 * na bazose dostal "sukromny", developerský SKY PARK na reality.sk dostal
 * "sukromny" cez slovo "ponuka", a väčšina reality.sk listings ostala NULL).
 *
 * v2 pristup:
 *   1. Vyhodnotí súbor signálov (POSITIVE_SUKROMNY a POSITIVE_RK).
 *   2. Každý signál má váhu (0..1). Súčet váh sa konvertuje na confidence
 *      cez logistic squash 1/(1+e^-2x).
 *   3. Ak |skore| nie je dostatočne presvedčivé, vráti "unknown".
 *   4. Vráti aj zoznam signálov ktoré rozhodli (audit / "prečo?" UI).
 *
 * Návrhové ciele:
 *   - žiadny síťový I/O (čisto deterministické pravidlá nad existujúcimi
 *     fields ScrapedInzerat + voliteľný kontext z DB).
 *   - testovateľné: classify(input) je čistá funkcia.
 *   - ľahko rozšíriteľné: pridať signál = pridať položku do SIGNALS arraya.
 */

export type PredajcaTyp = "sukromny" | "rk" | "unknown";

/** Kontext z DB ktorý classifier môže (nemusí) dostať. Bez neho fallne na 0 váhu pre frequency-based pravidlá. */
export interface ClassifierDbContext {
  /** Počet aktívnych inzerátov za posledných 30 dní s rovnakým telefónom. */
  phone_count_30d?: number;
  /** Počet aktívnych inzerátov za posledných 30 dní s rovnakým menom predajcu. */
  name_count_30d?: number;
  /** Či je rovnaký inzerát (canonical_id) publikovaný na 2+ portáloch. */
  listed_on_n_portals?: number;
  /** Manuálne zaradenie do RK — z tabuľky rk_directory podľa telefónu / mena / domény. */
  in_rk_directory?: boolean;
}

export interface ClassifierInput {
  portal: string;
  nazov?: string | null;
  popis?: string | null;
  predajca_meno?: string | null;
  predajca_telefon?: string | null;
  lokalita?: string | null;
  raw_data?: Record<string, unknown> | null;
  db?: ClassifierDbContext;
}

export interface ClassifierSignal {
  /** ID signálu — krátky stabilný kľúč pre logy a UI. */
  id: string;
  /** Čo signál tvrdí: "rk" ↑ skóre RK, "sukromny" ↑ skóre súkromníka. */
  side: "rk" | "sukromny";
  /** Váha 0..1 — koľko priberie skóre. */
  weight: number;
  /** Človeku čitateľný popis pre tooltip "prečo bol takto klasifikovaný". */
  reason: string;
  /** Voliteľne: matched fragment, doména, frekvencia atď. */
  evidence?: string;
}

export interface ClassifierResult {
  predajca_typ: PredajcaTyp;
  /** 0..1 — istota výsledku (1 = úplne istý, 0.5 = stredná, < 0.55 = unknown). */
  confidence: number;
  /** Surové skóre (kladné = RK, záporné = súkromník); pre debug. */
  raw_score: number;
  /** Všetky aktivované signály. */
  signals: ClassifierSignal[];
  /** Hash schémy pre rollover ak meníme váhy (audit, A/B). */
  method: "v2";
}

/** Hranica pre rozhodnutie. |confidence - 0.5| < 0.05 → unknown. */
const CONFIDENCE_DECISION_THRESHOLD = 0.55;

/** Logistic squash z raw skóre na confidence v intervale (0,1). */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/* ────────────────── PRAVIDLÁ ────────────────── */

const ACADEMIC_TITLE_RE = /^\s*(mgr\.?|ing\.?|judr\.?|bc\.?|mba\.?|phd\.?|rndr\.?|mudr\.?|paeddr\.?|prof\.?|doc\.?)\s+/i;

/** Známe RK domény (e-mail / web v popise). Striktný zoznam — len overené slovenské RK. */
const KNOWN_RK_DOMAINS: readonly string[] = [
  "remax.sk", "re-max.sk", "century21.sk", "century-21.sk",
  "herrys.sk", "lexxus.sk", "trigon.sk", "sapientia.sk",
  "bondreality.sk", "bond-reality.sk", "frankzicher.sk", "fincentrum.sk",
  "vianema.eu", "vianema.sk",
  "globalreal.sk", "globreal.sk", "hyposervis.sk",
  "firstreal.sk", "topreality.sk", "homereality.sk",
  "idealreality.sk", "slovreality.sk", "dreamreality.sk",
  "directreality.sk", "privatreality.sk", "goldreality.sk", "bestreality.sk",
  "reals.sk", "reality.sk",
  // generický CDN signál — keď fotky pochádzajú z agentúrnej domény
  "cdn.realitka.sk", "cdn.reality.sk",
];

/** Striktné RK frázy ktoré v súkromnom inzeráte v praxi nenachádzame. */
const STRONG_RK_PHRASES: readonly string[] = [
  "s.r.o", "s. r. o", "a.s.", "a. s.", "spol.",
  "realitná kancelária", "realitna kancelaria",
  "realitný maklér", "realitny makler",
  "provízia rk", "provizia rk", "+ provízia", "+ provizia",
  "plus provízia", "plus provizia",
  "cena + provízia", "cena + provizia",
  "výhradné zastúpenie", "vyhradne zastupenie",
  "výhradný predaj", "vyhradny predaj",
  "naša spoločnosť", "nasa spolocnost",
  "naša kancelária", "nasa kancelaria",
  "v ponuke našej", "v ponuke nasej",
  "id inzerátu", "id inzeratu",
  "profi klient",
  "ico:", "ičo:", "ic dph",
];

/** Mäkšie RK indikátory — sám o sebe slabý signál, ale v kombinácii s inými poskytuje dôkaz. */
const SOFT_RK_PHRASES: readonly string[] = [
  "exkluzívne", "exkluzivne",
  "prestížnej rezidencii", "prestiznej rezidencii",
  "v prestížnom", "v prestiznom",
  "ponúkame", "ponukame",
  "ponúkame na predaj", "ponukame na predaj",
  "ponúkame vám", "ponukame vam",
  "ponúkame Vám",
  "kontaktujte ma", "kontaktujte nás", "kontaktujte nas",
  "rezervovať obhliadku", "rezervovat obhliadku",
];

/** Marketingové prefixy v názve typické pre RK na reality.sk / topreality.sk. */
const MARKETING_PREFIX_RE = /^\s*(top|exkluzívne|exkluzivne|exkluzívna|exkluzivna|na predaj|predaj|ponúkame|ponukame|profi klient|hit|super|luxusný|luxusny)\b/i;

/** Známe developerské projekty — ak je v názve, ide takmer vždy o RK / developera. */
const KNOWN_DEVELOPER_PROJECTS: readonly string[] = [
  "sky park", "skypark", "eurovea", "panorama city", "panorama-city",
  "stein", "klingerka", "nivy tower", "nivy-tower",
  "slnečnice", "slnecnice", "petržalka city", "petrzalka city",
  "rezidencia oaza", "metropolis", "westend gate",
  "fuxova", "kolíska", "koliska", "rosen residence",
  "tatra residence", "park ostrava", "matadorka",
  "nuppu", "ovocné sady", "ovocne sady",
];

/** 1. osoba slovesá indikujúce súkromného predajcu — silný indikátor. */
const FIRST_PERSON_VERBS: readonly string[] = [
  "predám", "predam", "prenajmem", "prenajimam",
  "ponúkam svoj", "ponukam svoj",
  "bývam", "byvam", "vlastním", "vlastnim",
  "som vlastník", "som vlastnik", "som majiteľ", "som majitel",
  "presťahoval som sa", "prestahoval som sa",
  "rodina sa nám rozrástla", "rodina sa nam rozrastla",
  "kupujem", "kupujem si",
];

/* ────────────────── HELPER FUNKCIE ────────────────── */

function lowerJoin(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function extractEmailDomain(text: string): string | null {
  const m = text.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/i);
  return m ? m[1].toLowerCase() : null;
}

function extractIco(text: string): string | null {
  // Slovenské IČO = 8 číslic. Matchneme len ak pred ním nie je číslo (aby sme
  // nezachytili fragment dlhšieho čísla — napr. PSČ + číslo bytu).
  const m = text.match(/(?<!\d)(\d{8})(?!\d)/);
  return m ? m[1] : null;
}

function rkDomainMatch(text: string): string | null {
  const lower = text.toLowerCase();
  return KNOWN_RK_DOMAINS.find((d) => lower.includes(d)) ?? null;
}

function strongRkPhraseMatch(text: string): string | null {
  const lower = text.toLowerCase();
  return STRONG_RK_PHRASES.find((p) => lower.includes(p)) ?? null;
}

function softRkPhraseMatch(text: string): string | null {
  const lower = text.toLowerCase();
  return SOFT_RK_PHRASES.find((p) => lower.includes(p)) ?? null;
}

function developerProjectMatch(text: string): string | null {
  const lower = text.toLowerCase();
  return KNOWN_DEVELOPER_PROJECTS.find((p) => lower.includes(p)) ?? null;
}

function firstPersonMatch(text: string): string | null {
  const lower = text.toLowerCase();
  return FIRST_PERSON_VERBS.find((v) => lower.includes(v)) ?? null;
}

/* ────────────────── HLAVNÁ FUNKCIA ────────────────── */

export function classify(input: ClassifierInput): ClassifierResult {
  const signals: ClassifierSignal[] = [];
  const haystack = lowerJoin(input.nazov, input.popis, input.predajca_meno, input.lokalita);
  const nazov = input.nazov || "";
  const popis = input.popis || "";

  /* ── A) NAJSILNEJŠIE INDIKÁTORY RK (váhy 0.6 – 1.0) ── */

  // A1. Manuálny RK directory (override z minulosti pre rovnaký telefón / e-mail / meno).
  // Najsilnejší signál — človek to manuálne potvrdil, rešpektujeme to nad ostatnými indikátormi.
  if (input.db?.in_rk_directory) {
    signals.push({
      id: "rk_directory",
      side: "rk",
      weight: 1.5,
      reason: "Predajca je v evidencii rk_directory (manuálny override).",
    });
  }

  // A2. Známa RK doména (e-mail/web v popise alebo raw_data).
  const rkDomain = rkDomainMatch(haystack) ?? rkDomainMatch(JSON.stringify(input.raw_data || {}));
  if (rkDomain) {
    signals.push({
      id: "rk_domain",
      side: "rk",
      weight: 0.9,
      reason: `Známa RK doména v popise/raw: ${rkDomain}`,
      evidence: rkDomain,
    });
  }

  // A3. IČO (alebo "IČO:") v popise — jasný firemný signál.
  const icoLine = popis.match(/i[cč]o\s*[:\-]?\s*(\d{8})/i);
  if (icoLine) {
    signals.push({
      id: "rk_ico",
      side: "rk",
      weight: 0.85,
      reason: `IČO v popise: ${icoLine[1]}`,
      evidence: icoLine[0],
    });
  } else {
    // Voľný 8-ciferný kód v popise (môže byť IČO, ale aj PSČ — slabšia váha)
    const ico = extractIco(popis);
    if (ico) {
      signals.push({
        id: "rk_ico_free",
        side: "rk",
        weight: 0.4,
        reason: `8-ciferný kód v popise (možné IČO): ${ico}`,
        evidence: ico,
      });
    }
  }

  // A4. Striktná RK fráza ("provízia RK", "s.r.o", "realitná kancelária", "PROFI KLIENT" atď.)
  const strongPhrase = strongRkPhraseMatch(haystack);
  if (strongPhrase) {
    signals.push({
      id: "rk_strong_phrase",
      side: "rk",
      weight: 0.85,
      reason: `Striktná RK fráza: „${strongPhrase}"`,
      evidence: strongPhrase,
    });
  }

  // A5. Známy developerský projekt v názve (SKY PARK, Eurovea, Stein...).
  const devProject = developerProjectMatch(nazov);
  if (devProject) {
    signals.push({
      id: "rk_developer_project",
      side: "rk",
      weight: 0.75,
      reason: `Známy developerský projekt v názve: „${devProject}"`,
      evidence: devProject,
    });
  }

  // A6. Cross-portal — ten istý canonical_id na 2+ portáloch ⇒ takmer vždy RK
  // (súkromník neuverejnuje paralelne na bazos + nehnutelnosti + reality).
  if ((input.db?.listed_on_n_portals ?? 1) >= 2) {
    signals.push({
      id: "rk_multi_portal",
      side: "rk",
      weight: 0.7,
      reason: `Inzerát publikovaný cez ${input.db?.listed_on_n_portals} portálov.`,
      evidence: String(input.db?.listed_on_n_portals),
    });
  }

  /* ── B) STREDNÉ INDIKÁTORY RK (váhy 0.3 – 0.5) ── */

  // B1. Telefón sa vyskytuje vo viacerých inzerátoch za posledných 30 dní —
  // čím viac, tým silnejší signál RK.
  const phoneCount = input.db?.phone_count_30d ?? 0;
  if (phoneCount >= 5) {
    signals.push({
      id: "rk_phone_volume_high",
      side: "rk",
      weight: 0.7,
      reason: `Rovnaký telefón je v ${phoneCount} aktívnych inzerátoch za 30 dní.`,
      evidence: String(phoneCount),
    });
  } else if (phoneCount >= 3) {
    signals.push({
      id: "rk_phone_volume_med",
      side: "rk",
      weight: 0.5,
      reason: `Rovnaký telefón v ${phoneCount} inzerátoch za 30 dní.`,
      evidence: String(phoneCount),
    });
  } else if (phoneCount === 2) {
    signals.push({
      id: "rk_phone_volume_low",
      side: "rk",
      weight: 0.25,
      reason: `Rovnaký telefón v 2 inzerátoch za 30 dní.`,
      evidence: "2",
    });
  }

  // B2. Meno sa vyskytuje vo viacerých inzerátoch (ak nemáme tel, lebo bazos ho má len v detail page).
  const nameCount = input.db?.name_count_30d ?? 0;
  if (nameCount >= 4) {
    signals.push({
      id: "rk_name_volume",
      side: "rk",
      weight: 0.5,
      reason: `Rovnaké meno predajcu v ${nameCount} inzerátoch za 30 dní.`,
      evidence: String(nameCount),
    });
  } else if (nameCount === 3) {
    signals.push({
      id: "rk_name_volume_low",
      side: "rk",
      weight: 0.3,
      reason: `Rovnaké meno predajcu v 3 inzerátoch za 30 dní.`,
      evidence: "3",
    });
  }

  // B3. Akademický titul v mene (Mgr., Ing., JUDr., Bc.). Slabší samostatný signál,
  // ale v kombinácii s frekvenciou alebo marketingovým textom je presvedčivý.
  if (input.predajca_meno && ACADEMIC_TITLE_RE.test(input.predajca_meno)) {
    const titleMatch = input.predajca_meno.match(ACADEMIC_TITLE_RE);
    signals.push({
      id: "rk_academic_title",
      side: "rk",
      weight: 0.35,
      reason: `Akademický titul v mene predajcu: „${titleMatch?.[1]}"`,
      evidence: titleMatch?.[1] || "",
    });
  }

  // B4. Marketingový prefix v názve (TOP, EXKLUZÍVNE, PONÚKAME, PROFI KLIENT...).
  const marketing = nazov.match(MARKETING_PREFIX_RE);
  if (marketing) {
    signals.push({
      id: "rk_marketing_prefix",
      side: "rk",
      weight: 0.4,
      reason: `Marketingový prefix v názve: „${marketing[0].trim()}"`,
      evidence: marketing[0].trim(),
    });
  }

  // B5. reality.sk lokalita má prefix "Reality " (typický pre štruktúru tohto portálu).
  if (input.portal === "reality.sk" && input.lokalita?.toLowerCase().startsWith("reality ")) {
    signals.push({
      id: "rk_reality_prefix_lokalita",
      side: "rk",
      weight: 0.2,
      reason: `Lokalita má prefix „Reality " (typické pre RK na reality.sk).`,
    });
  }

  // B6. Mäkšia RK fráza ("exkluzívne", "ponúkame", "kontaktujte ma" atď.).
  const softPhrase = softRkPhraseMatch(haystack);
  if (softPhrase) {
    signals.push({
      id: "rk_soft_phrase",
      side: "rk",
      weight: 0.3,
      reason: `Marketingová RK fráza: „${softPhrase}"`,
      evidence: softPhrase,
    });
  }

  /* ── C) INDIKÁTORY SÚKROMNÍKA (váhy 0.3 – 0.7) ── */

  // C1. 1. osoba sloveso v popise ("predám", "prenajmem", "vlastním", "bývam").
  const fpVerb = firstPersonMatch(popis);
  if (fpVerb) {
    signals.push({
      id: "sukromny_first_person",
      side: "sukromny",
      weight: 0.7,
      reason: `1. osoba v popise: „${fpVerb}"`,
      evidence: fpVerb,
    });
  }

  // C2. Bazos.sk + iba krstné meno alebo meno+priezvisko bez titulu — slabý signál pre súkromníka.
  // (silný defaultný indikátor je samotný portál bazos, ale len v kombinácii s ďalšími).
  if (input.portal === "bazos.sk") {
    const meno = input.predajca_meno?.trim() || "";
    const hasTitle = ACADEMIC_TITLE_RE.test(meno);
    const wordCount = meno.split(/\s+/).filter(Boolean).length;
    // Bazos default indikátor — slabý, ale nenulový
    if (!hasTitle && wordCount >= 1 && wordCount <= 3) {
      signals.push({
        id: "sukromny_bazos_default",
        side: "sukromny",
        weight: 0.35,
        reason: `Bazos.sk inzerát s osobným menom (${wordCount} slov, bez titulu).`,
      });
    }
  }

  // C3. Telefón sa vyskytuje len v 1 inzeráte za 30 dní (ak máme dáta) — silný signál pre súkromníka.
  if (typeof input.db?.phone_count_30d === "number" && phoneCount === 1) {
    signals.push({
      id: "sukromny_phone_unique",
      side: "sukromny",
      weight: 0.45,
      reason: `Telefón unikátny — len 1 inzerát za 30 dní.`,
    });
  }

  // C4. Krátky popis bez RK fráz — typické pre súkromníka.
  if (popis.length > 0 && popis.length < 200 && !strongPhrase && !softPhrase && !rkDomain) {
    signals.push({
      id: "sukromny_short_clean_desc",
      side: "sukromny",
      weight: 0.2,
      reason: `Krátky popis (< 200 znakov) bez RK fráz/domén.`,
    });
  }

  /* ── D) AGREGÁCIA ── */

  let raw = 0;
  for (const s of signals) {
    raw += s.side === "rk" ? s.weight : -s.weight;
  }

  // Konvertuj raw na confidence cez sigmoid s strmosťou 2.0 — silný 1.0 signál
  // → conf ~0.76 (jasné rozhodnutie), 2× silné signály ~0.95 (vysoká istota).
  const conf01 = sigmoid(raw * 2.0);
  // confidence v zmysle "ako istý si výsledkom" — vždy v intervale [0.5, 1.0]
  const confidence = Math.abs(conf01 - 0.5) * 2;

  let predajca_typ: PredajcaTyp;
  if (signals.length === 0) {
    predajca_typ = "unknown";
  } else if (conf01 >= CONFIDENCE_DECISION_THRESHOLD) {
    predajca_typ = "rk";
  } else if (conf01 <= 1 - CONFIDENCE_DECISION_THRESHOLD) {
    predajca_typ = "sukromny";
  } else {
    predajca_typ = "unknown";
  }

  return {
    predajca_typ,
    confidence: Math.round(confidence * 100) / 100,
    raw_score: Math.round(raw * 100) / 100,
    signals,
    method: "v2",
  };
}

/** Mapovanie nového v2 výstupu na pôvodný DB enum (sukromny/firma/null). */
export function toLegacyDbEnum(typ: PredajcaTyp): "sukromny" | "firma" | null {
  if (typ === "rk") return "firma";
  if (typ === "sukromny") return "sukromny";
  return null; // unknown
}
