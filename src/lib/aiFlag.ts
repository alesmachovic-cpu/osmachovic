/**
 * Kill-switch pre AI parsovanie dokumentov (#8 rollback).
 *
 * Keď je env `AI_PARSE_ENABLED=false`, parse routes preskočia volanie AI a
 * vrátia signál, že používateľ má vyplniť údaje ručne. Vypnutie = zmena env
 * premennej vo Vercel + redeploy (config zmena, ŽIADNY revert kódu/diffu →
 * rýchlejšia a bezpečnejšia poistka ak by Claude začal vracať nezmysly alebo
 * padať v produkcii).
 *
 * Default (premenná nenastavená alebo čokoľvek iné než "false") = zapnuté.
 */
export function aiParseDisabled(): boolean {
  return process.env.AI_PARSE_ENABLED === "false";
}

/** Telo odpovede keď je AI parsing vypnutý (HTTP 503). */
export const AI_DISABLED_BODY = {
  error: "AI spracovanie dokumentov je dočasne vypnuté. Vyplňte údaje ručne.",
  code: "AI_DISABLED",
} as const;
