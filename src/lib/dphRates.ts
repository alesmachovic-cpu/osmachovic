/**
 * dphRates.ts — DPH sadzby pre slovenské faktúry.
 *
 * Zdroj: zákon 222/2004 Z.z. o DPH.
 *   - Do 31.12.2025: základná sadzba 20 %.
 *   - Od 1.1.2026:  základná sadzba 23 % (zmena schválená NR SR 2024).
 *   - Znížené sadzby: 10 % (knihy, lieky, vybrané potraviny), 5 % (špecifické tovary).
 *
 * Použitie:
 *   - VIANEMA momentálne nie je platiteľ DPH → `dph: 0` na faktúrach.
 *   - Akonáhle sa stane platiteľom, použiť `getDphRate(date)` pre dátum
 *     dodania zdaniteľného plnenia.
 *
 * Funkcia vyberá sadzbu podľa dátumu vystavenia/dodania (DPH § 19 ods. 2 —
 * dátum vzniku daňovej povinnosti rozhoduje, ktorá sadzba sa aplikuje).
 */

export const DPH_RATES = {
  /** Základná sadzba — efektívne dátumy historicky. */
  ZAKLADNA: [
    { from: "2026-01-01", rate: 0.23 }, // zákon č. ?/2024
    { from: "2011-01-01", rate: 0.20 }, // novela
    { from: "1993-01-01", rate: 0.23 }, // pôvodná
  ] as const,
  /** Znížená 10 % — knihy, lieky, vybrané potraviny. */
  ZNIZENA_10: 0.10,
  /** Znížená 5 % — vybrané sociálne tovary / služby. */
  ZNIZENA_5: 0.05,
} as const;

/** Vráti základnú DPH sadzbu platnú k danému dátumu (ISO string YYYY-MM-DD). */
export function getDphRate(dateIso: string): number {
  // Vyber najnovšiu z platných sadzieb (zoradené od najnovšej v poli).
  for (const r of DPH_RATES.ZAKLADNA) {
    if (dateIso >= r.from) return r.rate;
  }
  return DPH_RATES.ZAKLADNA[DPH_RATES.ZAKLADNA.length - 1].rate;
}

/** Aktuálna sadzba — convenience helper. */
export function getCurrentDphRate(): number {
  return getDphRate(new Date().toISOString().slice(0, 10));
}

/** Vypočíta DPH z ceny bez DPH. */
export function calcDph(sumaBezDph: number, rate: number = getCurrentDphRate()): number {
  return Math.round(sumaBezDph * rate * 100) / 100;
}

/** Vypočíta cenu bez DPH z ceny s DPH. */
export function calcBezDph(sumaSDph: number, rate: number = getCurrentDphRate()): number {
  return Math.round((sumaSDph / (1 + rate)) * 100) / 100;
}
