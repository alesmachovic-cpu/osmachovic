import { describe, it, expect } from "vitest";
import { mapPropertyType, regionFromCity, needsLandSize, isHouseType, isLandType } from "./mapping";

describe("mapPropertyType", () => {
  it("mapuje garsonku na 1I_BYT", () => {
    expect(mapPropertyType("garsonka")).toBe("1I_BYT");
    expect(mapPropertyType("garsónka")).toBe("1I_BYT");
  });

  it("mapuje byty správne", () => {
    expect(mapPropertyType("2-izbovy-byt")).toBe("2I_BYT");
    expect(mapPropertyType("3-izbovy-byt")).toBe("3I_BYT");
    expect(mapPropertyType("4-izbovy-byt")).toBe("4I_BYT");
  });

  it("mapuje rodinný dom na 4I_RD", () => {
    expect(mapPropertyType("rodinny-dom")).toBe("4I_RD");
    expect(mapPropertyType("rodinný dom")).toBe("4I_RD");
  });

  it("mapuje pozemky", () => {
    expect(mapPropertyType("stavebny-pozemok")).toBe("STAVEBNY_POZEMOK");
    expect(mapPropertyType("pozemok")).toBe("POZEMOK");
  });

  it("vracia default 3I_BYT pre neznámy typ", () => {
    expect(mapPropertyType("neznamy")).toBe("3I_BYT");
    expect(mapPropertyType(null)).toBe("3I_BYT");
    expect(mapPropertyType(undefined)).toBe("3I_BYT");
  });

  it("je case-insensitive a ignoruje podčiarkovníky", () => {
    expect(mapPropertyType("Rodinny-Dom")).toBe("4I_RD");
  });
});

describe("regionFromCity", () => {
  it("Bratislava → Z", () => expect(regionFromCity("Bratislava")).toBe("Z"));
  it("Trnava → Z",      () => expect(regionFromCity("Trnava")).toBe("Z"));
  it("Žilina → Z",      () => expect(regionFromCity("Žilina")).toBe("Z"));
  it("Košice → V",      () => expect(regionFromCity("Košice")).toBe("V"));
  it("Prešov → V",      () => expect(regionFromCity("Prešov")).toBe("V"));
  it("Michalovce → V",  () => expect(regionFromCity("Michalovce")).toBe("V"));
  it("Banská Bystrica → S", () => expect(regionFromCity("Banská Bystrica")).toBe("S"));
  it("Martin → S",      () => expect(regionFromCity("Martin")).toBe("S"));
  it("neznáme mesto → S (default)", () => expect(regionFromCity("Neznáme")).toBe("S"));
  it("je case-insensitive", () => {
    expect(regionFromCity("BRATISLAVA")).toBe("Z");
    expect(regionFromCity("košice")).toBe("V");
  });
});

describe("needsLandSize", () => {
  it("true pre rodinné domy", () => {
    expect(needsLandSize("4I_RD")).toBe(true);
    expect(needsLandSize("3I_RD")).toBe(true);
    expect(needsLandSize("6I_RD")).toBe(true);
  });

  it("true pre pozemky", () => {
    expect(needsLandSize("STAVEBNY_POZEMOK")).toBe(true);
    expect(needsLandSize("POZEMOK")).toBe(true);
  });

  it("false pre byty", () => {
    expect(needsLandSize("2I_BYT")).toBe(false);
    expect(needsLandSize("3I_BYT")).toBe(false);
    expect(needsLandSize("1I_BYT")).toBe(false);
  });
});

describe("isHouseType / isLandType", () => {
  it("isHouseType rozozná RD", () => {
    expect(isHouseType("4I_RD")).toBe(true);
    expect(isHouseType("2I_BYT")).toBe(false);
  });

  it("isLandType rozozná pozemky", () => {
    expect(isLandType("POZEMOK")).toBe(true);
    expect(isLandType("STAVEBNY_POZEMOK")).toBe(true);
    expect(isLandType("3I_BYT")).toBe(false);
  });
});
