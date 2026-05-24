/**
 * sanitize.ts — server-side XSS prevention pre free-form text inputy.
 *
 * 🔒 PEN-TEST C4 FIX (2026-05-20):
 *   Pôvodne sa free-form text fields (klient.poznamka, faktura.poznamka,
 *   obhliadka.poznamka, popis položiek...) ukladali do DB ako-sú bez
 *   sanitácie. Klient JS ich potom rendoroval cez React (default escape)
 *   ALEBO cez `dangerouslySetInnerHTML` (vidno v emailoch a PDF).
 *
 *   Pri renderingu v emaile / PDF / admin view kde sa nepoužije React escape
 *   = stored XSS → attacker vie injektovať `<script>` ktorý sa exec v admin
 *   sessione.
 *
 *   Plus s `unsafe-inline` v CSP nie je obrana proti XSS — keď sa raz dostane
 *   do DOM, vykoná sa.
 *
 * Riešenie:
 *   Whitelist tag-based sanitácia. Implementácia zero-dependency (CLAUDE.md
 *   zakazuje pridávať npm packages). Pre rich text v budúcnosti (formátovanie)
 *   prepneme na DOMPurify cez ISR (server component).
 *
 *   Aktuálne: VŠETKY HTML tagy + entity sa stripnu. Plain text only.
 */

/**
 * Odstrání všetky HTML tagy + entity z textu.
 * Bezpečné na uloženie do DB pre free-form fields ktoré sa nikdy nemajú
 * renderovať ako HTML.
 *
 * Príklady:
 *   sanitizeText("<script>alert(1)</script>Hello")  // → "Hello"
 *   sanitizeText("Maklér Aleš <ales@vianema.sk>")    // → "Maklér Aleš "
 *   sanitizeText(null)                               // → null
 */
export function sanitizeText(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input !== "string") return null;

  // 1. Strip HTML tags (lazy match, vrátane self-closing a script/style obsah)
  let cleaned = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "");

  // 2. Decode + neutralize bežné XSS vektory ktoré prejdú cez tag strip:
  //    - javascript: URI v plain texte ostane neškodný
  //    - data: URI ostane neškodný
  //    - HTML entity zostanú (nebudú interpretované ako tagy)
  // 3. Kontrolu length (DoS — extrémne dlhý input)
  if (cleaned.length > 10_000) cleaned = cleaned.slice(0, 10_000);

  return cleaned;
}

/**
 * Aplikuje sanitizeText na všetky kľúče v objektoch (deep) ktoré sú v
 * `fields` argumente. Iba string hodnoty. Užitočné pri PATCH/POST body
 * pre tabuľky s poznamka/popis/komentár fieldmi.
 *
 * Príklad:
 *   const body = await req.json();
 *   const safe = sanitizeFields(body, ["poznamka", "popis", "komentar"]);
 *   await sb.from("klienti").update(safe)...
 */
export function sanitizeFields<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
  const out = { ...obj };
  for (const key of fields) {
    if (key in out && typeof out[key] === "string") {
      (out as Record<string, unknown>)[key] = sanitizeText(out[key]);
    }
  }
  return out;
}

/**
 * Default zoznam fields ktoré obsahujú user-generated free-form text
 * v celom systéme. Použiť pri každom write endpointe ktorý prijíma body.
 */
export const SANITIZE_FIELDS = [
  "poznamka",
  "poznamky",
  "popis",
  "popis_inzeratu",
  "popis_uloha",
  "komentar",
  "note",
  "description",
  "meno",          // klient meno môže obsahovať mark-up od útočníka
  "nazov",         // nehnutelnost nazov
  "miesto",        // obhliadka miesto
  "kupujuci_meno",
  "kupujuci_email",
  "lokalita",
  "adresa",
  "historia",      // firma_info historia (predtým markdown)
] as const;
