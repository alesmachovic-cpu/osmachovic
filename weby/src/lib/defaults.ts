/**
 * Predvolené dáta webov — stav publikovaných artefaktov zo 17. 9. 2026.
 * Používa ich migrácia 046 (seed) a tlačidlo „Nový maklér" v admine.
 */
import type { MaklerData, ManazerData, Nastavenia, Review, SectionId } from "./types";
import { SECTIONS_MAKLER, SECTIONS_MANAZER } from "./types";

const REVIEWS: Review[] = [
  { text: "Byt sa predal za dva týždne a za cenu, ktorú sme si odhadli na začiatku. Nič sme nemuseli riešiť sami.", author: "Jana K. · Google recenzia" },
  { text: "Pomoc aj v komplikovanej dedičskej situácii, kde sme netušili, ako začať.", author: "Peter M. · Google recenzia" },
  { text: "Na rovinu nám povedali, že naša predstava o cene je vysoká. Mali pravdu a ušetrili nám mesiace.", author: "Martina a Tomáš · Google recenzia" },
];

function allOn(list: Array<[SectionId, string]>): Partial<Record<SectionId, boolean>> {
  const o: Partial<Record<SectionId, boolean>> = {};
  list.forEach(([k]) => { o[k] = true; });
  return o;
}

const L = (type: string, title: string, price: string, meta: string, photo = "", url = "") => ({ type, title, price, meta, photo, url });
const S = (type: string, loc: string, days: string, year = "2026") => ({ type, loc, days, year });
const T = (b: string, s: string) => ({ b, s });
const VIDEOS = ["Najnovšie video", "Predchádzajúce", "Predchádzajúce"];

export const DEFAULT_NASTAVENIA: Nastavenia = {
  line: "Vianema s.r.o. · Pobočka Bratislava · Jašíkova 2, BC Kerametal",
  url: "https://www.vianemareal.eu/pobocka/1-Pobo%C4%8Dka%20Bratislava",
  asOf: "18. 9. 2026",
  gdpr: "Súhlasím so spracovaním údajov na účel kontaktovania.",
  videosNote: "Vždy najnovšie 3 videá — načítavajú sa automaticky z Instagramu makléra (ak vlastný nemá, z profilu Vianema).",
  areasNote: "Každá lokalita bude mať vlastnú stránku s cenami a nájmami — vstupný bod z Googlu.",
  manazerSlug: "ales-machovic",
};

export function emptyMakler(): MaklerData {
  return {
    typ: "makler", name: "Nový maklér", role: "Realitný maklér", phone: "+421 ", email: "@vianema.eu",
    ig: "https://www.instagram.com/vianema", googleUrl: "", listingsUrl: "", portrait: "",
    palette: "dunaj", sky: "ba", hero: "",
    headline: "Čo robím inak — jedna veta", sub: "Kde predávam a pre koho.",
    trust: [T("", ""), T("", ""), T("", ""), T("24 h", "rozbor ceny od makléra")],
    bio1: "", bio2: "", chips: [], team: true, branch: "",
    listings: [], sold: [], reviews: REVIEWS.map(r => ({ ...r })), videos: [...VIDEOS], areas: [],
    sections: allOn(SECTIONS_MAKLER),
  };
}

export const DEFAULT_MANAZER: ManazerData = {
  typ: "manazer",
  name: "Aleš Machovič", role: "Manažér pobočky Bratislava",
  eyebrow: "Realitný maklér · manažér pobočky Vianema Bratislava",
  h1: "Robím to pre peniaze.", h1em: "Pre tie vaše.",
  lede: "Zarábam len vtedy, keď vy predáte dobre. 13 rokov, 350+ predaných nehnuteľností v Bratislave — a rozbor ceny od človeka, nie od automatu, do 24 hodín.",
  phone: "+421 915 627 008", email: "machovic@vianema.eu",
  ig: "https://www.instagram.com/alesmachovic", igHandle: "@alesmachovic", yt: "https://www.youtube.com/@alesmachovic",
  logo: "/web/ales-logo.svg", portrait: "/web/ales-portret.jpg",
  listingsUrl: "https://www.vianemareal.eu/makler/36--ales-machovic", googleUrl: "",
  address: "Jašíkova 2, BC Kerametal, Bratislava",
  facts: [T("350+", "predaných nehnuteľností"), T("13", "rokov v realitách"), T("4,9", "hodnotenie na Google"), T("24 h", "rozbor ceny od makléra")],
  stepsTitle: "Tri veci, ktoré dostanete vždy",
  steps: [
    { n: "01", h: "Rozbor ceny do 24 hodín", p: "Nie číslo z kalkulačky. Porovnateľné predaje z vašej lokality, realizované ceny, a na rovinu, či sa oplatí predávať teraz." },
    { n: "02", h: "Plán predaja na papieri", p: "Čo sa spraví, kedy a za koľko — skôr, než niečo podpíšete. Aby ste vedeli, čo si kupujete." },
    { n: "03", h: "Prehľad počas celého predaja", p: "Koľko ľudí sa ozvalo, koľko prišlo, čo povedali. Žiadne „ozvem sa, keď bude niečo nové\"." },
  ],
  listings: [
    L("Byt", "1-izbový byt, Karlova Ves", "179 990 €", "34 m² · po rekonštrukcii · loggia, pivnica", "/web/ales-1.jpg", "https://www.vianemareal.eu/nehnutelnost/2225-na-predaj-zrekonstruovany-1-izbovy-byt-karlova-ves"),
    L("Dom", "Rodinný dom, Ivanka pri Dunaji", "559 999 €", "157 m² · zrekonštruovaný", "/web/ales-2.jpg", "https://www.vianemareal.eu/nehnutelnost/2224-zrekonstruovany-rodinny-dom-ivanka-pri-dunaji"),
    L("Dom", "7-izbový dom, Miloslavov", "414 999 €", "pozemok 1 685 m² · pôvodná časť obce", "/web/ales-3.jpg", "https://www.vianemareal.eu/makler/36--ales-machovic"),
  ],
  big: "Poviem vám aj to, čo sa počúva ťažšie — či je vaša cena reálna, alebo či sa oplatí počkať.",
  bio1: "Nehnuteľnosti predávam 13 rokov, vediem pobočku Vianema v Bratislave. Sústredím sa na Ružinov, Petržalku, Raču, Dúbravku a okolie — poznám nielen ceny, ale aj to, kto a prečo tu kupuje.",
  bio2: "Predaj vediem tak, aby ste mali celý čas prehľad: čo sa robí, kedy a za koľko. Moja odmena je provízia z predaja — preto sa mi oplatí to isté, čo vám: predať dobre a bez zbytočných mesiacov.",
  videos: ["Zdedený byt a daň", "Test zlého makléra", "Návnada na webe makléra"],
  reviews: [
    { text: "Byt sa predal za dva týždne a za cenu, ktorú Aleš odhadol na začiatku. Nič sme nemuseli riešiť sami.", author: "Jana K. · Google recenzia" },
    { text: "Poradil nám aj v komplikovanej dedičskej situácii, kde sme netušili, ako začať.", author: "Peter M. · Google recenzia" },
    { text: "Povedal nám na rovinu, že naša predstava o cene je vysoká. Mal pravdu a ušetril nám mesiace.", author: "Martina a Tomáš · Google recenzia" },
  ],
  sold: [S("2-izbový byt", "Ružinov, Jégeho alej", "14 dní"), S("Rodinný dom", "Rača, Plickova", "21 dní"), S("3-izbový byt", "Petržalka, Lúky", "9 dní"), S("Investičný byt", "Nové Mesto", "18 dní", "2025")],
  soldNote: "Ukážkový výber zo 350+ predaných. Pri nových ponukách sa počet dní počíta automaticky zo zmeny stavu na vianema.eu.",
  areas: ["Ružinov", "Petržalka", "Rača", "Dúbravka", "Karlova Ves", "Nové Mesto", "Ivanka pri Dunaji", "Miloslavov", "Dunajská Lužná"],
  teamTitle: "Vediem tím piatich maklérov",
  teamText: "Silvia, Nina, Nikoleta, Slavomír a Rastislav — každý s vlastným webom a vlastnou lokalitou.",
  valText: "Rozbor od makléra do 24 hodín — nie automatické číslo. Dve minúty, nič nepodpisujete. Dopyt príde len mne.",
  doneText: "Ďakujem. Ozvem sa do 24 hodín.",
  sections: allOn(SECTIONS_MANAZER),
};

type Seed = { slug: string; user_id: string | null; data: MaklerData };

function makler(slug: string, user_id: string | null, d: Partial<MaklerData>): Seed {
  return { slug, user_id, data: { ...emptyMakler(), ...d, sections: allOn(SECTIONS_MAKLER) } };
}

export const DEFAULT_MAKLERI: Seed[] = [
  makler("silvia-hurova", null, {
    name: "Silvia Hurová", role: "Realitná maklérka · Home stager", phone: "+421 917 133 880", email: "hurova@vianema.eu",
    ig: "https://www.instagram.com/homeshake_time", palette: "park", sky: "ba", portrait: "/web/silvia-portret.jpg",
    headline: "Byt pripravím tak, aby sa predal za viac",
    sub: "Obchodníčka roka Vianema 2025. Predaj, prenájom aj zastupovanie kupujúceho v Bratislave — s home stagingom pred každým predajom.",
    trust: [T("2025", "Obchodníčka roka Vianema"), T("Home staging", "príprava bytu na predaj"), T("SK · CZ · EN", "jazyky"), T("24 h", "rozbor ceny od maklérky")],
    bio1: "Predávam rezidenčné aj komerčné nehnuteľnosti, zastupujem kupujúcich pri výbere a riešim prenájmy. Pred predajom byt pripravím ako home stager — analytický prístup a dôraz na detail sa premietnu do ceny aj rýchlosti predaja.",
    bio2: "V roku 2025 som získala titul Obchodníčka roka za obrat realizovaných obchodov.",
    chips: ["Obchodníčka roka 2025", "Home stager", "SK · CZ · EN"], areas: ["Bratislava", "Ružinov", "Staré Mesto", "Petržalka", "Nové Mesto"],
    listings: [L("Byt", "4-izbový byt s terasou, Rača", "499 000 €", "112 m²", "/web/silvia-2.jpg"), L("Dom", "6-izbový dom s bazénom, Limbach", "1 050 000 €", "1 188 m²", "/web/silvia-3.jpg"), L("Prenájom", "4-izbový byt, Dunajská Streda", "570 € / mesiac", "86 m²", "/web/silvia-1.jpg")],
    sold: [S("3-izbový byt", "Ružinov", "12 dní"), S("2-izbový byt", "Staré Mesto", "19 dní"), S("Rodinný dom", "Chorvátsky Grob", "27 dní")],
  }),
  makler("nina-zigova", null, {
    name: "Ing. Nina Žigová", role: "Realitná maklérka", phone: "+421 903 444 272", email: "zigova@vianema.eu",
    ig: "https://www.instagram.com/ninocka_06", palette: "hrad", sky: "ba", portrait: "/web/nina-portret.jpg",
    headline: "Staré Mesto a Dúbravka — byty, ktoré poznám osobne",
    sub: "Byty, domy a pozemky v Bratislave. Domáce lokality: Staré Mesto a Dúbravka.",
    trust: [T("Staré Mesto", "a Dúbravka — domáce lokality"), T("SK · CZ", "jazyky"), T("Byty · domy", "· pozemky"), T("24 h", "rozbor ceny od maklérky")],
    bio1: "Zameriavam sa na byty, domy a pozemky v Bratislave, najmä v Starom Meste a Dúbravke — lokalitách, kde poznám ceny aj ľudí, ktorí tu kupujú.",
    bio2: "Komunikujem po slovensky aj po česky.",
    chips: ["Staré Mesto", "Dúbravka", "SK · CZ"], areas: ["Staré Mesto", "Dúbravka", "Karlova Ves", "Ružinov", "Bratislava"],
    listings: [L("Byt", "2-izbový byt, Staré Mesto — Vajanského nábrežie", "284 999 €", "60,77 m²", "/web/nina-1.jpg"), L("Byt", "4-izbový byt s parkovaním, Dúbravka", "424 999 €", "115 m²", "/web/nina-2.jpg")],
    sold: [S("2-izbový byt", "Staré Mesto", "16 dní"), S("3-izbový byt", "Dúbravka", "22 dní"), S("1-izbový byt", "Karlova Ves", "9 dní")],
  }),
  makler("nikoleta-szalayova", null, {
    name: "Nikoleta Szalayová", role: "Realitná maklérka", phone: "+421 914 296 512", email: "szalayova@vianema.eu",
    ig: "https://www.instagram.com/vianema", palette: "piesky", sky: "ba", portrait: "/web/nikoleta-portret.jpg",
    headline: "Od Petržalky po novostavby za Bratislavou",
    sub: "Mestské byty v Petržalke a Ružinove, rodinné domy a novostavby v Malackách a na Žitnom ostrove.",
    trust: [T("8", "aktuálnych ponúk"), T("Novostavby", "aj mimo Bratislavy"), T("2–4 izb.", "mestské byty"), T("24 h", "rozbor ceny od maklérky")],
    bio1: "Predávam 2- až 4-izbové byty v Petržalke a Ružinove a zároveň rodinné domy a novostavby mimo Bratislavy — Malacky, Kútniky, Horné Mýto.",
    bio2: "Pomôžem vám s predajom v meste aj s kúpou domu za ním.",
    chips: ["Petržalka", "Ružinov", "Novostavby"], areas: ["Petržalka", "Ružinov", "Malacky", "Kútniky", "Horné Mýto"],
    listings: [L("Byt", "2-izbový byt, Slnečnice — Petržalka", "279 999 €", "51 m² · svetlý", "/web/nikoleta-1.jpg"), L("Byt", "4-izbový byt s balkónom, Humenské námestie", "339 999 €", "86 m²", "/web/nikoleta-2.jpg"), L("Byt", "2-izbový byt po rekonštrukcii, Ružinov", "266 990 €", "55,53 m² · balkón", "/web/nikoleta-3.jpg")],
    sold: [S("2-izbový byt", "Petržalka", "11 dní"), S("Novostavba RD", "Horné Mýto", "34 dní"), S("3-izbový byt", "Ružinov", "15 dní")],
  }),
  makler("slavomir-kollar", null, {
    name: "Mgr. Slavomír Kollár", role: "Realitný maklér", phone: "+421 911 856 756", email: "kollar@vianema.eu",
    ig: "https://www.instagram.com/vianema", palette: "kamzik", sky: "ba", portrait: "/web/slavo.jpg",
    headline: "Karlova Ves a Ružinov — predaj aj prenájom",
    sub: "Byty na predaj aj na prenájom v Bratislave, najmä Karlova Ves a Ružinov.",
    trust: [T("Predaj", "aj prenájom"), T("Karlova Ves", "· Ružinov"), T("Byty", "1- až 3-izbové"), T("24 h", "rozbor ceny od makléra")],
    bio1: "Zameriavam sa na byty v Karlovej Vsi a Ružinove — na predaj aj na prenájom. Pomôžem vám nastaviť cenu tak, aby ste nečakali mesiace.",
    bio2: "",
    chips: ["Karlova Ves", "Ružinov", "Prenájmy"], areas: ["Karlova Ves", "Ružinov", "Dúbravka", "Bratislava"],
    listings: [L("Byt", "1-izbový byt, starý Ružinov — Trenčianska", "189 990 €", "37 m²", "/web/slavomir-2.jpg"), L("Prenájom", "3-izbový byt pri lese, Karlova Ves — Kuklovská", "960 € / mesiac", "72 m²", "/web/slavomir-1.jpg")],
    sold: [S("1-izbový byt", "Ružinov", "8 dní"), S("2-izbový byt", "Karlova Ves", "20 dní"), S("Prenájom 3-izb.", "Karlova Ves", "5 dní")],
  }),
  makler("rastislav-michalina", null, {
    name: "Rastislav Michalina", role: "Realitný maklér", phone: "+421 944 159 957", email: "michalina@vianema.eu",
    ig: "https://www.instagram.com/vianema", palette: "mesto", sky: "ba", portrait: "/web/rastislav-portret.jpg",
    headline: "Byty, domy a pozemky v Bratislave a Stupave",
    sub: "Ružinov, Nové Mesto, Petržalka a okolie Bratislavy vrátane Stupavy.",
    trust: [T("5", "aktuálnych ponúk"), T("Byty · domy", "· pozemky · garáže"), T("Stupava", "a okolie Bratislavy"), T("24 h", "rozbor ceny od makléra")],
    bio1: "Predávam byty, domy, pozemky aj garáže v Bratislave — Ružinov, Nové Mesto, Petržalka — a v Stupave a okolí.",
    bio2: "",
    chips: ["Ružinov", "Nové Mesto", "Stupava"], areas: ["Ružinov", "Nové Mesto", "Petržalka", "Stupava", "Bratislava"],
    listings: [L("Byt", "2-izbový byt s parkovaním, Gloria — Nivy", "289 990 €", "66 m² · moderný", "/web/rastislav-1.jpg"), L("Dom", "5-izbový dom so záhradou, Stupava", "379 990 €", "307 m²", "/web/rastislav-2.jpg"), L("Byt", "2-izbový byt s parkovaním, Koliba", "399 990 €", "70 m² · prémiový", "/web/rastislav-3.jpg")],
    sold: [S("2-izbový byt", "Ružinov", "13 dní"), S("Rodinný dom", "Stupava", "31 dní"), S("Pozemok", "Stupava", "24 dní")],
  }),
  makler("jaroslav-rajcan", null, {
    name: "Jaroslav Rajčan", role: "Obchodný manažér", phone: "+421 917 376 597", email: "rajcan@vianema.eu",
    ig: "https://www.instagram.com/vianema", palette: "fatra", sky: "zl", portrait: "", team: false,
    branch: "Vianema s.r.o. · Martin, Žilina, Vrútky a okolie",
    headline: "Investície a pozemky pod Malou Fatrou",
    sub: "17 rokov v realitách. Analýza pozemkov a nehnuteľností, investičné príležitosti — Martin, Žilina, Vrútky, Zvolen a okolie.",
    trust: [T("17+", "rokov v realitách"), T("Investície", "analýza trhu a pozemkov"), T("8+", "ponúk v portfóliu"), T("24 h", "rozbor ceny od makléra")],
    bio1: "Viac ako 17 rokov sa venujem realitám so zameraním na analýzu trhu, pozemky a investičné príležitosti. Sledujem vývoj trhu na strednom Slovensku a klientom pomáham rozhodnúť sa na základe čísel.",
    bio2: "",
    chips: ["17 rokov praxe", "Investície", "Pozemky"], areas: ["Martin", "Žilina", "Vrútky", "Zvolen", "Turiec"],
    listings: [L("Pozemok", "Investičný pozemok, Martin", "na vyžiadanie", "2 400 m²"), L("Hala", "Skladová hala, Vrútky", "na vyžiadanie", "850 m²"), L("Byt", "3-izbový byt, Žilina", "189 000 €", "72 m² · Hliny")],
    sold: [S("Stavebný pozemok", "Martin", "40 dní"), S("3-izbový byt", "Žilina", "17 dní"), S("Rodinný dom", "Zvolen", "29 dní")],
  }),
];
