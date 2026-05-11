"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PhoneInput from "@/components/PhoneInput";
import { useAuth } from "@/components/AuthProvider";
import { getMaklerUuid } from "@/lib/maklerMap";
import { searchStreets } from "@/lib/streets-db";
import { klientInsert, klientUpdate } from "@/lib/klientApi";

interface DuplicateHit {
  id: string;
  meno: string;
  telefon?: string;
  email?: string;
  status?: string;
  typ?: string;
  lokalita?: string;
  poznamka?: string;
  makler_id?: string | null;
  created_at: string;
}

interface Props {
  open?: boolean;
  onClose: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
  onLvPrompt?: (klient: { id: string; meno: string }) => void;
  initialPhone?: string;
  showTypKlienta?: boolean; // len z dashboardu overenia
  defaultTyp?: "kupujuci" | "predavajuci" | "oboje";
  editKlient?: {
    id: string;
    meno: string;
    telefon: string | null;
    email: string | null;
    status: string;
    typ: string;
    lokalita: string | null;
    poznamka: string | null;
    calendar_event_id?: string | null;
    datum_naberu?: string | null;
    datum_narodenia?: string | null;
    lv_data?: Record<string, unknown> | null;
  } | null;
}

// TODO: Po spustení SQL migrácie (002_update_klienti_constraints.sql) odkomentuj všetky statusy
const STATUS_OPTIONS = [
  { value: "novy_kontakt", label: "Nový kontakt" },
  { value: "dohodnuty_naber", label: "Dohodnutý náber" },
  { value: "nabrany", label: "Nabraný" },
  { value: "volat_neskor", label: "Volať neskôr" },
  { value: "nedovolal", label: "Nedovolal" },
  { value: "nechce_rk", label: "Nechce RK" },
  { value: "uz_predal", label: "Už predal" },
  { value: "realitna_kancelaria", label: "Realitná kancelária" },
];

/* ── Typ nehnuteľnosti — zladené s InzeratForm ── */
const TYP_GROUPS = [
  { label: "Byty", options: [
    { value: "garsonka", label: "Garsónka" },
    { value: "1-izbovy-byt", label: "1-izbový byt" },
    { value: "2-izbovy-byt", label: "2-izbový byt" },
    { value: "3-izbovy-byt", label: "3-izbový byt" },
    { value: "4-izbovy-byt", label: "4-izbový byt" },
    { value: "5-izbovy-byt", label: "5 a viac izbový byt" },
    { value: "mezonet", label: "Mezonet" },
    { value: "apartman", label: "Apartmán" },
  ]},
  { label: "Domy", options: [
    { value: "rodinny-dom", label: "Rodinný dom" },
    { value: "chata", label: "Chata" },
    { value: "vidiecky-dom", label: "Vidiecky dom" },
    { value: "zrub", label: "Zrub" },
  ]},
  { label: "Pozemky", options: [
    { value: "stavebny-pozemok", label: "Stavebný pozemok" },
    { value: "pozemok-rd", label: "Pre rodinné domy" },
    { value: "zahrada", label: "Záhrada" },
    { value: "polnohospodarska-poda", label: "Poľnohospodárska pôda" },
    { value: "komercna-zona", label: "Komerčná zóna" },
  ]},
  { label: "Komerčné", options: [
    { value: "komercny-objekt", label: "Komerčný objekt" },
    { value: "kancelarie", label: "Kancelárie" },
    { value: "sklad", label: "Sklad" },
    { value: "restauracia", label: "Reštaurácia" },
    { value: "hotel-penzion", label: "Hotel / Penzión" },
  ]},
  { label: "Iné", options: [
    { value: "garaz", label: "Garáž" },
    { value: "ine", label: "Iné" },
  ]},
];

/* ── Smart lokalita — mestské časti, mestá, okresy + ulice ── */
interface LokalitaEntry {
  display: string;     // čo sa zobrazí v dropdown
  lokalita: string;    // uloží sa do DB
  ulica?: string;      // ak je to ulica, auto-fill do ulice
}

const LOKALITY_DB: LokalitaEntry[] = [
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
  // Ďalšie mestá a obce — západ Slovenska
  { display: "Hlohovec", lokalita: "Hlohovec" },
  { display: "Leopoldov", lokalita: "Hlohovec" },
  { display: "Váhovce", lokalita: "Hlohovec" },
  { display: "Červeník", lokalita: "Hlohovec" },
  { display: "Šulekovo", lokalita: "Hlohovec" },
  { display: "Bojná", lokalita: "Topoľčany" },
  { display: "Topoľčany", lokalita: "Topoľčany" },
  { display: "Zlaté Moravce", lokalita: "Zlaté Moravce" },
  { display: "Vráble", lokalita: "Nitra" },
  { display: "Šurany", lokalita: "Nové Zámky" },
  { display: "Štúrovo", lokalita: "Nové Zámky" },
  { display: "Hurbanovo", lokalita: "Komárno" },
  { display: "Kolárovo", lokalita: "Komárno" },
  { display: "Fiľakovo", lokalita: "Lučenec" },
  { display: "Lučenec", lokalita: "Lučenec" },
  { display: "Veľký Krtíš", lokalita: "Veľký Krtíš" },
  { display: "Rimavská Sobota", lokalita: "Rimavská Sobota" },
  { display: "Revúca", lokalita: "Revúca" },
  { display: "Detva", lokalita: "Detva" },
  { display: "Krupina", lokalita: "Krupina" },
  { display: "Žiar nad Hronom", lokalita: "Žiar nad Hronom" },
  { display: "Banská Štiavnica", lokalita: "Banská Štiavnica" },
  { display: "Brezno", lokalita: "Brezno" },
  { display: "Poltár", lokalita: "Poltár" },
  { display: "Žarnovica", lokalita: "Žarnovica" },
  { display: "Nová Baňa", lokalita: "Žarnovica" },
  // Záhorie
  { display: "Holíč", lokalita: "Skalica" },
  { display: "Gbely", lokalita: "Skalica" },
  { display: "Myjava", lokalita: "Myjava" },
  { display: "Brezová pod Bradlom", lokalita: "Myjava" },
  { display: "Vrbové", lokalita: "Piešťany" },
  { display: "Hlohovec", lokalita: "Hlohovec" },
  // Stredné Slovensko
  { display: "Turčianske Teplice", lokalita: "Turčianske Teplice" },
  { display: "Dolný Kubín", lokalita: "Dolný Kubín" },
  { display: "Námestovo", lokalita: "Námestovo" },
  { display: "Tvrdošín", lokalita: "Tvrdošín" },
  { display: "Trstená", lokalita: "Tvrdošín" },
  { display: "Kysucké Nové Mesto", lokalita: "Kysucké Nové Mesto" },
  { display: "Čadca", lokalita: "Čadca" },
  { display: "Bytča", lokalita: "Bytča" },
  { display: "Rajec", lokalita: "Rajec" },
  { display: "Krásno nad Kysucou", lokalita: "Čadca" },
  // Severovýchod
  { display: "Levoča", lokalita: "Levoča" },
  { display: "Kežmarok", lokalita: "Kežmarok" },
  { display: "Starý Smokovec", lokalita: "Poprad" },
  { display: "Tatranská Lomnica", lokalita: "Poprad" },
  { display: "Vysoké Tatry", lokalita: "Poprad" },
  { display: "Spišská Belá", lokalita: "Kežmarok" },
  { display: "Spišská Stará Ves", lokalita: "Stará Ľubovňa" },
  { display: "Stará Ľubovňa", lokalita: "Stará Ľubovňa" },
  { display: "Stropkov", lokalita: "Stropkov" },
  { display: "Svidník", lokalita: "Svidník" },
  { display: "Medzilaborce", lokalita: "Medzilaborce" },
  { display: "Snina", lokalita: "Snina" },
  { display: "Vranov nad Topľou", lokalita: "Vranov nad Topľou" },
  { display: "Sobrance", lokalita: "Sobrance" },
  { display: "Trebišov", lokalita: "Trebišov" },
  { display: "Rožňava", lokalita: "Rožňava" },
  { display: "Gelnica", lokalita: "Gelnica" },
  { display: "Spišské Podhradie", lokalita: "Levoča" },
  // Okolie Bratislavy
  { display: "Záhorská Bystrica", lokalita: "Bratislava IV" },
  { display: "Rohožník", lokalita: "Malacky" },
  { display: "Borinka", lokalita: "Malacky" },
  { display: "Lozorno", lokalita: "Malacky" },
  { display: "Záhorská Ves", lokalita: "Malacky" },
  { display: "Kuchyňa", lokalita: "Malacky" },
  { display: "Veľké Leváre", lokalita: "Malacky" },
  { display: "Zohor", lokalita: "Malacky" },
  { display: "Jakubov", lokalita: "Malacky" },
  { display: "Láb", lokalita: "Malacky" },
  { display: "Plavecký Mikuláš", lokalita: "Malacky" },
  { display: "Marianka", lokalita: "Malacky" },
  { display: "Jablonové", lokalita: "Malacky" },
  { display: "Kostolište", lokalita: "Malacky" },
  { display: "Pernek", lokalita: "Malacky" },
  { display: "Sološnica", lokalita: "Malacky" },
  { display: "Plavecký Štvrtok", lokalita: "Malacky" },
  { display: "Vysoká pri Morave", lokalita: "Malacky" },
  { display: "Gajary", lokalita: "Malacky" },
  { display: "Malé Leváre", lokalita: "Malacky" },
  { display: "Jabloňové", lokalita: "Malacky" },
  { display: "Čáry", lokalita: "Senica" },
  { display: "Šaštín-Stráže", lokalita: "Senica" },
  { display: "Brodské", lokalita: "Skalica" },
  { display: "Kopčany", lokalita: "Skalica" },
  // Okolie Senca
  { display: "Malinovo", lokalita: "Senec" },
  { display: "Hamuliakovo", lokalita: "Senec" },
  { display: "Kostolná pri Dunaji", lokalita: "Senec" },
  { display: "Tomášov", lokalita: "Senec" },
  { display: "Kráľová pri Senci", lokalita: "Senec" },
  { display: "Nová Dedinka", lokalita: "Senec" },
  { display: "Zálesie", lokalita: "Senec" },
  { display: "Reca", lokalita: "Senec" },
  { display: "Slovenský Grob", lokalita: "Pezinok" },
  { display: "Viničné", lokalita: "Pezinok" },
  { display: "Čierna Voda", lokalita: "Senec" },
  { display: "Veľký Biel", lokalita: "Senec" },
  { display: "Igram", lokalita: "Senec" },
  { display: "Hrubá Borša", lokalita: "Senec" },
  { display: "Blatné", lokalita: "Senec" },
  { display: "Boldog", lokalita: "Senec" },
  { display: "Most pri Bratislave", lokalita: "Senec" },
  { display: "Miloslavov", lokalita: "Senec" },
  { display: "Dunajská Lužná", lokalita: "Senec" },
  { display: "Rovinka", lokalita: "Senec" },
  { display: "Kalinkovo", lokalita: "Senec" },
  // Okolie Pezinka
  { display: "Limbach", lokalita: "Pezinok" },
  { display: "Šenkvice", lokalita: "Pezinok" },
  { display: "Vinosady", lokalita: "Pezinok" },
  { display: "Vištuk", lokalita: "Pezinok" },
  { display: "Budmerice", lokalita: "Pezinok" },
  { display: "Častá", lokalita: "Pezinok" },
  { display: "Doľany", lokalita: "Pezinok" },
  { display: "Jablonec", lokalita: "Pezinok" },
  { display: "Píla", lokalita: "Pezinok" },
  { display: "Báhoň", lokalita: "Pezinok" },
  { display: "Dubová", lokalita: "Pezinok" },
  { display: "Štefanová", lokalita: "Pezinok" },
  { display: "Cajla", lokalita: "Pezinok" },
  // Petržalka a okolie — obytné časti
  { display: "Petržalka - Háje", lokalita: "Bratislava V" },
  { display: "Petržalka - Dvory", lokalita: "Bratislava V" },
  { display: "Petržalka - Lúky", lokalita: "Bratislava V" },
  { display: "Petržalka - Kopčany", lokalita: "Bratislava V" },
  // Ružinov — obytné časti
  { display: "Ružinov - Nivy", lokalita: "Bratislava II" },
  { display: "Ružinov - Trnávka", lokalita: "Bratislava II" },
  { display: "Ružinov - Štrkovecké jazero", lokalita: "Bratislava II" },
  // Okolie Nitry
  { display: "Nitra - Chrenová", lokalita: "Nitra" },
  { display: "Nitra - Klokočina", lokalita: "Nitra" },
  { display: "Nitra - Diely", lokalita: "Nitra" },
  { display: "Nitra - Zobor", lokalita: "Nitra" },
  { display: "Lužianky", lokalita: "Nitra" },
  { display: "Pohranice", lokalita: "Nitra" },
  { display: "Čechynce", lokalita: "Nitra" },
  { display: "Zbehy", lokalita: "Nitra" },
  { display: "Alekšince", lokalita: "Nitra" },
  // Trenčín okolie
  { display: "Trenčianske Teplice", lokalita: "Trenčín" },
  { display: "Trenčianska Teplá", lokalita: "Trenčín" },
  { display: "Nové Mesto nad Váhom", lokalita: "Nové Mesto nad Váhom" },
  { display: "Partizánske", lokalita: "Partizánske" },
  { display: "Bánovce nad Bebravou", lokalita: "Bánovce nad Bebravou" },
  { display: "Ilava", lokalita: "Ilava" },
  { display: "Dubnica nad Váhom", lokalita: "Ilava" },
  { display: "Púchov", lokalita: "Púchov" },
  // Žilina okolie
  { display: "Bytča", lokalita: "Bytča" },
  { display: "Kysucké Nové Mesto", lokalita: "Kysucké Nové Mesto" },
  { display: "Rajec", lokalita: "Rajec" },
  { display: "Rajecké Teplice", lokalita: "Rajec" },
  { display: "Turzovka", lokalita: "Čadca" },
  { display: "Krásno nad Kysucou", lokalita: "Čadca" },
  // Košice okolie
  { display: "Košice - Nad jazerom", lokalita: "Košice IV" },
  { display: "Košice - Pereš", lokalita: "Košice IV" },
  { display: "Košice - Luník IX", lokalita: "Košice IV" },
  { display: "Košice - Terasa", lokalita: "Košice II" },
  { display: "Košice - Šaca", lokalita: "Košice IV" },
  { display: "Košice - Myslava", lokalita: "Košice IV" },
  { display: "Košice - Barca", lokalita: "Košice IV" },
  { display: "Košická Belá", lokalita: "Košice-okolie" },
  { display: "Bidovce", lokalita: "Košice-okolie" },
  { display: "Haniska", lokalita: "Košice-okolie" },
  { display: "Geča", lokalita: "Košice-okolie" },
  { display: "Nižná Hutka", lokalita: "Košice-okolie" },
  { display: "Ťahanovce", lokalita: "Košice II" },
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
  // Známe ulice Bratislava — Petržalka
  { display: "Nám. hraničiarov → Petržalka", lokalita: "Bratislava V", ulica: "Nám. hraničiarov" },
  { display: "Rusovská cesta → Petržalka", lokalita: "Bratislava V", ulica: "Rusovská cesta" },
  { display: "Kutlíkova → Petržalka", lokalita: "Bratislava V", ulica: "Kutlíkova" },
  { display: "Budatínska → Petržalka", lokalita: "Bratislava V", ulica: "Budatínska" },
  { display: "Hálovej → Petržalka", lokalita: "Bratislava V", ulica: "Hálovej" },
  { display: "Lachova → Petržalka", lokalita: "Bratislava V", ulica: "Lachova" },
  { display: "Romanova → Petržalka", lokalita: "Bratislava V", ulica: "Romanova" },
  { display: "Jungmannova → Petržalka", lokalita: "Bratislava V", ulica: "Jungmannova" },
  { display: "Ovsištské nám. → Petržalka", lokalita: "Bratislava V", ulica: "Ovsištské nám." },
  { display: "Mamateyova → Petržalka", lokalita: "Bratislava V", ulica: "Mamateyova" },
  { display: "Fedinova → Petržalka", lokalita: "Bratislava V", ulica: "Fedinova" },
  { display: "Černyševského → Petržalka", lokalita: "Bratislava V", ulica: "Černyševského" },
  // Bratislava — Ružinov
  { display: "Bajkalská → Ružinov", lokalita: "Bratislava II", ulica: "Bajkalská" },
  { display: "Drieňová → Ružinov", lokalita: "Bratislava II", ulica: "Drieňová" },
  { display: "Ružová dolina → Ružinov", lokalita: "Bratislava II", ulica: "Ružová dolina" },
  { display: "Prievozská → Ružinov", lokalita: "Bratislava II", ulica: "Prievozská" },
  { display: "Tomášikova → Ružinov", lokalita: "Bratislava II", ulica: "Tomášikova" },
  { display: "Miletičova → Ružinov", lokalita: "Bratislava II", ulica: "Miletičova" },
  { display: "Ružinovská → Ružinov", lokalita: "Bratislava II", ulica: "Ružinovská" },
  { display: "Záhradnícka → Ružinov", lokalita: "Bratislava II", ulica: "Záhradnícka" },
  // Bratislava — Staré Mesto
  { display: "Obchodná → Staré Mesto", lokalita: "Bratislava I", ulica: "Obchodná" },
  { display: "Laurinská → Staré Mesto", lokalita: "Bratislava I", ulica: "Laurinská" },
  { display: "Ventúrska → Staré Mesto", lokalita: "Bratislava I", ulica: "Ventúrska" },
  { display: "Michalská → Staré Mesto", lokalita: "Bratislava I", ulica: "Michalská" },
  { display: "Palisády → Staré Mesto", lokalita: "Bratislava I", ulica: "Palisády" },
  { display: "Štefánikova → Staré Mesto", lokalita: "Bratislava I", ulica: "Štefánikova" },
  { display: "Grösslingová → Staré Mesto", lokalita: "Bratislava I", ulica: "Grösslingová" },
  // Bratislava — Nové Mesto
  { display: "Vajnorská → Nové Mesto", lokalita: "Bratislava III", ulica: "Vajnorská" },
  { display: "Račianska → Nové Mesto", lokalita: "Bratislava III", ulica: "Račianska" },
  { display: "Trnavská cesta → Nové Mesto", lokalita: "Bratislava III", ulica: "Trnavská cesta" },
  { display: "Hálkova → Nové Mesto", lokalita: "Bratislava III", ulica: "Hálkova" },
  // Bratislava — Karlova Ves / Dúbravka
  { display: "Karloveská → Karlova Ves", lokalita: "Bratislava IV", ulica: "Karloveská" },
  { display: "Saratovská → Dúbravka", lokalita: "Bratislava IV", ulica: "Saratovská" },
  { display: "Pri kríži → Dúbravka", lokalita: "Bratislava IV", ulica: "Pri kríži" },
];

function normalizeSearch(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s]/g, "");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-\(\)]/g, "").replace(/^00/, "+");
}

function getLastDigits(phone: string, count: number): string {
  return phone.replace(/\D/g, "").slice(-count);
}

export default function NewKlientModal({ open, onClose, onCreated, onSaved, onLvPrompt, initialPhone, showTypKlienta = false, defaultTyp = "predavajuci", editKlient }: Props) {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const isEdit = !!editKlient;
  const [myMaklerUuid, setMyMaklerUuid] = useState<string | null>(null);
  useEffect(() => {
    if (authUser?.id) getMaklerUuid(authUser.id).then(setMyMaklerUuid);
  }, [authUser?.id]);
  const [telefon, setTelefon] = useState(editKlient?.telefon || initialPhone || "");
  const [meno, setMeno] = useState(editKlient?.meno || "");
  const [email, setEmail] = useState(editKlient?.email || "");
  // TASK 10: warning ak email už existuje u iného klienta
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  async function checkEmailDuplicate(value: string) {
    const v = value.trim().toLowerCase();
    if (!v || (editKlient?.email || "").toLowerCase() === v) {
      setEmailWarning(null);
      return;
    }
    const { data } = await supabase
      .from("klienti")
      .select("id, meno")
      .ilike("email", v)
      .limit(1);
    const dup = data?.[0] as { id: string; meno: string } | undefined;
    if (dup && dup.id !== editKlient?.id) {
      setEmailWarning(`Tento email už používa klient: ${dup.meno}`);
    } else {
      setEmailWarning(null);
    }
  }
  const [status, setStatus] = useState(editKlient?.status || "novy_kontakt");
  const [typKlienta, setTypKlienta] = useState<string>(editKlient?.typ || defaultTyp);
  const [typNehnutelnosti, setTypNehnutelnosti] = useState("");
  const [lokalitaInput, setLokalitaInput] = useState(editKlient?.lokalita || "");
  // lokalitaValue = "confirmed" DB value — len ak je v LOKALITY_DB (edit mode: overíme)
  const [lokalitaValue, setLokalitaValue] = useState(() => {
    if (!editKlient?.lokalita) return "";
    const val = editKlient.lokalita;
    const isValid = LOKALITY_DB.some(l => !l.ulica && l.lokalita === val);
    return isValid ? val : "";
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ulica, setUlica] = useState("");
  const [cisloDomu, setCisloDomu] = useState("");
  const [ulicaSuggestions, setUlicaSuggestions] = useState<{ label: string; street: string; city: string; lokalita: string }[]>([]);
  const [showUlicaSuggestions, setShowUlicaSuggestions] = useState(false);
  const ulicaSuggestRef = useRef<HTMLDivElement>(null);
  const [datumStretnutia, setDatumStretnutia] = useState("");
  const [datumNarodenia, setDatumNarodenia] = useState("");
  const [odkaz, setOdkaz] = useState("");
  const [poznamka, setPoznamka] = useState(editKlient?.poznamka || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ lokalita?: string; ulica?: string; cislo?: string }>({});
  const [calendarSynced, setCalendarSynced] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Sync state when editKlient changes (e.g. modal stays mounted)
  useEffect(() => {
    if (editKlient) {
      setTelefon(editKlient.telefon || "");
      setMeno(editKlient.meno || "");
      setEmail(editKlient.email || "");
      setStatus(editKlient.status || "novy_kontakt");
      setTypKlienta(editKlient.typ || defaultTyp);
      setLokalitaInput(editKlient.lokalita || "");
      const editLokVal = editKlient.lokalita || "";
      setLokalitaValue(LOKALITY_DB.some(l => !l.ulica && l.lokalita === editLokVal) ? editLokVal : "");
      setDatumNarodenia(editKlient.datum_narodenia ? editKlient.datum_narodenia.slice(0, 10) : "");

      // Parse poznamka for structured fields (Adresa, Stretnutie, Typ nehnuteľnosti, Odkaz)
      const raw = editKlient.poznamka || "";
      const lines = raw.split("\n");
      let parsedUlica = "", parsedCislo = "", parsedDatum = "", parsedTyp = "", parsedOdkaz = "";
      const remaining: string[] = [];
      for (const line of lines) {
        const adr = line.match(/^Adresa:\s*(.+?)(?:,\s*(.+))?$/);
        const str = line.match(/^Stretnutie:\s*(.+)$/);
        const typM = line.match(/^Typ nehnuteľnosti:\s*(.+)$/);
        const odkM = line.match(/^Odkaz:\s*(.+)$/);
        if (adr) {
          const addrPart = adr[1].trim();
          const m = addrPart.match(/^(.*?)\s+(\d+\S*)$/);
          if (m) { parsedUlica = m[1].trim(); parsedCislo = m[2].trim(); }
          else { parsedUlica = addrPart; }
        } else if (str) {
          parsedDatum = str[1].trim();
        } else if (typM) {
          parsedTyp = typM[1].trim();
        } else if (odkM) {
          parsedOdkaz = odkM[1].trim();
        } else {
          remaining.push(line);
        }
      }
      setUlica(parsedUlica);
      setCisloDomu(parsedCislo);
      // Prefer real DB column datum_naberu if present
      if (editKlient.datum_naberu) {
        const d = new Date(editKlient.datum_naberu);
        const pad = (n: number) => String(n).padStart(2, "0");
        setDatumStretnutia(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
      } else {
        setDatumStretnutia(parsedDatum);
      }
      if (parsedTyp) setTypNehnutelnosti(parsedTyp);
      setOdkaz(parsedOdkaz);
      setPoznamka(remaining.join("\n").trim());
      setSaveError("");
    }
  }, [editKlient?.id, editKlient?.poznamka]);

  // Duplicate check
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [dupLevel, setDupLevel] = useState<"none" | "warning" | "critical">("none");
  const [forceCreate, setForceCreate] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCalendar = status === "dohodnuty_naber" || status === "volat_neskor";

  // Auto-check phone (skip in edit mode)
  useEffect(() => {
    if (isEdit) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const norm = normalizePhone(telefon);
    const digits = norm.replace(/\D/g, "");
    if (digits.length < 9) {
      setChecked(false); setDuplicates([]); setDupLevel("none"); setForceCreate(false); setAutoFilled(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      const last9 = getLastDigits(norm, 9);
      const { data } = await supabase
        .from("klienti")
        .select("id, meno, telefon, email, status, typ, lokalita, poznamka, makler_id, created_at")
        .ilike("telefon", `%${last9}%`);
      const hits = (data as DuplicateHit[] | null) ?? [];
      setDuplicates(hits);
      setChecked(true);
      setChecking(false);
      if (hits.length === 0) {
        setDupLevel("none");
      } else {
        // Auto-fill meno a email z nájdeného klienta
        const match = hits[0];
        if (!autoFilled) {
          if (match.meno && !meno.trim()) setMeno(match.meno);
          if (match.email && !email.trim()) setEmail(match.email);
          setAutoFilled(true);
        }
        // Kritická duplicita = telefón + meno + (email ALEBO lokalita)
        const hasCritical = hits.some(h => {
          const hLast9 = getLastDigits(h.telefon || "", 9);
          if (hLast9 !== last9) return false;
          const sameName = meno.trim() && h.meno?.toLowerCase() === meno.trim().toLowerCase();
          if (!sameName) return false;
          const sameEmail = email.trim() && h.email && h.email.toLowerCase() === email.trim().toLowerCase();
          const sameLokalita = lokalitaValue && h.lokalita && h.lokalita.toLowerCase() === lokalitaValue.toLowerCase();
          return sameEmail || sameLokalita;
        });
        setDupLevel(hasCritical ? "critical" : "warning");
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [telefon, meno, email, lokalitaValue]);

  useEffect(() => {
    if (!showCalendar) { setDatumStretnutia(""); setCalendarSynced(false); }
  }, [showCalendar]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) setShowSuggestions(false);
      if (ulicaSuggestRef.current && !ulicaSuggestRef.current.contains(e.target as Node)) setShowUlicaSuggestions(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Ulica autocomplete — lokálna DB, žiadne API
  useEffect(() => {
    if (ulica.trim().length < 2) { setUlicaSuggestions([]); setShowUlicaSuggestions(false); return; }
    const results = searchStreets(ulica.trim(), lokalitaValue || undefined);
    const mapped = results.map(r => ({ label: `${r.street}, ${r.city}`, street: r.street, city: r.city, lokalita: r.lokalita }));
    setUlicaSuggestions(mapped);
    setShowUlicaSuggestions(mapped.length > 0);
  }, [ulica, lokalitaValue]);

  // Lokalita — existujúci klienti s rovnakou oblasťou
  const [lokalitaKlienti, setLokalitaKlienti] = useState<{ id: string; meno: string; telefon?: string; status?: string }[]>([]);
  const [lokalitaKlientConfirm, setLokalitaKlientConfirm] = useState<{ id: string; meno: string } | null>(null);
  const lokalitaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lokalitaDebounceRef.current) clearTimeout(lokalitaDebounceRef.current);
    const input = lokalitaInput.trim();
    if (input.length < 2) { setLokalitaKlienti([]); return; }
    lokalitaDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase.from("klienti")
        .select("id,meno,telefon,status")
        .ilike("lokalita", `%${input}%`)
        .limit(3);
      setLokalitaKlienti(data ?? []);
    }, 400);
    return () => { if (lokalitaDebounceRef.current) clearTimeout(lokalitaDebounceRef.current); };
  }, [lokalitaInput]);

  if (open === false) return null;

  // Smart locality search
  const normalizedInput = normalizeSearch(lokalitaInput);
  const suggestions = normalizedInput.length >= 2
    ? LOKALITY_DB.filter(l => !l.ulica && normalizeSearch(l.display).includes(normalizedInput)).slice(0, 8)
    : [];
  // Double-check: lokalitaValue is valid ONLY if it's actually in LOKALITY_DB
  const isValidLokalita = lokalitaValue !== "" && LOKALITY_DB.some(l => !l.ulica && l.lokalita === lokalitaValue);
  const showNotFound = normalizedInput.length >= 2 && suggestions.length === 0 && !isValidLokalita;

  function selectLokalita(entry: LokalitaEntry) {
    if (entry.ulica) {
      const displayName = LOKALITY_DB.find(l => l.lokalita === entry.lokalita && !l.ulica)?.display || entry.lokalita;
      setLokalitaInput(displayName);
      setLokalitaValue(entry.lokalita);
      setUlica(entry.ulica);
    } else {
      setLokalitaInput(entry.display);
      setLokalitaValue(entry.lokalita);
      setUlica(""); setCisloDomu(""); // Reset ulica when locality changes
    }
    setUlicaSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSave() {
    if (!telefon.trim() || !meno.trim()) return;
    if (!isEdit && !typNehnutelnosti) return;
    if (!isEdit && dupLevel === "critical" && !forceCreate) return;

    // Validácia adresy — lokalita musí byť vybraná z dropdownu
    const addrErrors: typeof fieldErrors = {};
    if (!isValidLokalita) {
      addrErrors.lokalita = "Vyber mesto / mestskú časť zo zoznamu";
    }
    // Ulica a číslo sú povinné až pri dohodnutom nábere, nie pri vytváraní kontaktu
    if (Object.keys(addrErrors).length > 0) {
      setFieldErrors(addrErrors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    setSaveError("");

    const basePayload: Record<string, unknown> = {
      meno: meno.trim(),
      telefon: normalizePhone(telefon),
      email: email.trim() || null,
      lokalita: lokalitaValue || null,
      poznamka: (() => {
        // Skladáme adresu len z neprázdnych častí (žiadne "." alebo prázdne stringy)
        const ulicaT = (ulica || "").trim();
        const cisloT = (cisloDomu || "").trim();
        const lokalT = (lokalitaInput || lokalitaValue || "").trim();
        const adresaParts = [
          [ulicaT, cisloT].filter(p => p && p !== ".").join(" ").trim(),
          lokalT && lokalT !== "." ? lokalT : "",
        ].filter(p => p && p !== ".");
        const adresaStr = adresaParts.join(", ").trim();

        return [
          odkaz.trim() ? `Odkaz: ${odkaz.trim()}` : "",
          adresaStr ? `Adresa: ${adresaStr}` : "",
          typNehnutelnosti && typNehnutelnosti.trim() ? `Typ nehnuteľnosti: ${typNehnutelnosti}` : "",
          datumStretnutia ? `Stretnutie: ${datumStretnutia}` : "",
          !isEdit && dupLevel === "critical" ? `⚠️ DUPLICITA — čaká na schválenie manažérom` : "",
          poznamka.trim(),
        ].filter(Boolean).join("\n") || null;
      })(),
    };
    // Only include status and typ if they are valid (avoid CHECK constraint errors)
    if (!isEdit || status !== editKlient?.status) {
      basePayload.status = dupLevel === "critical" ? "caka_na_schvalenie" : status;
    }
    if (!isEdit || typKlienta !== editKlient?.typ) {
      basePayload.typ = typKlienta;
    }
    // For non-edit, always include
    if (!isEdit) {
      basePayload.status = dupLevel === "critical" ? "caka_na_schvalenie" : status;
      basePayload.typ = typKlienta;
    }
    // Persist datum stretnutia (náber) as real column when applicable
    if (showCalendar && datumStretnutia) {
      basePayload.datum_naberu = new Date(datumStretnutia).toISOString();
    }
    if (datumNarodenia) {
      basePayload.datum_narodenia = datumNarodenia;
    }
    const payload = basePayload;

    console.log("[NewKlientModal] isEdit:", isEdit, "id:", editKlient?.id, "payload:", JSON.stringify(payload));

    if (!authUser?.id) {
      setSaving(false);
      setSaveError("Nie si prihlásený — relogni sa.");
      return;
    }

    // makler_id sa odvodí z user.id v API endpointe (anti-impersonation),
    // takže ho z payload odstránime — zabráni nezamýšľaným zmenám vlastníctva.
    const cleanPayload = { ...payload };
    delete (cleanPayload as Record<string, unknown>).makler_id;

    const result = isEdit
      ? await klientUpdate(authUser.id, editKlient!.id, cleanPayload)
      : await klientInsert(authUser.id, cleanPayload);

    const { error, data: resultData } = result;
    console.log("[NewKlientModal] result:", JSON.stringify({ error, count: resultData?.length, data: resultData?.[0] }));

    // Detect silent failure
    if (!error && isEdit && (!resultData || resultData.length === 0)) {
      setSaving(false);
      setSaveError(`Zmeny sa neuložili. ID: ${editKlient!.id}`);
      return;
    }

    if (!error && !isEdit && dupLevel !== "none") {
      await supabase.from("logy").insert({
        typ: dupLevel === "critical" ? "duplicita_kriticka" : "duplicita_upozornenie",
        popis: `Duplicitný klient: ${meno.trim()} (${normalizePhone(telefon)}). Zhoduje sa s: ${duplicates.map(d => `${d.meno} (${d.telefon})`).join(", ")}`,
        metadata: {
          novy_telefon: normalizePhone(telefon),
          existujuce: duplicates.map(d => ({ id: d.id, meno: d.meno, telefon: d.telefon, status: d.status })),
        },
      });

      // Návrh na doplnenie údajov pôvodnému maklérovi
      for (const dup of duplicates) {
        const newData: Record<string, string> = {};
        if (email.trim() && !dup.email) newData.email = email.trim();
        if (meno.trim() && !dup.meno) newData.meno = meno.trim();
        if (Object.keys(newData).length > 0) {
          await supabase.from("logy").insert({
            typ: "navrh_doplnenia",
            popis: `💡 Nový makler pridal klienta ${meno.trim()} (${normalizePhone(telefon)}) — navrhuje doplniť: ${Object.entries(newData).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
            metadata: {
              klient_id: dup.id,
              navrhovane_udaje: newData,
              stav: "caka_na_schvalenie",
            },
          });
        }
      }
    }

    // Calendar sync via Google Calendar OAuth (new + edit)
    if (!error && showCalendar && datumStretnutia && authUser?.id) {
      try {
        const startDt = new Date(datumStretnutia);
        const durationMs = status === "dohodnuty_naber" ? 60 * 60 * 1000 : 15 * 60 * 1000;
        const endDt = new Date(startDt.getTime() + durationMs);
        const fullAddress = ulica ? `${ulica}${cisloDomu ? ` ${cisloDomu}` : ""}, ${lokalitaInput || lokalitaValue}` : (lokalitaInput || lokalitaValue || "");
        const body = {
          userId: authUser.id,
          summary: status === "dohodnuty_naber" ? `Náber: ${meno.trim()}` : `Zavolať: ${meno.trim()}`,
          start: startDt.toISOString(),
          end: endDt.toISOString(),
          location: fullAddress,
          description: `Klient: ${meno.trim()}\nTel: ${normalizePhone(telefon)}${fullAddress ? `\nAdresa: ${fullAddress}` : ""}\nTyp: ${typNehnutelnosti}`,
        };
        const existingEventId = (editKlient as { calendar_event_id?: string } | null)?.calendar_event_id;
        if (isEdit && existingEventId) {
          await fetch("/api/google/calendar", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, eventId: existingEventId }),
          });
        } else {
          const res = await fetch("/api/google/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => null);
          const newEventId = json?.event?.id;
          const targetId = (isEdit ? editKlient?.id : (resultData?.[0] as { id?: string } | undefined)?.id) as string | undefined;
          if (newEventId && targetId && authUser?.id) {
            await klientUpdate(authUser.id, targetId, { calendar_event_id: newEventId });
          }
        }
      } catch { /* silent */ }
    }

    setSaving(false);
    if (error) {
      console.error("[NewKlientModal] Chyba pri ukladaní:", error);
      setSaveError(error.message || "Nepodarilo sa uložiť klienta");
      return;
    }
    setTelefon(""); setMeno(""); setEmail(""); setStatus("novy_kontakt");
    setTypKlienta("kupujuci"); setTypNehnutelnosti("");
    setLokalitaInput(""); setLokalitaValue("");
    setUlica(""); setCisloDomu(""); setDatumStretnutia(""); setOdkaz(""); setPoznamka(""); setDatumNarodenia("");
    setChecked(false); setDuplicates([]); setDupLevel("none");
    setCalendarSynced(false); setSaveError("");
    // LV prompt — ak dohodnutý náber a nemá LV
    if (status === "dohodnuty_naber") {
      const hasLv = isEdit ? !!(editKlient?.lv_data && Object.keys(editKlient.lv_data).length > 0) : false;
      if (!hasLv) {
        const klientId = (isEdit ? editKlient?.id : (resultData?.[0] as { id?: string } | undefined)?.id) as string | undefined;
        const klientMeno = meno.trim();
        if (klientId) onLvPrompt?.({ id: klientId, meno: klientMeno });
      }
    }
    // Log internej poznámky do timeline pri vytvorení nového klienta
    if (!isEdit && poznamka.trim()) {
      const newKlientId = (resultData?.[0] as { id?: string } | undefined)?.id;
      if (newKlientId) {
        fetch("/api/klient-udalosti", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ klient_id: newKlientId, typ: "poznamka", popis: poznamka.trim(), autor: authUser?.id || null }),
        }).catch(() => {});
      }
    }
    onCreated?.();
    onSaved?.();
    onClose();
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px",
    color: "var(--text-primary)", outline: "none",
  };
  const labelSt: React.CSSProperties = {
    fontSize: "11px", fontWeight: "600", color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px",
  };
  const selectSt: React.CSSProperties = {
    ...inputSt, cursor: "pointer", appearance: "none" as const,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", borderRadius: "20px", padding: "28px",
        width: "520px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0, color: "var(--text-primary)" }}>{isEdit ? "Upraviť klienta" : "+ Nový klient"}</h2>
          <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "none", background: "var(--bg-elevated)", cursor: "pointer", fontSize: "16px", color: "var(--text-muted)" }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Telefón */}
          <div>
            <div style={labelSt}>Telefón *</div>
            <div style={{ position: "relative" }}>
              <PhoneInput
                value={telefon}
                onChange={setTelefon}
                autoFocus
                borderOverride={checked ? (dupLevel === "none" ? "2px solid #10B981" : dupLevel === "warning" ? "2px solid #F59E0B" : "2px solid #EF4444") : undefined}
                placeholder="+421 900 000 000"
              />
              {checking && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", zIndex: 5 }}>⏳</span>}
              {checked && !checking && <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", zIndex: 5 }}>{dupLevel === "none" ? "✅" : dupLevel === "warning" ? "⚠️" : "🚨"}</span>}
            </div>

            {checked && dupLevel === "none" && (
              <div style={{ marginTop: "8px", padding: "8px 12px", background: "#D1FAE5", borderRadius: "8px", fontSize: "12px", color: "#065F46", fontWeight: "500" }}>
                ✅ Číslo nie je v databáze
              </div>
            )}
            {/* MÔJ KLIENT — ak duplicate patrí prihlásenému maklerovi, navigujeme do jeho karty namiesto vytvárania nového klienta */}
            {checked && myMaklerUuid && duplicates.some(d => d.makler_id === myMaklerUuid) && (() => {
              const myHits = duplicates.filter(d => d.makler_id === myMaklerUuid);
              return (
                <div style={{ marginTop: "8px", padding: "12px 14px", background: "#DBEAFE", borderRadius: "10px", border: "1px solid #60A5FA" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#1E40AF", marginBottom: "6px" }}>
                    ℹ️ Toto je {myHits.length === 1 ? "tvoj existujúci klient" : "tvoj existujúci klient (viac zhôd)"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#1E40AF", marginBottom: "10px" }}>
                    Namiesto nového klienta pridaj novú nehnuteľnosť do jeho karty.
                  </div>
                  {myHits.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        window.location.href = `/klienti/${d.id}?tab=nehnutelnosti`;
                      }}
                      style={{
                        display: "block", width: "100%", marginBottom: "6px",
                        padding: "10px 12px", background: "#fff", border: "1px solid #93C5FD",
                        borderRadius: "8px", fontSize: "13px", color: "#1E40AF", cursor: "pointer",
                        textAlign: "left", fontWeight: "500",
                      }}>
                      📂 {d.meno} · {d.typ || "—"} · <span style={{ fontSize: "11px" }}>{d.lokalita || "—"}</span>
                      <span style={{ float: "right", fontSize: "11px", fontWeight: "700" }}>Otvoriť kartu →</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            {checked && duplicates.some(d => d.status === "realitna_kancelaria" || d.status === "nechce_rk") && (
              <div style={{ marginTop: "8px", padding: "10px 12px", background: "#FEE2E2", borderRadius: "8px", border: "1px solid #EF4444", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>⚠️</span>
                <div style={{ fontSize: "12px", color: "#991B1B", fontWeight: 600, lineHeight: 1.4 }}>
                  Pozor: toto číslo patrí <strong>realitnej kancelárii</strong>, nie súkromnému predajcovi.
                </div>
              </div>
            )}
            {checked && dupLevel === "warning" && (
              <div style={{ marginTop: "8px", padding: "10px 12px", background: "#FEF3C7", borderRadius: "8px", border: "1px solid #F59E0B" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#92400E", marginBottom: "6px" }}>⚠️ Rovnaké číslo, iné údaje</div>
                {duplicates.map(d => (
                  <div key={d.id} style={{ fontSize: "12px", color: "#92400E", padding: "4px 8px", background: "rgba(245,158,11,0.08)", borderRadius: "6px", marginBottom: "3px" }}>
                    <strong>{d.meno}</strong> · {d.typ || "—"} · {d.lokalita || "—"} · {d.status || "—"}
                  </div>
                ))}
              </div>
            )}
            {checked && dupLevel === "critical" && (
              <div style={{ marginTop: "8px", padding: "10px 12px", background: "#FEE2E2", borderRadius: "8px", border: "1px solid #EF4444" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#991B1B", marginBottom: "4px" }}>🚨 ÚPLNÁ DUPLICITA</div>
                <div style={{ fontSize: "11px", color: "#991B1B", marginBottom: "6px" }}>Klient bude <strong>neaktívny</strong> kým ho manažér neschváli.</div>
                {duplicates.map(d => (
                  <div key={d.id} style={{ fontSize: "12px", color: "#991B1B", padding: "4px 8px", background: "rgba(239,68,68,0.08)", borderRadius: "6px", marginBottom: "3px" }}>
                    <strong>{d.meno}</strong> · {d.telefon} · {d.status || "—"} · {d.status || "—"}
                  </div>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", fontSize: "12px", color: "#991B1B", cursor: "pointer" }}>
                  <input type="checkbox" checked={forceCreate} onChange={e => setForceCreate(e.target.checked)} />
                  Vytvoriť napriek duplicite (bude neaktívny)
                </label>
              </div>
            )}
          </div>

          {/* Meno */}
          <div>
            <div style={labelSt}>Meno a priezvisko *</div>
            <input style={inputSt} placeholder="Meno a priezvisko" value={meno} onChange={e => setMeno(e.target.value)} />
          </div>

          {/* Email + Dátum narodenia */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <div style={labelSt}>Email</div>
              <input
                style={inputSt}
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={e => checkEmailDuplicate(e.target.value)}
              />
              {emailWarning && (
                <div style={{
                  marginTop: "6px", padding: "6px 10px", borderRadius: "6px",
                  background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E",
                  fontSize: "11px", lineHeight: 1.4,
                }}>
                  ⚠️ {emailWarning}
                </div>
              )}
            </div>
            <div>
              <div style={labelSt}>Dátum narodenia</div>
              <input type="date" style={inputSt} value={datumNarodenia} onChange={e => setDatumNarodenia(e.target.value)} />
            </div>
          </div>

          {/* Status + Typ klienta */}
          <div style={{ display: "grid", gridTemplateColumns: showTypKlienta ? "1fr 1fr" : "1fr", gap: "12px" }}>
            <div>
              <div style={labelSt}>Status *</div>
              <select value={status} onChange={e => setStatus(e.target.value)} style={selectSt}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {showTypKlienta && (
              <div>
                <div style={labelSt}>Typ klienta *</div>
                <select value={typKlienta} onChange={e => setTypKlienta(e.target.value)} style={selectSt}>
                  <option value="kupujuci">Kupujúci</option>
                  <option value="predavajuci">Predávajúci</option>
                  <option value="oboje">Kupujúci + Predávajúci</option>
                  <option value="prenajimatel">Prenajímateľ</option>
                </select>
              </div>
            )}
          </div>

          {/* Dohodnutý náber — checklist */}
          {status === "dohodnuty_naber" && (() => {
            const hasLv = !!(editKlient?.lv_data && Object.keys(editKlient.lv_data).length > 0);
            const hasOdkaz = odkaz.trim().length > 0;
            return (
              <div style={{
                background: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: "10px",
                padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px",
              }}>
                <div style={{ fontWeight: "600", fontSize: "13px", color: "#92400E" }}>
                  📋 Dohodnutý náber — priprav podklady
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "13px", color: hasLv ? "#065F46" : "#B45309", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{hasLv ? "✅" : "⬜"}</span>
                    <span>
                      {hasLv ? "LV nahraté na karte klienta" : "LV ešte nie je nahraté — vlož ho na kartu klienta"}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: hasOdkaz ? "#065F46" : "#B45309", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{hasOdkaz ? "✅" : "⬜"}</span>
                    <span>
                      {hasOdkaz ? "Odkaz na nehnuteľnosť vyplnený" : "Chýba odkaz na nehnuteľnosť — doplň ho nižšie"}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#78716C", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <span>🔍</span>
                    <span>Skontroluj, či sa nehnuteľnosť nepredáva na iných portáloch (NEHNUTELNOSTI.SK, REALITY.SK, BAZOS...)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Typ nehnuteľnosti */}
          <div>
            <div style={labelSt}>Typ nehnuteľnosti *</div>
            <select value={typNehnutelnosti} onChange={e => setTypNehnutelnosti(e.target.value)} style={selectSt}>
              <option value="">— vyberte —</option>
              {TYP_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Lokalita — smart autocomplete */}
          <div ref={suggestRef} style={{ position: "relative" }}>
            <div style={labelSt}>Mesto / Obec * <span style={{ fontWeight: "400", textTransform: "none", color: "var(--text-muted)" }}>(nie ulica!)</span></div>
            <input
              style={{ ...inputSt, border: fieldErrors.lokalita ? "2px solid #EF4444" : isValidLokalita ? "2px solid #10B981" : "1px solid var(--border)" }}
              placeholder="napr. Bratislava, Košice, Nitra, Žilina..."
              value={lokalitaInput}
              onChange={e => { setLokalitaInput(e.target.value); setLokalitaValue(""); setShowSuggestions(true); setFieldErrors(p => ({ ...p, lokalita: undefined })); }}
              onFocus={() => { if (normalizeSearch(lokalitaInput).length >= 2) setShowSuggestions(true); }}
              onBlur={() => { if (!isValidLokalita) { setLokalitaInput(""); setLokalitaValue(""); } setShowSuggestions(false); }}
            />
            {fieldErrors.lokalita && <div style={{ fontSize: "11px", color: "#EF4444", marginTop: "4px" }}>⚠ {fieldErrors.lokalita}</div>}
            {isValidLokalita && !fieldErrors.lokalita && <div style={{ fontSize: "11px", color: "#065F46", marginTop: "4px" }}>→ {lokalitaValue}</div>}
            {!isValidLokalita && !fieldErrors.lokalita && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Mestská časť alebo obec — ulicu vyplníš nižšie
              </div>
            )}
            {showSuggestions && (suggestions.length > 0 || lokalitaKlienti.length > 0) && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", marginTop: "4px", overflow: "hidden",
              }}>
                {suggestions.length > 0 && (
                  <>
                    {lokalitaKlienti.length > 0 && (
                      <div style={{ padding: "6px 14px 4px", fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
                        Mestá / Obce
                      </div>
                    )}
                    {suggestions.map((s, i) => (
                      <div key={i} onMouseDown={e => { e.preventDefault(); selectLokalita(s); }} style={{
                        padding: "10px 14px", fontSize: "13px", cursor: "pointer",
                        borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{s.display}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{s.lokalita}</span>
                      </div>
                    ))}
                  </>
                )}
                {lokalitaKlienti.length > 0 && (
                  <>
                    <div style={{ padding: "6px 14px 4px", fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderTop: suggestions.length > 0 ? "1px solid var(--border)" : "none" }}>
                      Existujúci klienti
                    </div>
                    {lokalitaKlienti.map((k, i) => (
                      <div key={k.id} onMouseDown={e => { e.preventDefault(); setLokalitaKlientConfirm(k); setShowSuggestions(false); }} style={{
                        padding: "10px 14px", fontSize: "13px", cursor: "pointer",
                        borderBottom: i < lokalitaKlienti.length - 1 ? "1px solid var(--border)" : "none",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <span style={{ color: "var(--text-primary)", fontWeight: "500" }}>{k.meno}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{k.telefon || k.status || ""}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            {showNotFound && (
              <div style={{ fontSize: "11px", color: "#D97706", marginTop: "4px" }}>
                ⚠ Obec nenájdená — skontroluj pravopis (napr. Bratislava, Petržalka, Košice)
              </div>
            )}
          </div>

          {/* Ulica + číslo — zobrazí sa až keď je vybraná lokalita */}
          {isValidLokalita && (
          <div style={{ display: "flex", gap: "10px" }}>
            <div ref={ulicaSuggestRef} style={{ position: "relative", flex: 1 }}>
              <div style={labelSt}>Ulica</div>
              <input
                style={{ ...inputSt, border: fieldErrors.ulica ? "2px solid #EF4444" : ulica.trim() ? "2px solid #10B981" : "1px solid var(--border)" }}
                placeholder={`Ulica v ${lokalitaInput || lokalitaValue}...`} value={ulica}
                onChange={e => { setUlica(e.target.value); setShowUlicaSuggestions(true); setFieldErrors(p => ({ ...p, ulica: undefined })); }}
                onFocus={() => { if (ulicaSuggestions.length > 0) setShowUlicaSuggestions(true); }}
                autoComplete="off"
              />
              {fieldErrors.ulica && <div style={{ fontSize: "11px", color: "#EF4444", marginTop: "4px" }}>⚠ {fieldErrors.ulica}</div>}
              {showUlicaSuggestions && ulicaSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  borderRadius: "10px", marginTop: "4px", overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}>
                  {ulicaSuggestions.map((s, i) => (
                    <div key={i} onClick={() => {
                      setUlica(s.street);
                      setShowUlicaSuggestions(false);
                    }}
                      style={{
                        padding: "10px 14px", cursor: "pointer", fontSize: "13px",
                        color: "var(--text-primary)", borderBottom: i < ulicaSuggestions.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      📍 {s.street}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ width: "90px", flexShrink: 0 }}>
              <div style={labelSt}>Číslo</div>
              <input
                style={{ ...inputSt, border: fieldErrors.cislo ? "2px solid #EF4444" : cisloDomu.trim() ? "2px solid #10B981" : "1px solid var(--border)" }}
                placeholder="napr. 25" value={cisloDomu}
                onChange={e => { setCisloDomu(e.target.value); setFieldErrors(p => ({ ...p, cislo: undefined })); }}
              />
              {fieldErrors.cislo && <div style={{ fontSize: "11px", color: "#EF4444", marginTop: "4px" }}>⚠ {fieldErrors.cislo}</div>}
            </div>
          </div>
          )}

          {/* Kalendár — len pre dohodnutý náber / volať neskôr */}
          {showCalendar && (
            <div>
              <div style={labelSt}>
                {status === "dohodnuty_naber" ? "Dátum stretnutia *" : "Zavolať dňa *"}
                <span style={{ textTransform: "none", fontWeight: "400", marginLeft: "6px" }}>— sync s Google Kalendárom</span>
              </div>
              <input type="datetime-local" style={inputSt} value={datumStretnutia} onChange={e => { setDatumStretnutia(e.target.value); setCalendarSynced(false); }} />
            </div>
          )}

          {/* Odkaz na nehnuteľnosť */}
          <div>
            <div style={labelSt}>Odkaz na nehnuteľnosť</div>
            <input style={inputSt} placeholder="https://nehnutelnosti.sk/... alebo realit.sk/..." value={odkaz} onChange={e => setOdkaz(e.target.value)} />
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>Link na inzerát — studený náber, Google Maps pin</div>
          </div>

          {/* Poznámka */}
          <div>
            <div style={labelSt}>Poznámka</div>
            <textarea style={{ ...inputSt, minHeight: "70px", resize: "vertical", fontFamily: "inherit" }}
              placeholder="Interná poznámka..."
              value={poznamka} onChange={e => setPoznamka(e.target.value)} />
          </div>
        </div>

        {/* Error */}
        {saveError && (
          <div style={{ marginTop: "16px", padding: "10px 14px", background: "#FEE2E2", borderRadius: "8px", fontSize: "13px", color: "#991B1B", fontWeight: "500" }}>
            ❌ {saveError}
          </div>
        )}

        {/* Confirm — existujúci klient z lokalita autocomplete */}
        {lokalitaKlientConfirm && (
          <div style={{
            marginTop: "16px", padding: "16px", background: "#EFF6FF",
            border: "1px solid #3B82F6", borderRadius: "12px",
          }}>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#1E40AF", marginBottom: "6px" }}>
              Existujúci klient: {lokalitaKlientConfirm.meno}
            </div>
            <div style={{ fontSize: "13px", color: "#3B82F6", marginBottom: "12px" }}>
              Tento klient už existuje v databáze. Chceš otvoriť jeho kartu?
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => { router.push(`/klienti/${lokalitaKlientConfirm.id}`); onClose(); }}
                style={{ padding: "8px 16px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                Otvoriť kartu
              </button>
              <button
                onClick={() => setLokalitaKlientConfirm(null)}
                style={{ padding: "8px 16px", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>
                Pokračovať bez neho
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "14px", cursor: "pointer", color: "var(--text-secondary)" }}>Zrušiť</button>
          <button onClick={handleSave}
            disabled={saving || !telefon.trim() || !meno.trim() || (!isEdit && !typNehnutelnosti) || (!isEdit && dupLevel === "critical" && !forceCreate)}
            style={{
              padding: "10px 24px", background: "#374151", color: "#fff", border: "none",
              borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              opacity: saving || !telefon.trim() || !meno.trim() || (!isEdit && !typNehnutelnosti) || (!isEdit && dupLevel === "critical" && !forceCreate) ? 0.4 : 1,
            }}>
            {saving ? "Ukladám..." : isEdit ? "Uložiť zmeny" : "Vytvoriť klienta"}
          </button>
        </div>
      </div>
    </div>
  );
}
