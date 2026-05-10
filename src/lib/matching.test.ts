import { describe, it, expect } from "vitest";
import { vypocitajSkore } from "./matching";
import type { ObjednavkaForMatch, NehnutelnostForMatch } from "./matching";

const baseObj: ObjednavkaForMatch = {
  id: "o1",
  klient_id: "k1",
  druh: "3-izbovy-byt",
  poziadavky: { pocet_izieb: [3] },
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
});
