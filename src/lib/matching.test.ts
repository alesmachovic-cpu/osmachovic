import { describe, it, expect } from "vitest";
import { vypocitajSkore, skoreUroven } from "./matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch } from "./matching";

const baseObj: ObjednavkaForMatch = {
  id: "o1",
  klient_id: "k1",
  druh: "3-izbovy-byt",
  // Reálny formát z ObjednavkaForm: kľúč `izby`, hodnoty sú stringy.
  poziadavky: { izby: ["3"] },
  lokalita: { okresy: ["Bratislava II"] },
  cena_od: 150000,
  cena_do: 220000,
};

const baseNeh: NehnutelnostForMatch = {
  id: "n1",
  klient_id: "k2",
  typ: "3-izbovy-byt",
  cena: 195000,
  plocha: 75,
  izby: 3,
  lokalita: "Bratislava - Ružinov",
  kraj: "Bratislavský kraj",
  okres: "Bratislava II",
  status: "aktivny",
};

describe("vypocitajSkore", () => {
  it("perfectMatch — skóre >= 90", () => {
    const { score } = vypocitajSkore(baseObj, baseNeh);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("neaktívna nehnuteľnosť — skóre 0", () => {
    const { score } = vypocitajSkore(baseObj, { ...baseNeh, status: "predany" });
    expect(score).toBe(0);
  });

  it("cena mimo rozpočtu — bez cenového bodu", () => {
    const { score, reasons } = vypocitajSkore(baseObj, { ...baseNeh, cena: 999999 });
    expect(reasons).not.toContain("Cena je v rozpočte");
    expect(score).toBeLessThan(90);
  });

  it("iná lokalita — bez lokálneho bodu", () => {
    const { reasons } = vypocitajSkore(baseObj, { ...baseNeh, lokalita: "Košice", kraj: "Košický kraj", okres: "Košice I" });
    expect(reasons).not.toContain("Lokalita zodpovedá");
  });

  it("null status = aktivny (legacy záznamy)", () => {
    const { score } = vypocitajSkore(baseObj, { ...baseNeh, status: null });
    expect(score).toBeGreaterThan(0);
  });

  // Regression: izby uložené ako pole stringov (["3"]) sa musia párovať s
  // číselným n.izby. Pred fixom 2026-06-06 dostal správny počet izieb postih -30.
  it("izby ako string pole — 3i sedí, dostane bonus nie postih", () => {
    const obj: ObjednavkaForMatch = { ...baseObj, poziadavky: { izby: ["3"] } };
    const { score, reasons } = vypocitajSkore(obj, baseNeh);
    expect(reasons).toContain("3-izbový vyhovuje");
    expect(reasons.some(r => r.includes("mimo preferencie"))).toBe(false);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("izby string nesedí — postih sa počíta z čísla, nie z NaN", () => {
    const obj: ObjednavkaForMatch = { ...baseObj, poziadavky: { izby: ["2"] } };
    const { reasons } = vypocitajSkore(obj, baseNeh); // baseNeh má 3 izby → odchýlka 1
    expect(reasons.some(r => r.includes("klient chce 2i"))).toBe(true);
  });

  it("prázdna lokalita objednávky → fallback na lokalitu klienta (symetria routes)", () => {
    const obj: ObjednavkaForMatch = { ...baseObj, lokalita: { kraje: [], okresy: [] } };
    const klient = { id: "k1", lokalita: "Bratislava - Ružinov", rozpocet_max: null };
    const { reasons } = vypocitajSkore(obj, baseNeh, klient);
    expect(reasons.some(r => r.includes("z profilu"))).toBe(true);
  });

  it("cena výrazne nad rozpočtom — stupňovaný postih (#4)", () => {
    // cena_do 220000, nehnuteľnosť 400000 = +82 % → najvyšší postih
    const { reasons } = vypocitajSkore(baseObj, { ...baseNeh, cena: 400000 });
    expect(reasons.some(r => r.includes("mimo rozpočtu"))).toBe(true);
  });

  it("objednávka bez cena_do → fallback na rozpočet klienta (#6)", () => {
    const obj: ObjednavkaForMatch = { ...baseObj, cena_do: null };
    const klient = { id: "k1", lokalita: null, rozpocet_max: 220000 };
    const { reasons } = vypocitajSkore(obj, baseNeh, klient); // baseNeh 195000 <= 220000
    expect(reasons).toContain("Cena je v rozpočte");
  });
});

describe("skoreUroven", () => {
  // Jeden zdroj pravdy pre farby naprieč 5 UI komponentmi (prahy 80/50).
  it("hranice 80 a 50 sú inkluzívne", () => {
    expect(skoreUroven(80)).toBe("vyborna");
    expect(skoreUroven(79)).toBe("dobra");
    expect(skoreUroven(50)).toBe("dobra");
    expect(skoreUroven(49)).toBe("slaba");
    expect(skoreUroven(0)).toBe("slaba");
  });
});
