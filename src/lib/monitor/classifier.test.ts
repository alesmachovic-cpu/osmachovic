import { describe, it, expect } from "vitest";
import { classify, type ClassifierInput } from "./classifier";

/**
 * Vzorky pochadzaju z Vianema produkcnej DB (maj 2026).
 * IDs su skratene (prvych 8 znakov uuid). URL a metadata su realne.
 *
 * Akceptacne kriteria z task spec:
 *   - SKY PARK (#5)            -> predajca_typ "rk", confidence >= 0.6
 *   - Mgr. Marek Kohutik (#1)  -> NIE "sukromny" (musi byt "rk" alebo "unknown")
 *   - PROFI KLIENT (#6)        -> "rk", confidence >= 0.8
 *   - Libor Jakubec (#9)       -> "sukromny", confidence >= 0.5
 */

describe("A) bazos.sk false positives", () => {
  it("#1 Mgr. Marek Kohutik - title + opakovany telefon -> NIE sukromny", () => {
    const input: ClassifierInput = {
      portal: "bazos.sk",
      nazov: "Dvojgarsonka byt 51m2 zrekonstruovany zatepleny s lodgiou",
      popis: "Ponukam na predaj zrekonstruovany 2-izbovy byt s lodgiou. Kontaktujte ma pre dalsie info.",
      predajca_meno: "Mgr. Marek Kohutik",
      predajca_telefon: "+421901234567",
      db: { phone_count_30d: 6, name_count_30d: 4, listed_on_n_portals: 1 },
    };
    const r = classify(input);
    expect(r.predajca_typ).not.toBe("sukromny");
    expect(["rk", "unknown"]).toContain(r.predajca_typ);
    expect(r.signals.some((s) => s.id === "rk_academic_title")).toBe(true);
    expect(r.signals.some((s) => s.id.startsWith("rk_phone_volume"))).toBe(true);
  });

  it("#2 Jana Muhlova - bez DB kontextu -> unknown alebo slaby sukromny", () => {
    const input: ClassifierInput = {
      portal: "bazos.sk",
      nazov: "4-izbovy bungalov s garazou v obci Novy Svet, len 20 minut od BA",
      popis: "Pekny dom v tichej obci. Zariadeny, pripraveny na byvanie.",
      predajca_meno: "Jana Muhlova",
      db: { phone_count_30d: 0 },
    };
    const r = classify(input);
    expect(["unknown", "sukromny"]).toContain(r.predajca_typ);
  });
});

describe("B) reality.sk false positives", () => {
  it("#5 SKY PARK - developersky projekt + marketing prefix -> rk conf >= 0.6", () => {
    const input: ClassifierInput = {
      portal: "reality.sk",
      nazov: "SKY PARK vynimocna ponuka - 2 izbovy byt v II. vezi",
      popis:
        "Ponukame na predaj exkluzivny 2-izbovy byt v projekte SKY PARK od HB Reavis. " +
        "Krasny vyhlad, prestizna lokalita. Kontaktujte nas pre rezervaciu obhliadky.",
      lokalita: "Reality Bratislava-Stare Mesto",
      predajca_meno: "Realitna kancelaria Herrys",
    };
    const r = classify(input);
    expect(r.predajca_typ).toBe("rk");
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    expect(r.signals.some((s) => s.id === "rk_developer_project")).toBe(true);
  });
});

describe("C) reality.sk s NULL -> explicit rk podla signalov", () => {
  it("#6 PROFI KLIENT - internal RK kod + exkluzivne + prestizna -> rk conf >= 0.8", () => {
    const input: ClassifierInput = {
      portal: "reality.sk",
      nazov: "Predaj exkluzivne mezonet v prestiznej rezidencii Eurovea Bratislava",
      popis:
        "PROFI KLIENT. Ponukame na predaj exkluzivny mezonet v prestiznej rezidencii Eurovea. " +
        "Pre viac info kontaktujte nas. ID inzeratu: 7138.",
      lokalita: "Reality Bratislava-Stare Mesto",
    };
    const r = classify(input);
    expect(r.predajca_typ).toBe("rk");
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
    expect(r.signals.some((s) => s.id === "rk_strong_phrase")).toBe(true);
  });

  it("#7 TOP marketing prefix + struktur popis -> rk", () => {
    const input: ClassifierInput = {
      portal: "reality.sk",
      nazov: "TOP priestranny 3-izb. mezonet, moznost upravy na 4-izb, 113 m2, 2x balkon, garaz, Bajzova ulica",
      popis: "Ponukame na predaj priestranny mezonet. Moznost upravy. Kontaktujte ma pre obhliadku.",
      lokalita: "Reality Bratislava-Ruzinov",
    };
    const r = classify(input);
    expect(r.predajca_typ).toBe("rk");
    expect(r.signals.some((s) => s.id === "rk_marketing_prefix")).toBe(true);
  });
});

describe("D) true positive sukromnici", () => {
  it("#9 Libor Jakubec - 1. osoba 'prenajmem' v popise -> sukromny conf >= 0.5", () => {
    const input: ClassifierInput = {
      portal: "bazos.sk",
      nazov: "Prenajmem novo zariadenu garsonku v Petrzalke",
      popis: "Prenajmem novo zariadenu garsonku v Petrzalke. Byvam v inom byte, preto prenajmem tento.",
      predajca_meno: "Libor Jakubec",
      db: { phone_count_30d: 1, name_count_30d: 1, listed_on_n_portals: 1 },
    };
    const r = classify(input);
    expect(r.predajca_typ).toBe("sukromny");
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.signals.some((s) => s.id === "sukromny_first_person")).toBe(true);
    expect(r.signals.some((s) => s.id === "sukromny_phone_unique")).toBe(true);
  });

  it("#10 Martin (krstne meno) - kratky popis 'predam' -> sukromny", () => {
    const input: ClassifierInput = {
      portal: "bazos.sk",
      nazov: "Velky tehlovy byt na Kadnarovej v Krasnanoch",
      popis: "Predam tehlovy byt na Kadnarovej.",
      predajca_meno: "Martin",
      db: { phone_count_30d: 1, name_count_30d: 1 },
    };
    const r = classify(input);
    expect(r.predajca_typ).toBe("sukromny");
  });
});

describe("Edge cases", () => {
  it("Bez signalov -> unknown", () => {
    const r = classify({ portal: "neznamy.sk" });
    expect(r.predajca_typ).toBe("unknown");
    expect(r.signals).toEqual([]);
  });

  it("Znama RK domena v popise -> rk", () => {
    const r = classify({
      portal: "reality.sk",
      nazov: "Byt na predaj",
      popis: "Kontakt: peter.novak@herrys.sk, alebo info@vianema.eu",
    });
    expect(r.predajca_typ).toBe("rk");
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.signals.some((s) => s.id === "rk_domain")).toBe(true);
  });

  it("ICO v popise -> rk", () => {
    const r = classify({
      portal: "reality.sk",
      nazov: "Byt na predaj",
      popis: "Predavajuci: XYZ s.r.o., ICO: 12345678. Kontakt: 0901 234 567.",
    });
    expect(r.predajca_typ).toBe("rk");
    expect(r.signals.some((s) => s.id === "rk_ico")).toBe(true);
  });

  it("multi-portal listing -> rk_multi_portal signal", () => {
    const r = classify({
      portal: "nehnutelnosti.sk",
      nazov: "3-izbovy byt",
      db: { listed_on_n_portals: 3 },
    });
    expect(r.signals.some((s) => s.id === "rk_multi_portal")).toBe(true);
    expect(r.predajca_typ).toBe("rk");
  });

  it("rk_directory override -> rk", () => {
    const r = classify({
      portal: "bazos.sk",
      nazov: "Pekny byt",
      predajca_meno: "Anna Novakova",
      db: { in_rk_directory: true },
    });
    expect(r.predajca_typ).toBe("rk");
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.signals.some((s) => s.id === "rk_directory")).toBe(true);
  });

  it("Method = v2 a obsahuje signals + raw_score", () => {
    const r = classify({ portal: "bazos.sk", nazov: "Byt", predajca_meno: "Jan Novak" });
    expect(r.method).toBe("v2");
    expect(Array.isArray(r.signals)).toBe(true);
    expect(typeof r.raw_score).toBe("number");
  });
});
