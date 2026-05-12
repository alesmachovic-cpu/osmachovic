export const PROPERTY_TYPE_OPTIONS = [
  { value: "1I_BYT",         label: "1-izbový byt / garsónka" },
  { value: "1.5I_BYT",       label: "1,5-izbový byt" },
  { value: "2I_BYT",         label: "2-izbový byt" },
  { value: "3I_BYT",         label: "3-izbový byt" },
  { value: "4I_BYT",         label: "4-izbový byt" },
  { value: "5I_BYT",         label: "5+ izbový byt" },
  { value: "2I_RD",          label: "Rodinný dom (2-izbový)" },
  { value: "3I_RD",          label: "Rodinný dom (3-izbový)" },
  { value: "4I_RD",          label: "Rodinný dom (4-izbový)" },
  { value: "5I_RD",          label: "Rodinný dom (5-izbový)" },
  { value: "6I_RD",          label: "Rodinný dom (6+ izbový)" },
  { value: "STAVEBNY_POZEMOK", label: "Stavebný pozemok" },
  { value: "POZEMOK",        label: "Pozemok" },
] as const;

export type PropertyTypeMapped = typeof PROPERTY_TYPE_OPTIONS[number]["value"];

const PROPERTY_TYPE_MAP: Record<string, PropertyTypeMapped> = {
  "garsonka":          "1I_BYT",
  "garsónka":          "1I_BYT",
  "1-izbovy-byt":      "1I_BYT",
  "1 izbovy byt":      "1I_BYT",
  "1.5-izbovy-byt":    "1.5I_BYT",
  "1,5-izbový byt":    "1.5I_BYT",
  "2-izbovy-byt":      "2I_BYT",
  "2 izbovy byt":      "2I_BYT",
  "3-izbovy-byt":      "3I_BYT",
  "3 izbovy byt":      "3I_BYT",
  "4-izbovy-byt":      "4I_BYT",
  "4 izbovy byt":      "4I_BYT",
  "5-izbovy-byt":      "5I_BYT",
  "5 izbovy byt":      "5I_BYT",
  "rodinny-dom":       "4I_RD",
  "rodinný dom":       "4I_RD",
  "stavebny-pozemok":  "STAVEBNY_POZEMOK",
  "stavebný pozemok":  "STAVEBNY_POZEMOK",
  "pozemok":           "POZEMOK",
};

export function mapPropertyType(raw: string | null | undefined): PropertyTypeMapped {
  if (!raw) return "3I_BYT";
  const normalized = raw.toLowerCase().replace(/_/g, "-").trim();
  return PROPERTY_TYPE_MAP[normalized] ?? "3I_BYT";
}

export function isLandType(type: PropertyTypeMapped): boolean {
  return type === "STAVEBNY_POZEMOK" || type === "POZEMOK";
}

export function isHouseType(type: PropertyTypeMapped): boolean {
  return type.endsWith("_RD");
}

export function needsLandSize(type: PropertyTypeMapped): boolean {
  return isLandType(type) || isHouseType(type);
}

const WEST  = ["bratislava","trnava","nitra","trenčín","trencin","žilina","zilina","malacky","pezinok","senec","hlohovec","piešťany","piestany","senica","skalica","partizánske","partizanske","prievidza","púchov","puchov"];
const EAST  = ["košice","kosice","prešov","presov","michalovce","poprad","spišská nová ves","spiska nova ves","humenné","humenne","bardejov","sabinov","vranov","trebišov","trebisov","rožňava","roznava"];

export function regionFromCity(city: string): "Z" | "S" | "V" {
  const c = city.toLowerCase().trim();
  if (EAST.some(e => c.includes(e) || e.includes(c))) return "V";
  if (WEST.some(w => c.includes(w) || w.includes(c))) return "Z";
  return "S";
}

export const REGION_OPTIONS = [
  { value: "Z", label: "Západ (BA, TT, NR, TN, ZA)" },
  { value: "S", label: "Stred (BB, Martin, Liptov)" },
  { value: "V", label: "Východ (PO, KE)" },
] as const;

export const SERVICES_OPTIONS = [
  { value: "FOTO",                  label: "Fotografia" },
  { value: "VIDEO",                 label: "Video" },
  { value: "VIDEO_VSTUPY_MAKLERA",  label: "Video vstupy makléra" },
  { value: "DRON",                  label: "Dron" },
  { value: "VIZUALIZACIA_INT",      label: "Vizualizácia interiéru" },
  { value: "VIZUALIZACIA_POZEMOK",  label: "Vizualizácia pozemku" },
  { value: "PODORYS_Z_PREDLOHY",    label: "Pôdorys z predlohy" },
  { value: "PODORYS_MERANIE",       label: "Pôdorys s meraním" },
] as const;

export const PREFERRED_DAYS_OPTIONS = [
  { value: "ANY_WEEKDAY", label: "Akýkoľvek pracovný deň" },
  { value: "MON",         label: "Pondelok" },
  { value: "TUE",         label: "Utorok" },
  { value: "WED",         label: "Streda" },
  { value: "THU",         label: "Štvrtok" },
  { value: "FRI",         label: "Piatok" },
  { value: "SAT",         label: "Sobota" },
  { value: "SUN",         label: "Nedeľa" },
] as const;

export const LAND_SIZE_OPTIONS = [
  { value: "NEAPLIKUJE", label: "Neuvádzam" },
  { value: "DO_500",     label: "do 500 m²" },
  { value: "DO_1000",    label: "500–1 000 m²" },
  { value: "DO_1500",    label: "1 000–1 500 m²" },
  { value: "VIAC",       label: "nad 1 500 m²" },
] as const;

export const STAV_LABELS: Record<string, string> = {
  draft:       "Koncept",
  submitted:   "Odoslaná",
  scheduled:   "Naplánovaná",
  in_progress: "Prebieha",
  completed:   "Dokončená",
  cancelled:   "Zrušená",
};

export const STAV_COLORS: Record<string, string> = {
  draft:       "#6b7280",
  submitted:   "#2563eb",
  scheduled:   "#7c3aed",
  in_progress: "#d97706",
  completed:   "#16a34a",
  cancelled:   "#dc2626",
};
