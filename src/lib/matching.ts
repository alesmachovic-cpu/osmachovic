/**
 * Matching algoritmus — párovanie kupujúcich s nehnuteľnosťami.
 *
 * Skóre 0–100 podľa kritérií:
 *   - Typ nehnuteľnosti (+25): druh objednávky vs typ inzerátu
 *   - Rozpočet (+30 / +12): cena ≤ rozpočet (alebo do 110% mierna tolerancia)
 *   - Lokalita (+25): zhoda lokalít z objednávky alebo klienta
 *   - Izby (+10): počet izieb v poziadavkach
 *   - Aktívna objednávka (+10): bonus za vyplnenú objednávku
 *
 * Použitie:
 *   import { calcMatch } from "@/lib/matching";
 *   const result = calcMatch(klient, nehnutelnost, objednavky);
 */

import type { Klient, Nehnutelnost } from "@/lib/database.types";

export interface MatchObjednavka {
  id: string;
  klient_id: string;
  druh: string | null;
  poziadavky: Record<string, unknown> | null;
  lokalita: string[] | null;
  cena_do: number | null;
}

export interface MatchResult {
  score: number;
  reasons: string[];
  obj: MatchObjednavka | null;
}

export function calcMatch(
  k: Klient,
  n: Nehnutelnost,
  objednavky: MatchObjednavka[]
): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  if (k.typ !== "kupujuci" && k.typ !== "oboje") return { score: 0, reasons: [], obj: null };

  const obj = objednavky.find((o) => o.klient_id === k.id) ?? null;

  // Typ nehnuteľnosti z objednávky
  if (obj?.druh && n.typ) {
    const druhLower = obj.druh.toLowerCase();
    const typLower = String(n.typ).toLowerCase();
    if (druhLower === typLower || druhLower.includes(typLower) || typLower.includes(druhLower)) {
      score += 25;
      reasons.push("Typ nehnuteľnosti sedí");
    }
  }

  // Rozpočet
  const maxCena = obj?.cena_do ?? k.rozpocet_max;
  if (maxCena && n.cena != null) {
    if (n.cena <= maxCena) {
      score += 30;
      reasons.push("Cena je v rozpočte");
    } else if (n.cena <= maxCena * 1.1) {
      score += 12;
      reasons.push("Cena mierne nad rozpočtom");
    }
  }

  // Lokalita
  const objLokality = obj?.lokalita ?? [];
  if (objLokality.length > 0 && n.lokalita) {
    const nLow = String(n.lokalita).toLowerCase();
    const match = objLokality.some((lok) => {
      const lokLow = lok.toLowerCase();
      return nLow.includes(lokLow) || lokLow.includes(nLow);
    });
    if (match) {
      score += 25;
      reasons.push("Lokalita zodpovedá");
    }
  } else if (k.lokalita && n.lokalita) {
    const kWords = k.lokalita.toLowerCase().split(/[\s,]+/);
    const nWords = String(n.lokalita).toLowerCase().split(/[\s,]+/);
    const overlap = kWords.some((w) => nWords.some((nw) => nw.includes(w) || w.includes(nw)));
    if (overlap) {
      score += 25;
      reasons.push("Lokalita zodpovedá");
    }
  }

  // Izby z požiadaviek
  if (obj?.poziadavky && n.izby != null) {
    const poz = obj.poziadavky;
    const izbyArr = (poz.izby ?? poz.pocet_izieb ?? poz.rooms) as number[] | undefined;
    if (Array.isArray(izbyArr) && izbyArr.includes(Number(n.izby))) {
      score += 10;
      reasons.push(`${n.izby}-izbový vyhovuje`);
    }
  }

  // Bonus za aktívnu objednávku
  if (obj) {
    score += 10;
    reasons.push("Má objednávku");
  }

  return { score: Math.min(score, 100), reasons, obj };
}

export function fmtCena(c: number | null | undefined): string {
  if (c == null) return "—";
  return c >= 1000 ? `${Math.round(c / 1000)}k €` : `${c} €`;
}
