/** Celoslovenský zoznam RK brandov a generických RK patterov — PATCH C */

export const RK_BRANDS: readonly string[] = [
  // Národné / sieťové
  "RE/MAX", "REMAX", "Century 21", "Century21",
  "HALO reality", "Bond Reality", "Herrys", "Arthur Real",
  "Lexxus", "Lexxus Reality", "Direct Real", "URBIA",
  "Citymax", "National Real Estate", "National Pro",
  "Riešime bývanie", "Slovak Investment Group",
  "Reality Boom", "Top Reality", "Just Reality", "Smart Reality",
  "PRIME REALITY", "Aurora Real", "Crystal Reality",
  "Frank Zicher", "Trigon", "Sapientia",

  // Bratislava + okolie
  "VIANEMA", "SL Reality", "Reality Bratislava", "MZ Real",
  "RealityFox", "Bratislavské reality", "IURIS REAL",
  "U & N Reality", "REALITY 21", "Vill Real", "Idylla Real",
  "EU Real", "Real Pro", "VV Reality", "Reality Servis",
  "Global Real", "Hyposervis", "First Real", "Home Reality",

  // Trnava, Nitra, Trenčín, Žilina
  "TUreality", "DOMUSREAL", "Sereďan reality",
  "Realitné centrum Nitra", "Realitné centrum BB",
  "REALITY GLOBE", "Žilina Reality", "Trenčín Reality", "Považie Reality",

  // Banská Bystrica, Liptov, Tatry
  "Tatra Reality", "Liptov Reality", "Orava Reality",

  // Východ
  "Reality Východ", "Košice Reality", "Prešov Reality",
  "Spiš Reality", "Zemplín Reality", "Gemer Reality",
  "Reality Šariš", "Hont Reality",
];

export const RK_GENERIC_PATTERNS: readonly RegExp[] = [
  /\bRK\b(?!\s*nie)/,
  /\bmakl[ée]r(ka|ovi|om|ov|i)?\b/i,
  /\b(ID|REF|Ref\.?\s*č\.?)\s*[:#]?\s*\d{3,}/,
  /\bbez\s+prov[íi]zie\s+pre\s+kupuj[úu]ceho\b/i,
  /\bobhliadk[ya]\s+po\s+dohode\b/i,
  /\bvolajte\s+makl[ée]ra/i,
  /\bwww\.[a-z0-9-]{2,}\.(sk|com|eu)\b/i,
];
