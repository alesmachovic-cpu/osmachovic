/* ── Zdieľaná databáza slovenských lokalít ── */
/* Používa sa v: Monitor, NewKlientModal, a ďalšie formuláre */

export interface LokalitaEntry {
  display: string;     // čo sa zobrazí v dropdown
  lokalita: string;    // uloží sa do DB
  ulica?: string;      // ak je to ulica
}

export const LOKALITY_DB: LokalitaEntry[] = [
  // Bratislava - mestské časti
  { display: "Bratislava - Staré Mesto", lokalita: "Bratislava I" },
  { display: "Bratislava - Ružinov", lokalita: "Bratislava II" },
  { display: "Bratislava - Nové Mesto", lokalita: "Bratislava III" },
  { display: "Bratislava - Karlova Ves", lokalita: "Bratislava IV" },
  { display: "Bratislava - Petržalka", lokalita: "Bratislava V" },
  { display: "Bratislava - Dúbravka", lokalita: "Bratislava IV" },
  { display: "Bratislava - Rača", lokalita: "Bratislava III" },
  { display: "Bratislava - Vrakuňa", lokalita: "Bratislava II" },
  { display: "Bratislava - Podunajské Biskupice", lokalita: "Bratislava II" },
  { display: "Bratislava - Devín", lokalita: "Bratislava IV" },
  { display: "Bratislava - Devínska Nová Ves", lokalita: "Bratislava IV" },
  { display: "Bratislava - Záhorská Bystrica", lokalita: "Bratislava IV" },
  { display: "Bratislava - Lamač", lokalita: "Bratislava IV" },
  { display: "Bratislava - Čunovo", lokalita: "Bratislava V" },
  { display: "Bratislava - Jarovce", lokalita: "Bratislava V" },
  { display: "Bratislava - Rusovce", lokalita: "Bratislava V" },
  { display: "Bratislava - Vajnory", lokalita: "Bratislava III" },
  // Košice - mestské časti
  { display: "Košice - Staré Mesto", lokalita: "Košice I" },
  { display: "Košice - Juh", lokalita: "Košice II" },
  { display: "Košice - Dargovských hrdinov", lokalita: "Košice III" },
  { display: "Košice - Západ", lokalita: "Košice IV" },
  { display: "Košice - Sever", lokalita: "Košice I" },
  { display: "Košice - KVP", lokalita: "Košice IV" },
  { display: "Košice - Šaca", lokalita: "Košice IV" },
  { display: "Košice - Nad jazerom", lokalita: "Košice IV" },
  { display: "Košice - Pereš", lokalita: "Košice IV" },
  { display: "Košice - Terasa", lokalita: "Košice II" },
  { display: "Košice - Myslava", lokalita: "Košice IV" },
  { display: "Košice - Barca", lokalita: "Košice IV" },
  // Krajské mestá a väčšie mestá
  { display: "Trnava", lokalita: "Trnava" },
  { display: "Nitra", lokalita: "Nitra" },
  { display: "Trenčín", lokalita: "Trenčín" },
  { display: "Žilina", lokalita: "Žilina" },
  { display: "Banská Bystrica", lokalita: "Banská Bystrica" },
  { display: "Prešov", lokalita: "Prešov" },
  { display: "Martin", lokalita: "Martin" },
  { display: "Poprad", lokalita: "Poprad" },
  { display: "Piešťany", lokalita: "Piešťany" },
  { display: "Zvolen", lokalita: "Zvolen" },
  { display: "Prievidza", lokalita: "Prievidza" },
  { display: "Považská Bystrica", lokalita: "Považská Bystrica" },
  { display: "Michalovce", lokalita: "Michalovce" },
  { display: "Spišská Nová Ves", lokalita: "Spišská Nová Ves" },
  { display: "Komárno", lokalita: "Komárno" },
  { display: "Levice", lokalita: "Levice" },
  { display: "Humenné", lokalita: "Humenné" },
  { display: "Bardejov", lokalita: "Bardejov" },
  { display: "Liptovský Mikuláš", lokalita: "Liptovský Mikuláš" },
  { display: "Ružomberok", lokalita: "Ružomberok" },
  { display: "Dunajská Streda", lokalita: "Dunajská Streda" },
  { display: "Nové Zámky", lokalita: "Nové Zámky" },
  { display: "Galanta", lokalita: "Galanta" },
  { display: "Senec", lokalita: "Senec" },
  { display: "Pezinok", lokalita: "Pezinok" },
  { display: "Malacky", lokalita: "Malacky" },
  { display: "Stupava", lokalita: "Stupava" },
  { display: "Šamorín", lokalita: "Dunajská Streda" },
  { display: "Modra", lokalita: "Pezinok" },
  { display: "Svätý Jur", lokalita: "Pezinok" },
  { display: "Bernolákovo", lokalita: "Senec" },
  { display: "Ivanka pri Dunaji", lokalita: "Senec" },
  { display: "Skalica", lokalita: "Skalica" },
  { display: "Senica", lokalita: "Senica" },
  // Západ Slovenska
  { display: "Hlohovec", lokalita: "Hlohovec" },
  { display: "Leopoldov", lokalita: "Hlohovec" },
  { display: "Topoľčany", lokalita: "Topoľčany" },
  { display: "Zlaté Moravce", lokalita: "Zlaté Moravce" },
  { display: "Nové Mesto nad Váhom", lokalita: "Nové Mesto nad Váhom" },
  { display: "Partizánske", lokalita: "Partizánske" },
  { display: "Bánovce nad Bebravou", lokalita: "Bánovce nad Bebravou" },
  { display: "Ilava", lokalita: "Ilava" },
  { display: "Dubnica nad Váhom", lokalita: "Ilava" },
  { display: "Púchov", lokalita: "Púchov" },
  { display: "Lučenec", lokalita: "Lučenec" },
  { display: "Veľký Krtíš", lokalita: "Veľký Krtíš" },
  { display: "Rimavská Sobota", lokalita: "Rimavská Sobota" },
  { display: "Žiar nad Hronom", lokalita: "Žiar nad Hronom" },
  { display: "Banská Štiavnica", lokalita: "Banská Štiavnica" },
  { display: "Brezno", lokalita: "Brezno" },
  // Záhorie
  { display: "Holíč", lokalita: "Skalica" },
  { display: "Myjava", lokalita: "Myjava" },
  // Stredné Slovensko
  { display: "Turčianske Teplice", lokalita: "Turčianske Teplice" },
  { display: "Dolný Kubín", lokalita: "Dolný Kubín" },
  { display: "Námestovo", lokalita: "Námestovo" },
  { display: "Čadca", lokalita: "Čadca" },
  { display: "Bytča", lokalita: "Bytča" },
  // Severovýchod
  { display: "Levoča", lokalita: "Levoča" },
  { display: "Kežmarok", lokalita: "Kežmarok" },
  { display: "Vysoké Tatry", lokalita: "Poprad" },
  { display: "Stará Ľubovňa", lokalita: "Stará Ľubovňa" },
  { display: "Stropkov", lokalita: "Stropkov" },
  { display: "Svidník", lokalita: "Svidník" },
  { display: "Snina", lokalita: "Snina" },
  { display: "Vranov nad Topľou", lokalita: "Vranov nad Topľou" },
  { display: "Trebišov", lokalita: "Trebišov" },
  { display: "Rožňava", lokalita: "Rožňava" },
  // Okolie Bratislavy
  { display: "Rohožník", lokalita: "Malacky" },
  { display: "Lozorno", lokalita: "Malacky" },
  { display: "Zohor", lokalita: "Malacky" },
  { display: "Marianka", lokalita: "Malacky" },
  { display: "Vysoká pri Morave", lokalita: "Malacky" },
  { display: "Gajary", lokalita: "Malacky" },
  // Okolie Senca
  { display: "Malinovo", lokalita: "Senec" },
  { display: "Hamuliakovo", lokalita: "Senec" },
  { display: "Tomášov", lokalita: "Senec" },
  { display: "Nová Dedinka", lokalita: "Senec" },
  { display: "Slovenský Grob", lokalita: "Pezinok" },
  { display: "Dunajská Lužná", lokalita: "Senec" },
  { display: "Rovinka", lokalita: "Senec" },
  { display: "Miloslavov", lokalita: "Senec" },
  { display: "Most pri Bratislave", lokalita: "Senec" },
  // Okolie Pezinka
  { display: "Limbach", lokalita: "Pezinok" },
  { display: "Šenkvice", lokalita: "Pezinok" },
  { display: "Vinosady", lokalita: "Pezinok" },
  { display: "Budmerice", lokalita: "Pezinok" },
  { display: "Častá", lokalita: "Pezinok" },
  // Petržalka - časti
  { display: "Petržalka - Háje", lokalita: "Bratislava V" },
  { display: "Petržalka - Dvory", lokalita: "Bratislava V" },
  { display: "Petržalka - Lúky", lokalita: "Bratislava V" },
  { display: "Petržalka - Kopčany", lokalita: "Bratislava V" },
  // Ružinov - časti
  { display: "Ružinov - Nivy", lokalita: "Bratislava II" },
  { display: "Ružinov - Trnávka", lokalita: "Bratislava II" },
  // Nitra - časti
  { display: "Nitra - Chrenová", lokalita: "Nitra" },
  { display: "Nitra - Klokočina", lokalita: "Nitra" },
  { display: "Nitra - Zobor", lokalita: "Nitra" },
  // Trenčín okolie
  { display: "Trenčianske Teplice", lokalita: "Trenčín" },
  // Košice okolie
  { display: "Košická Belá", lokalita: "Košice-okolie" },
  { display: "Haniska", lokalita: "Košice-okolie" },
  // Okresy
  { display: "Okres Bratislava I", lokalita: "Bratislava I" },
  { display: "Okres Bratislava II", lokalita: "Bratislava II" },
  { display: "Okres Bratislava III", lokalita: "Bratislava III" },
  { display: "Okres Bratislava IV", lokalita: "Bratislava IV" },
  { display: "Okres Bratislava V", lokalita: "Bratislava V" },
  { display: "Okres Malacky", lokalita: "Malacky" },
  { display: "Okres Pezinok", lokalita: "Pezinok" },
  { display: "Okres Senec", lokalita: "Senec" },
  { display: "Okres Trnava", lokalita: "Trnava" },
  { display: "Okres Dunajská Streda", lokalita: "Dunajská Streda" },
  { display: "Okres Galanta", lokalita: "Galanta" },
  { display: "Okres Piešťany", lokalita: "Piešťany" },
  { display: "Okres Nitra", lokalita: "Nitra" },
  { display: "Okres Nové Zámky", lokalita: "Nové Zámky" },
  { display: "Okres Komárno", lokalita: "Komárno" },
  { display: "Okres Levice", lokalita: "Levice" },
  { display: "Okres Trenčín", lokalita: "Trenčín" },
  { display: "Okres Žilina", lokalita: "Žilina" },
  { display: "Okres Martin", lokalita: "Martin" },
  { display: "Okres Banská Bystrica", lokalita: "Banská Bystrica" },
  { display: "Okres Zvolen", lokalita: "Zvolen" },
  { display: "Okres Prešov", lokalita: "Prešov" },
  { display: "Okres Poprad", lokalita: "Poprad" },
  { display: "Okres Košice I", lokalita: "Košice I" },
  { display: "Okres Košice II", lokalita: "Košice II" },
  { display: "Okres Košice III", lokalita: "Košice III" },
  { display: "Okres Košice IV", lokalita: "Košice IV" },
  { display: "Okres Košice-okolie", lokalita: "Košice-okolie" },
  { display: "Okres Michalovce", lokalita: "Michalovce" },
];

/** Normalize search input — remove diacritics + lowercase */
export function normalizeSearch(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

/** Filter lokality by search query (min 2 chars, max 8 results) */
export function filterLokality(query: string, maxResults = 8): LokalitaEntry[] {
  if (query.length < 2) return [];
  const norm = normalizeSearch(query);
  return LOKALITY_DB
    .filter(l => !l.ulica) // skip streets for monitor
    .filter(l => normalizeSearch(l.display).includes(norm))
    .slice(0, maxResults);
}
