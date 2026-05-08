export interface PresetUloha {
  kategoria: "dokument" | "aml" | "akcia" | "termin";
  nazov: string;
  popis?: string;
  priorita: "nizka" | "normalna" | "vysoka";
}

export const OBCHOD_PRESET: PresetUloha[] = [
  // Dokumenty
  { kategoria: "dokument", nazov: "Úradné overenie (ÚZ)",         priorita: "vysoka" },
  { kategoria: "dokument", nazov: "Rezervačná zmluva (RZ)",        priorita: "vysoka" },
  { kategoria: "dokument", nazov: "Znalecký posudok",               priorita: "vysoka" },
  { kategoria: "dokument", nazov: "Pôvodná kúpna zmluva (KZ)",      priorita: "normalna" },

  // AML / overenia
  { kategoria: "aml", nazov: "AML formulár kupujúci + OP scan",   priorita: "vysoka" },
  { kategoria: "aml", nazov: "AML formulár predávajúci + OP scan", priorita: "vysoka" },
  { kategoria: "aml", nazov: "Overenie veku stavby / OP",           priorita: "normalna" },

  // Akcie
  { kategoria: "akcia", nazov: "Záložné zmluvy → financier",                  priorita: "vysoka" },
  { kategoria: "akcia", nazov: "KZ → notár + návrh na vklad",                  priorita: "vysoka" },
  { kategoria: "akcia", nazov: "Vyčíslenie banky",                              priorita: "normalna" },
  { kategoria: "akcia", nazov: "Energetický certifikát + ručné správy",         priorita: "normalna" },
  { kategoria: "akcia", nazov: "Termín podpisov KZ + ZZ — potvrdiť účastníkov", priorita: "vysoka" },
];
