import { distanceKm } from "./geocode";

export type ObjednavkaForMatch = {
  id: string;
  klient_id: string;
  druh: string | string[] | null;
  poziadavky: Record<string, unknown> | null;
  lokalita: { kraje?: string[]; okresy?: string[]; obec?: string; okres?: string } | string[] | null;
  cena_od: number | null;
  cena_do: number | null;
  lat?: number | null;
  lng?: number | null;
};

export type NehnutelnostForMatch = {
  id: string;
  klient_id: string | null;
  typ: string | null;
  cena: number | null;
  plocha: number | null;
  izby: number | null;
  lokalita: string | null;
  kraj: string | null;
  okres: string | null;
  status: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type KlientForMatch = {
  id: string;
  lokalita: string | null;
  rozpocet_max: number | null;
};

export type MatchResult = {
  score: number;
  reasons: string[];
};

export function vypocitajSkore(
  o: ObjednavkaForMatch,
  n: NehnutelnostForMatch,
  klient?: KlientForMatch,
): MatchResult {
  // Neaktívne nehnuteľnosti nedostanú skóre (null = legacy aktívna)
  if (n.status && n.status !== "aktivny") return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  // Typ nehnuteľnosti
  if (o.druh && n.typ) {
    // druh môže byť pole, alebo spojený string ("byt, rodinny_dom") z ObjednavkaForm
    // → splitneme rovnako ako form, inak multi-druh nikdy nesedí (handoff 2026-06-06).
    const druhArr = Array.isArray(o.druh)
      ? o.druh
      : o.druh.split(/[,/]/).map(s => s.trim()).filter(Boolean);
    const typLow = n.typ.toLowerCase();
    const typMatch = druhArr.some(d => {
      const dLow = d.toLowerCase();
      return dLow === typLow || dLow.includes(typLow) || typLow.includes(dLow);
    });
    if (typMatch) {
      score += 25;
      reasons.push("Typ nehnuteľnosti sedí");
    }
  }

  // Cena v rozpočte. maxCena = cena_do objednávky; ak objednávka nemá hornú
  // hranicu, padáme na rozpočet klienta (rozpocet_max). Prekročenie rozpočtu
  // má stupňovaný postih — symetricky k lokalite/izbám, inak by drahé
  // nehnuteľnosti vychádzali ako dobrá zhoda (Aleš 2026-06-06).
  const maxCena = o.cena_do ?? klient?.rozpocet_max ?? null;
  const minCena = o.cena_od ?? null;
  if (maxCena && n.cena != null) {
    if (minCena && n.cena < minCena) {
      // Pod dolnou hranicou rozpočtu — kupujúci chce drahšie (iná kategória).
      // Len malý bonus, nie plný — nie je to "v rozpočte" ako zamýšľal (handoff 2026-06-06).
      score += 8;
      reasons.push("Cena pod očakávaným rozsahom");
    } else if (n.cena <= maxCena) {
      score += 30;
      reasons.push("Cena je v rozpočte");
    } else if (n.cena <= maxCena * 1.1) {
      score += 12;
      reasons.push("Cena mierne nad rozpočtom");
    } else if (n.cena <= maxCena * 1.25) {
      score -= 20;
      reasons.push("Cena nad rozpočtom (+10–25 %)");
    } else if (n.cena <= maxCena * 1.5) {
      score -= 40;
      reasons.push("Cena výrazne nad rozpočtom (+25–50 %)");
    } else {
      score -= 60;
      reasons.push("Cena mimo rozpočtu (>50 %)");
    }
  }

  // Lokalita z objednávky
  const rawLok = o.lokalita;
  let objLokality: string[] = [];
  if (Array.isArray(rawLok)) {
    objLokality = rawLok;
  } else if (rawLok) {
    const lok = rawLok as { kraje?: string[]; okresy?: string[]; obec?: string; okres?: string };
    objLokality = [
      ...(lok.kraje ?? []),
      ...(lok.okresy ?? []),
      ...(lok.obec ? [lok.obec] : []),
      ...(lok.okres ? [lok.okres] : []),
    ];
  }

  // 🌍 GEO-AWARE matching (Aleš 2026-05-22): ak má objednávka aj nehnuteľnosť
  // GPS súradnice, počítame haversine vzdialenosť. Bližšie = vyššie skóre.
  // Toto rieši "Petržalka-Háje → Dvory 1km lepšie ako Dúbravka 7km lepšie ako Senec 20km".
  let geoApplied = false;
  if (o.lat != null && o.lng != null && n.lat != null && n.lng != null) {
    const km = distanceKm(o.lat, o.lng, n.lat, n.lng);

    if (km <= 1) {
      score += 25;
      reasons.push(`Presne v lokalite (${km.toFixed(1)} km)`);
    } else if (km <= 3) {
      score += 18;
      reasons.push(`Blízko (${km.toFixed(1)} km)`);
    } else if (km <= 7) {
      score += 10;
      reasons.push(`V okolí (${km.toFixed(1)} km)`);
    } else if (km <= 15) {
      score += 2;
      reasons.push(`V meste/okrese (${km.toFixed(0)} km)`);
    } else if (km <= 50) {
      score -= 30;
      reasons.push(`Mimo mesta (${km.toFixed(0)} km od preferencie)`);
    } else {
      score -= 60;
      reasons.push(`Iný región (${km.toFixed(0)} km od preferencie)`);
    }
    geoApplied = true;
  }

  // Fallback na text-based lokalita matching, ak GPS nie sú dostupné.
  const nLok = [n.lokalita, n.kraj, n.okres].filter(Boolean).join(" ").toLowerCase();
  if (!geoApplied && objLokality.length > 0 && nLok) {
    const match = objLokality.some(lok => {
      const ll = lok.toLowerCase().trim();
      if (!ll || ll.length < 2) return false;
      return nLok.includes(ll);
    });
    if (match) {
      score += 25;
      reasons.push("Lokalita zodpovedá");
    } else {
      // 🐛 BUG FIX 2026-05-22: predtým bola lokalita nezhoda bez postihu, takže
      // klient čo chce Žilinu dostal 65% na Bratislavskej ponuke. Teraz strict postih.
      score -= 50;
      reasons.push(`Lokalita NEZODPOVEDÁ (klient chce ${objLokality.slice(0, 2).join(", ")})`);
    }
  } else if (!geoApplied && klient?.lokalita && nLok) {
    const kWords = klient.lokalita.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
    const overlap = kWords.some(w => nLok.includes(w));
    if (overlap) {
      score += 25;
      reasons.push("Lokalita zodpovedá (z profilu)");
    } else if (kWords.length > 0) {
      score -= 40;
      reasons.push(`Lokalita NEZODPOVEDÁ profilu (${klient.lokalita})`);
    }
  }

  // Izby z požiadaviek — postih ak nesedí.
  // ObjednavkaForm ukladá izby ako pole stringov (["3"]), DB stĺpec n.izby je
  // number → normalizujeme na čísla. Inak `includes` nikdy nesedí a správny
  // počet izieb dostane postih namiesto bonusu (bug fix 2026-06-06).
  if (o.poziadavky && n.izby != null) {
    const poz = o.poziadavky;
    const izbyVal = poz.izby ?? poz.pocet_izieb ?? poz.rooms;
    const rawArr = Array.isArray(izbyVal) ? izbyVal : (izbyVal != null ? [izbyVal] : []);
    const izbyArr = rawArr
      .map(v => (typeof v === "number" ? v : parseInt(String(v), 10)))
      .filter(v => Number.isFinite(v));
    if (izbyArr.length > 0) {
      if (izbyArr.includes(n.izby)) {
        score += 10;
        reasons.push(`${n.izby}-izbový vyhovuje`);
      } else {
        const odchylka = Math.min(...izbyArr.map(i => Math.abs(i - n.izby!)));
        if (odchylka === 1) {
          score -= 15;
          reasons.push(`${n.izby}-izbový (klient chce ${izbyArr.join("/")}i)`);
        } else {
          score -= 30;
          reasons.push(`${n.izby}-izbový mimo preferencie (klient chce ${izbyArr.join("/")}i)`);
        }
      }
    }
  }

  // Cap 0–100
  return { score: Math.max(0, Math.min(score, 100)), reasons };
}

export type SkoreUroven = "vyborna" | "dobra" | "slaba";

/**
 * Jednotné prahy skóre pre celý matching UI — jeden zdroj pravdy.
 * Komponenty si na úroveň mapujú vlastné farby (light karty vs dark widget),
 * ale prah (kedy je zhoda výborná/dobrá/slabá) je všade rovnaký.
 */
export function skoreUroven(s: number): SkoreUroven {
  if (s >= 80) return "vyborna";
  if (s >= 50) return "dobra";
  return "slaba";
}
