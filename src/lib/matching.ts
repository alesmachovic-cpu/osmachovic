export type ObjednavkaForMatch = {
  id: string;
  klient_id: string;
  druh: string | string[] | null;
  poziadavky: Record<string, unknown> | null;
  lokalita: { kraje?: string[]; okresy?: string[]; obec?: string; okres?: string } | string[] | null;
  cena_od: number | null;
  cena_do: number | null;
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
    const druhArr = Array.isArray(o.druh) ? o.druh : [o.druh];
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

  // Cena v rozpočte
  const maxCena = o.cena_do ?? klient?.rozpocet_max ?? null;
  if (maxCena && n.cena != null) {
    if (n.cena <= maxCena) {
      score += 30;
      reasons.push("Cena je v rozpočte");
    } else if (n.cena <= maxCena * 1.1) {
      score += 12;
      reasons.push("Cena mierne nad rozpočtom");
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

  const nLok = [n.lokalita, n.kraj, n.okres].filter(Boolean).join(" ").toLowerCase();
  if (objLokality.length > 0 && nLok) {
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
  } else if (klient?.lokalita && nLok) {
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

  // Izby z požiadaviek — postih ak nesedí
  if (o.poziadavky && n.izby != null) {
    const poz = o.poziadavky;
    const izbyVal = poz.izby ?? poz.pocet_izieb ?? poz.rooms;
    const izbyArr = Array.isArray(izbyVal) ? izbyVal as number[] : (typeof izbyVal === "number" ? [izbyVal] : []);
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

export function farbaSkore(s: number): "green" | "yellow" | "gray" {
  if (s >= 80) return "green";
  if (s >= 50) return "yellow";
  return "gray";
}
