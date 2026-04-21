import { NextRequest, NextResponse } from "next/server";

const VIANEMA_SYSTEM = `Si profesionálny realitný copywriter pre realitnú kanceláriu VIANEMA. Tvojou úlohou je tvoriť pútavé inzeráty presne podľa ich firemnej šablóny.

══ POVINNÝ FORMÁT TEXTU (emotivny pole) ══

Text má 4 časti PRESNE v tomto poradí.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ ZAKÁZANÉ ZAČIATKY TEXTU — NIKDY NEZAČÍNAJ:
  ❌ "VIANEMA ponúka ..."
  ❌ "Vianema ponúka ..."
  ❌ "Spoločnosť VIANEMA ..."
  ❌ "Realitná kancelária VIANEMA ..."
  ❌ "Na predaj X-izbový byt, ktorý ..."

✅ POVOLENÉ ZAČIATKY — PRVÁ VETA MUSÍ byť POPIS NEHNUTEĽNOSTI:
  ✅ "Dvojizbový byt v novostavbe je ..."
  ✅ "Priestranný 3-izbový byt s terasou sa nachádza ..."
  ✅ "Kompletne prerobený 2-izbový byt v tehlovej bytovke ..."
  ✅ "Rodinný dom s veľkou záhradou ponúka ..."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) DESCRIPTION (2-3 odseky) — začína POPISOM nehnuteľnosti (viď povolené začiatky vyššie).
   Obsah: dispozícia, stav, materiály (len fakty z fotiek/dokumentov, žiadne halucinácie).

2) LOKALITA (1 odsek) — konkrétny popis okolia ak vieš z prieskumu. Ak nevieš → vynechaj.

3) ODRÁŽKY (5-8 bodov) — každá začína "• " (bullet) na novom riadku:
   • Parameter 1
   • Parameter 2
   ...

4) POVINNÝ ZÁVER — PRESNE tento 3-paragrafový blok (NIKDY NEVYNECHAJ žiadny):

   Cena: [CENA] € vrátane kompletného realitného servisu spoločnosti Vianema.

   Dohodnite si obhliadku tohto bytu, radi vám ho ukážeme. Kontakt: [MENO] [TELEFÓN] [EMAIL]

   VIANEMA. Komplexné služby pre váš Projekt Bývanie a Investície pod jednou strechou. Právny servis a poradenstvo, finančné služby a investičné poradenstvo, poistenie, služby znalca a znalecké posudky, odkup nehnuteľností, development, rekonštrukcie vrátane architektonickej a dizajnérskej expertízy, sťahovacie služby, manažment prenajatých nehnuteľností, kúpa - predaj, import áut.

⚠️ AK MÁTE V KONTEXTE ÚDAJE MAKLÉRA (maklerMeno/maklerTelefon/maklerEmail), VYPLŇ ich do "Kontakt:".
⚠️ AK ÚDAJE MAKLÉRA CHÝBAJÚ — NAPÍŠ IBA "Kontakt: +421 915 627 008 machovic@vianema.eu" (default).
⚠️ AK TEXT NEKONČÍ presne týmto 3-paragrafovým blokom — JE CHYBNÝ A NEPOUŽITEĽNÝ.

Pre rodinný dom nahraď "tohto bytu"/"vám ho" → "tohto domu"/"vám ho". Pre pozemok → "tohto pozemku"/"vám ho".

══ PRÍKLAD ŠTRUKTÚRY ══

"Dvojizbový byt je nadštandardne veľký (68 m²). Pozostáva zo vstupnej haly, obývacej izby spojenej s kuchyňou, samostatnej veľkej spálne, kúpeľne a samostatnej toalety. Kuchynská linka je vyrobená z jelšového dreva. Vo vstupnej hale aj spálni sú priestranné vstavané skrine.

Byt má dva balkóny. Bytový dom je vybavený dvoma výťahmi. K dispozícii je aj pivnica.

Lokalita v Rači na Kadnárovej ulici je ideálna pre pokojné bývanie s dobrou dostupnosťou do centra.

• Nadštandardne veľký byt (68 m²) s dvoma balkónmi
• Kuchynská linka na mieru z jelšového dreva
• Priestranné vstavané skrine v hale aj spálni
• Dva výťahy a pivnica na prízemí
• Súkromné parkovacie státie

Cena: 299 999 € vrátane kompletného realitného servisu spoločnosti Vianema.

Dohodnite si obhliadku tohto bytu, radi vám ho ukážeme. Kontakt: Aleš Machovič +421 915 627 008 machovic@vianema.eu

VIANEMA. Komplexné služby pre váš Projekt Bývanie a Investície pod jednou strechou. Právny servis a poradenstvo, finančné služby..."

══ NADPIS (pole "nazov") ══
Max 70 znakov, SEO forma: "[Akcia] [X-izbový byt/dom] [Obec/MČ] + benefit"
Príklad: "Predaj 2-izbový byt Karlova Ves, 62 m², s terasou"

══ BAŤOVSKÁ CENA ══
Predajné ceny (NIE nájom) zaokrúhli tak, aby končili na 900 alebo 99 900.
Príklad: 150 200 € → 150 900 €, 85 000 € → 84 900 €, 200 000 € → 199 900 €

══ PORADIE SEKCIÍ — STRIKTNÉ ══
Text MUSÍ byť presne v tomto poradí:
  1) DESCRIPTION (2-3 odseky popis nehnuteľnosti a miestností)
  2) LOKALITA (1 odsek o okolí)
  3) ODRÁŽKY (5-8 bullet-ov • )
  4) ZÁVER (3-paragraf: Cena / Dohodnite / VIANEMA boilerplate)

ZAKÁZANÉ: odrážky uprostred textu, popis miestností PO odrážkach, lokalita PRED description. Ak porušíš poradie — text je nepoužiteľný.

══ ORIENTÁCIA — POVOLENÉ HODNOTY ══
Pri spomínaní svetových strán používaj IBA:
  sever, juh, východ, západ, severovýchod, severozápad, juhovýchod, juhozápad.
ZÁKAZ vymýšľať kombinácie s krajinami, regiónmi alebo mestami ("rakúsko-juhozápad", "maďarsko-východ", "slovensko-sever" — všetko nepoužiteľné halucinácie).
Ak orientácia nie je v dokumentoch ani v úlohe — NESPOMÍNAJ ju vôbec.

══ OCHRANA PRESNEJ ADRESY — POVINNÉ ══
V texte inzerátu (ani v intro, meta_description, seo_keywords, tagy, h1)
NIKDY nespomínaj:
  - Súpisné číslo budovy (napr. "č. 1234", "súpisné č. 16")
  - Popisné číslo
  - Orientačné číslo (napr. "Majerníkova 21" → správne je len "Majerníkova")
  - Parcelné číslo z LV (napr. "parc. 1656/5")
  - Kompletnú adresu s číslom domu

Ulicu SPOMÍNAŤ MÔŽEŠ (napr. "na Majerníkovej ulici"), ale **bez čísla**.
Pre portálové inzeráty je presná adresa citlivá informácia — maklér ju
dá záujemcom súkromne pri obhliadke, nie do verejného textu.

══ KLIŠÉ FRÁZY — ŠETRNE, NIE SPAM ══
V inzeráte môžeš použiť MAX 2-3 klišé frázy z tohto zoznamu (zvyčajne
2 stačia — jedno v úvode, jedno v lokalite). Nie viac — inak text
začne pôsobiť ako generátor prázdnych fráz. Vyber tie ktoré reálne
sedia na túto nehnuteľnosť (napr. ak je byt reálne zariadený, "plne
zariadený" je OK; ak nie, nepoužívaj):
  ▪ "pripravený na nasťahovanie"
  ▪ "ideálny pre rodinu / pár / investíciu"
  ▪ "moderné / slnečné / priestranné bývanie"
  ▪ "pokojná rodinná lokalita"
  ▪ "vyhľadávaná lokalita"
  ▪ "výborná dostupnosť MHD"
  ▪ "v blízkosti občianskej vybavenosti"
  ▪ "skvelá investičná príležitosť"

Ostatné konkrétne detaily napíš **faktograficky** — čo bolo urobené,
s akými materiálmi, kedy. Konkrétnosť predáva, klišé len vyplňuje.

ÚPLNE ZAKÁZANÉ (nikdy nepoužívaj — príliš prázdne):
  ❌ "Byt je pripravený na okamžité nasťahovanie bez ďalších investícií"
  ❌ "Nenechajte si ujsť túto jedinečnú príležitosť"
  ❌ "skvelý pomer ceny a kvality"

══ POMER ODSTAVEC vs ODRÁŽKY ══
Text má byť HLAVNE popis v odstavcoch, nie len bullet list s jednou
vetou navrchu. Cieľ:
  - 2-3 PLNOHODNOTNÉ odseky popisu (každý 3-5 viet)
  - 1 odsek o lokalite (3-4 vety)
  - MAX 5-6 odrážok s krátkymi kľúčovými parametrami (nie dupliké s odstavcom)
Ak sa všetko, čo vieš o byte, dá vtesnať do 5 bullet-ov, radšej napíš
KRATŠÍ ale plynulý text bez odrážok než bullet-prepísaný popis.

══ ANTI-REDUNDANCIA ══
Každá informácia sa smie objaviť BUĎ v odrážkach ALEBO v odstavci — NIE v oboch.
Odrážky = rýchly overview (kľúčové parametre).
Odstavce = detailný popis miestností, materiálov, dispozície.
Ak je "Vstavané skrine v chodbe" v bullete, NESPOMÍNAJ ich znovu v odstavci (a naopak).

══ KRITICKÉ PRAVIDLÁ ══
1. DOKUMENTY (LV, zmluvy, posudky) majú VŽDY PREDNOSŤ pred formulárom pre VÝMERY a ADRESY. Ak zmluva uvádza inú plochu alebo adresu — POUŽI údaj z dokumentu!
2. POČET IZIEB: Ak dokument EXPLICITNE uvádza "1-izbový"/"jednoizbový"/"garsónka" → 1-izbový (NIKDY 3-izbový!). "2-izbový"→2, "3-izbový"→3. Dokument má prednosť pred formulárom. NIKDY nehádaj počet izieb z opisu miestností.
3. VÝMERY: Použi presné výmery z dokumentov. Dokument > formulár.
4. ADRESA: Použi PRESNÚ adresu z LV/zmluvy vrátane čísla domu.
5. AK MÁŠ FOTKY — opíš KONKRÉTNE čo vidíš: materiály, farby, stav, vybavenie. Nie "moderný interiér".
6. AK MÁŠ PRIESKUM LOKALITY — použi konkrétne názvy (Lidl, ZŠ Mierová, zastávka Ružinovská...).
7. Ak máš údaje o právnych ťarchách (záložné právo) — NESPOMÍNAJ v texte.
8. JAZYK: Profesionálna slovenčina, prehľadný a štruktúrovaný text.

══ INTRO (pole "intro") ══
Presne 1-3 krátke vety, max 160 znakov, v tomto tvare:
"VIANEMA ponúka na predaj [X-izbový byt] [krátka charakteristika - stav/lokalita/poschodie/orientácia]. Kontaktujte nás pre obhliadku."
Príklad: "VIANEMA ponúka na predaj 3-izbový byt po kompletnej rekonštrukcii. Byt sa nachádza na 1. poschodí s južnou orientáciou. Kontaktujte nás pre obhliadku."

══ VZOROVÉ INZERÁTY ══
Ak sú priložené vzorové inzeráty, DRŽÍ SA ICH ŠTÝLU — tón, dĺžka, formátovanie odrážok, otváracia veta. Píš ROVNAKO.

══ SEO PRAVIDLÁ (POVINNÉ) ══
Každý text MUSÍ byť optimalizovaný pre vyhľadávače (Google, nehnutelnosti.sk, topreality.sk):

1. HLAVNÉ KĽÚČOVÉ SLOVO = "[akcia] [X-izbový byt/dom/pozemok] [mestská časť / obec]"
   Príklad: "predaj 3-izbový byt Ružinov", "prenájom 2-izbový byt Staré Mesto"

2. POUŽI HLAVNÉ KĽÚČOVÉ SLOVO:
   - V NADPISE (prvé slová)
   - V PRVEJ VETE emotívneho textu (prirodzene, nie spam)
   - 2–3× v tele textu v rôznych variáciách (predaj bytu, byt na predaj, ponúkame byt…)
   - V SEO keywords

3. LOKÁLNE SEO — vždy spomeň:
   - Presná ulica (ak je verejná)
   - Mestská časť / obec
   - Okres
   - Konkrétne orientačné body (MHD zastávka, ZŠ, park, nákupné centrum)

4. LONG-TAIL KĽÚČOVÉ SLOVÁ — prirodzene vpleť frázy ako:
   - "byt na predaj [obec]"
   - "X-izbový byt [ulica]"
   - "nehnuteľnosť [okres]"
   - "bývanie v [mestská časť]"
   - "[stav] byt [lokalita]" (napr. "novostavba byt Ružinov")

5. SÉMANTICKÉ SLOVÁ — pridaj súvisiace pojmy:
   - dispozícia, úžitková plocha, obytná plocha, balkón/loggia/terasa
   - poschodie, výťah, parkovanie, pivnica
   - občianska vybavenosť, MHD, škola, škôlka, nákupy
   - hypotéka, provízia, právny servis

6. NADPIS (pole "nazov") — max 70 znakov, musí obsahovať:
   [Akcia (Predaj/Prenájom)] + [Počet izieb]-izbový [typ] + [Obec/Mestská časť] + [výhoda/m² ak sa zmestí]
   Príklad: "Predaj 3-izbový byt Ružinov, 78 m², po rekonštrukcii"

7. META DESCRIPTION (pole "meta_description") — presne 150–160 znakov, obsahuje hlavné kľúčové slovo, lokalitu, 1 benefit a výzvu (Zavolajte / Dohodnite obhliadku).

8. SEO KEYWORDS (SEP_SEO) — 8–12 fráz oddelených čiarkou, zmes krátkych aj long-tail:
   "predaj 3-izbový byt Ružinov, byt na predaj Bratislava, 3-izbový byt Bratislava II, novostavba Ružinov, byty Ružinov, nehnuteľnosť Bratislava"

9. HASHTAGY (SEP_TAGS) — 6–10 hashtagov pre sociálne siete:
   "#predajbytu #ruzinov #bratislava #3izbovybyt #novostavba #realityslovakia #vianema #bývanie"

10. ZAKÁZANÉ:
   - Keyword stuffing (opakovanie toho istého slova nad rámec prirodzeného textu)
   - Skryté texty, biely text
   - Klamlivé údaje (AI musí držať pravdivosť z dokumentov)

══ FORMÁTOVANIE — POVINNÉ ══
ZÁKAZ markdown: žiadne **tučné**, žiadne _kurzíva_, žiadne ## nadpisy, žiadne bloky kódu.
Odrážky VÝHRADNE vo formáte "• text" (bullet "•" + medzera). Žiadne *, -, ani – ako bullet point.
Text musí byť čistý plain text — kopírovaný priamo do emailu alebo portálu musí vyzerať správne.

══ ABSOLÚTNE PRAVIDLÁ — POPIS BYTU ══
1. NIKDY nepoužívaj frázy typu "na fotkách vidíme", "na fotografii je", "vidíme tu", "ako vidno z fotografií", "na obrázku" — píš ako TOP realitný maklér ktorý byt OSOBNE OBHLIADOL. Píš priamo: "Byt ponúka...", "Kuchyňa je vybavená...".
2. NIKDY si nevymýšľaj LOKALITU, ULICU, MESTSKÚ ČASŤ, OBEC ani ORIENTAČNÉ BODY (obchody, školy, zastávky, parky), ak NIE SÚ explicitne v údajoch alebo v prieskume lokality. Ak nevieš lokalitu, NESPOMÍNAJ ju vôbec.
3. NEPREHÁŇAJ a NEVYMÝŠĽAJ materiály. KONKRÉTNE:
   - Podlahy: ak nevieš isto, píš "laminátové podlahy" alebo "plávajúce podlahy" — NIKDY "dubové", "bukové", "orechové", "masívne" ak to nie je explicitne uvedené v dokumentoch. Svetlé drevo-imitácia = laminát.
   - Kuchynská linka: opíš FARBU ("biela", "sivá", "v dreve") a NIC VIAC — nevymýšľaj materiály dvierok ani pracovnú dosku ak nie sú jednoznačné.
   - Obklady v kúpeľni: opíš FARBU ("béžové", "hnedé obklady") — neurčuj "mramor", "travertín", "keramika" bez dôkazu.
   - Spotrebiče: spomeň iba ak sú jasne viditeľné (rúra, mikrovlnka, plynová varná doska, chladnička).
   - NIKDY nepíš "elegantne zariadený", "luxusný", "dizajnový" — píš fakty.
4. Ak nemáš dosť údajov, radšej napíš KRATŠÍ ale pravdivý text.
5. Maklér to musí uniesť pred klientom — ak by klient povedal "kde ste to videli?", text musí obstáť.

══ SEO V TEXTE — ABSOLÚTNY ZÁKAZ SEPARÁTNEHO BLOKU ══
NIKDY, ANI RAZ, nepridávaj na koniec "emotivny" textu:
- "SEP_SEO [...]"
- "SEP_SEO\n...čokoľvek..."
- "SEP_TAGS [...]"
- "SEP_TAGS\n...čokoľvek..."
- Akýkoľvek blok textu označený "SEP_SEO" alebo "SEP_TAGS"

Kľúčové slová sú SEPARÁTNE polia v JSON výstupe:
- "seo_keywords" — sem dávaš 8-12 kľúčových fráz oddelených čiarkou
- "tagy" — sem dávaš 6-10 hashtagov
- "meta_description" — 150-160 znakov SEO popisu

Text "emotivny" musí byť ČISTÝ POPIS BYTU BEZ SEO bloku. Kľúčové slová VPLETIEŠ priamo do viet opisu prirodzene (napr. "predaj 2-izbového bytu v Karlovej Vsi", "byt s terasou", "byt s garážou" v popise).

Ak porušiš toto pravidlo — text je NEPOUŽITEĽNÝ a inzerát sa nemôže publikovať.`;

const USER_PROMPT = (details: string, locationInfo: string) => `VŠETKY DOSTUPNÉ ÚDAJE O NEHNUTEĽNOSTI:
═══════════════════════════════════════
${details}
═══════════════════════════════════════

${locationInfo ? `PRIESKUM LOKALITY (z internetu):\n${locationInfo}\n` : "⚠️ LOKALITA NIE JE ZNÁMA — NESPOMÍNAJ žiadnu konkrétnu ulicu, mestskú časť, obec, obchody, školy, zastávky ani orientačné body. Píš text všeobecne o byte bez lokality.\n"}
⚠️ DÔLEŽITÉ: Dokumenty (LV, zmluva, posudok) sú AUTORITATÍVNE — ak uvádzajú iný počet izieb, plochu alebo adresu než formulár, použi údaj Z DOKUMENTU.

⚠️ FOTKY: Píš ako maklér ktorý byt OSOBNE OBHLIADOL. Nikdy nepíš "na fotkách vidíme/vidno". Píš priamo "Kuchyňa je vybavená...", "Podlahy sú...".

ÚLOHA: Napíš kompletný inzerát podľa pravidiel VIANEMA. Použi VŠETKY dostupné údaje.

Vráť IBA JSON (bez markdown, bez \`\`\`):
{
  "nazov": "SEO NADPIS max 70 znakov. Pr.: 'Predaj 2-izbový byt Karlova Ves, 62 m², s terasou'",
  "emotivny": "4-časťový text PRESNE podľa šablóny: (1) 2-3 odseky popisu bez 'VIANEMA ponúka' — začína priamo opisom nehnuteľnosti, (2) 1 odsek lokalita ak vieš (inak vynechaj), (3) 5-8 odrážok s '• ', (4) POVINNÝ záver: 'Cena: X € vrátane kompletného realitného servisu spoločnosti Vianema.\\n\\nDohodnite si obhliadku tohto bytu, radi vám ho ukážeme. Kontakt: [meno] [tel] [email]\\n\\nVIANEMA. Komplexné služby... (plný text spoločnosti).' SEO slová vpletaj PRIRODZENE do viet, NIKDY nie ako SEP_SEO blok.",
  "intro": "Max 160 znakov, tvar: 'VIANEMA ponúka na predaj [X-izbový byt] [krátka charakteristika]. Kontaktujte nás pre obhliadku.'",
  "meta_description": "150-160 znakov: keyword + lokalita + 1 benefit + výzva.",
  "h1": "SEO H1 max 70 znakov.",
  "seo_keywords": "8-12 kľúčových fráz oddelených čiarkou. Pr.: 'predaj 2-izbový byt Karlova Ves, byt s terasou Bratislava, prerobený byt Karlova Ves, byt s garážou Majerníkova'",
  "tagy": "6-10 hashtagov alebo kľúčových slov oddelených čiarkou. Pr.: '#predaj #karlovaves #2izbovybyt #terasa #garaz #rekonstrukcia'",
  "technicky": "Všetky technické parametre z dokumentov: výmery, materiál, poschodie, rok výstavby. 100-150 slov.",
  "kratky": "2-3 vety pre sociálne siete.",
  "cena_batova": "Ak je cena a NIE JE nájom, zaokrúhli na Baťovskú cenu (končí 900 alebo 99 900). String s medzerou a €. Ak nie je cena, prázdny string."
}`;

/** Baťovská cena: zaokrúhli nahor na X900 / 99 900.
 *  150 200 → 150 900, 85 000 → 84 900, 200 000 → 199 900, 100 000 → 99 900. */
export function batovskaCena(n: number): number {
  if (!n || n < 1000) return n;
  return Math.ceil(n / 1000) * 1000 - 100;
}

/** Formátuje telefón do tvaru "+421 XXX XXX XXX". */
function formatPhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return raw; // nezmysel, vráť ako je
  // Ak sa začína 421, 00421, alebo len 9 číslic SK
  let nat = digits;
  if (nat.startsWith("00421")) nat = nat.slice(5);
  else if (nat.startsWith("421")) nat = nat.slice(3);
  else if (nat.length === 10 && nat.startsWith("0")) nat = nat.slice(1);
  if (nat.length !== 9) return raw;
  return `+421 ${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`;
}

/** Extrahuje výmeru v m² z textu (hľadá prefix + číslo + m²). */
function extractPlochaFromText(text: string): number | null {
  if (!text) return null;
  const prefixed = text.match(
    /(?:úžitková\s+plocha|celková\s+plocha|podlahová\s+plocha|zastavaná\s+plocha|výmera|rozloha|plocha)[\s:]*?(\d+(?:[,.]\d+)?)\s*m[²2]/i,
  );
  if (prefixed) return parseFloat(prefixed[1].replace(",", "."));
  const any = text.match(/(\d+(?:[,.]\d+)?)\s*m[²2]/);
  if (any) {
    const n = parseFloat(any[1].replace(",", "."));
    // Ignoruj absurdne malé hodnoty (napr. "2 m²" = obklad nie byt)
    if (n >= 15) return n;
  }
  return null;
}

/** Header blok pred textom inzerátu. */
function buildHeader(opts: {
  obec?: string;
  okres?: string;
  ulica?: string;
  lokalita?: string;
  izby?: number | string;
  plocha?: number | string;
  uzitkovaPlocha?: number | string;
  podlahovaPlocha?: number | string;
  celkovaPlocha?: number | string;
  zastavanaPlocha?: number | string;
  extras?: string[];
  cena?: number;
  typCeny?: "predaj" | "prenajom";
}): string {
  // Lokalita: zober VŠETKY dostupné zdroje (obec, okres, ulica, lokalita free-text),
  // rozseknúť po čiarke, dedupovať case-insensitive, odstrániť "kraj" sufix.
  const rawLok = [opts.obec, opts.okres, opts.ulica, opts.lokalita]
    .filter((x) => x && String(x).trim())
    .map((x) => String(x))
    .join(", ");
  const seen = new Set<string>();
  const lokStr = rawLok.split(",").map((s) => s.trim()).filter(Boolean)
    .filter((p) => !/kraj$/i.test(p))
    .filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(", ");

  const plochaVal = opts.plocha || opts.uzitkovaPlocha || opts.podlahovaPlocha || opts.celkovaPlocha || opts.zastavanaPlocha;
  const extras = (opts.extras || []).filter(Boolean);
  const izbyStr = opts.izby ? `${opts.izby}${extras.length ? " + " + extras.join(", ") : ""}` : "";

  const lines: string[] = [];
  if (lokStr) lines.push(`Lokalita: ${lokStr}`);
  if (izbyStr) lines.push(`Izby: ${izbyStr}`);
  if (plochaVal) lines.push(`Výmera: ${plochaVal} m²`);
  if (opts.cena && opts.cena > 0) {
    const cena = opts.typCeny === "prenajom" ? opts.cena : batovskaCena(opts.cena);
    lines.push(`Financie: ${cena.toLocaleString("sk-SK")} €${opts.typCeny === "prenajom" ? " / mesiac" : ""}`);
  }
  return lines.length > 0 ? lines.join("\n") + "\n\n" : "";
}

/**
 * Post-processing emotivny textu — garancia správneho formátu bez ohľadu na to,
 * čo Claude/GPT vygenerovali. Pridá header blok, odstráni zakázané začiatky,
 * odstráni existujúci záver a nahradí ho presným VIANEMA blokom s reálnymi
 * údajmi makléra a Baťovskou cenou.
 */
function enforceVianemaClosing(
  text: string,
  opts: {
    cena?: number;
    maklerMeno?: string;
    maklerTelefon?: string;
    maklerEmail?: string;
    typ?: string;
    obec?: string;
    okres?: string;
    ulica?: string;
    lokalita?: string;
    izby?: number | string;
    plocha?: number | string;
    uzitkovaPlocha?: number | string;
    podlahovaPlocha?: number | string;
    celkovaPlocha?: number | string;
    zastavanaPlocha?: number | string;
    extras?: string[];
    typCeny?: "predaj" | "prenajom";
  },
): string {
  if (!text) return text;
  let cleaned = text.trim();

  // 1. Odstráň "VIANEMA ponúka ..." alebo podobné zakázané úvodné vety.
  // Strihá až po koniec vety kde nasleduje ďalšia veta začínajúca veľkým písmenom
  // (aby sa nestrihalo na ordináloch ako "3." alebo "5.").
  const CAP = "A-ZÁÄČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ";
  const forbiddenOpenings = [
    new RegExp(`^\\s*VIANEMA\\s+ponúka[\\s\\S]*?[.!?]\\s+(?=[${CAP}])`, "i"),
    new RegExp(`^\\s*Spoločnosť\\s+VIANEMA[\\s\\S]*?[.!?]\\s+(?=[${CAP}])`, "i"),
    new RegExp(`^\\s*Realitná\\s+kancelária\\s+VIANEMA[\\s\\S]*?[.!?]\\s+(?=[${CAP}])`, "i"),
    new RegExp(`^\\s*Na\\s+predaj\\s+[^,]+,\\s+ktor[ýé][\\s\\S]*?[.!?]\\s+(?=[${CAP}])`, "i"),
  ];
  for (const re of forbiddenOpenings) {
    if (re.test(cleaned)) {
      cleaned = cleaned.replace(re, "").trim();
      break;
    }
  }

  // 2. Odstráň existujúci záver — všetko od "Cena:" alebo "Kontakt:" dolu
  const closingStart = cleaned.search(/(?:^|\n)\s*Cena:\s*[\d\[]/);
  if (closingStart > 0) {
    cleaned = cleaned.substring(0, closingStart).trim();
  }
  // Fallback: ak "Cena:" nie je, strip od "Kontakt:" / "Dohodnite"
  const kontaktStart = cleaned.search(/(?:^|\n)\s*(?:Kontakt:|Dohodnite\s+si\s+obhliadku)/);
  if (kontaktStart > 0) {
    cleaned = cleaned.substring(0, kontaktStart).trim();
  }
  // Strip "VIANEMA. Komplexné služby..." ak je niekde zvyšku
  const vianemaEnd = cleaned.search(/(?:^|\n)\s*VIANEMA\.\s+Komplexné/);
  if (vianemaEnd > 0) {
    cleaned = cleaned.substring(0, vianemaEnd).trim();
  }

  // 3. Vybuduj záver s reálnymi údajmi (Baťovská cena pre predaj)
  const finalCena = opts.cena && opts.cena > 0
    ? (opts.typCeny === "prenajom" ? opts.cena : batovskaCena(opts.cena))
    : 0;
  const cenaStr = finalCena > 0 ? `${finalCena.toLocaleString("sk-SK")} €` : "[CENA] €";
  const telFormatted = formatPhone(opts.maklerTelefon || "");
  const kontakt = [opts.maklerMeno, telFormatted, opts.maklerEmail]
    .filter(Boolean).join(" ") || "Aleš Machovič +421 915 627 008 machovic@vianema.eu";
  const typLow = (opts.typ || "").toLowerCase();
  const tohtoX = typLow.includes("dom") || typLow.includes("rodin") ? "tohto domu"
    : typLow.includes("pozem") || typLow.includes("parcel") ? "tohto pozemku"
    : "tohto bytu";

  // Ak žiadne plocha pole vo formulári, extrahuj z AI textu (napr. "Úžitková plocha 62 m²").
  const formPlocha = opts.plocha || opts.uzitkovaPlocha || opts.podlahovaPlocha || opts.celkovaPlocha || opts.zastavanaPlocha;
  const plochaForHeader = formPlocha || extractPlochaFromText(cleaned) || undefined;

  // Header blok na začiatku
  const header = buildHeader({
    obec: opts.obec, okres: opts.okres, ulica: opts.ulica,
    lokalita: opts.lokalita,
    izby: opts.izby, plocha: plochaForHeader,
    extras: opts.extras,
    cena: finalCena || opts.cena, typCeny: opts.typCeny,
  });

  const closing = `\n\nCena: ${cenaStr} vrátane kompletného realitného servisu spoločnosti Vianema.\n\nDohodnite si obhliadku ${tohtoX}, radi vám ho ukážeme. Kontakt: ${kontakt}\n\nVIANEMA. Komplexné služby pre váš Projekt Bývanie a Investície pod jednou strechou. Právny servis a poradenstvo, finančné služby a investičné poradenstvo, poistenie, služby znalca a znalecké posudky, odkup nehnuteľností, development, rekonštrukcie vrátane architektonickej a dizajnérskej expertízy, sťahovacie služby, manažment prenajatých nehnuteľností, kúpa - predaj, import áut.`;

  return header + cleaned + closing;
}

function extractJSON(raw: string): Record<string, string> {
  if (!raw) return {};
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};
  const candidate = jsonMatch[0];
  try { return JSON.parse(candidate); } catch {}
  // Fallback: escape raw newlines/tabs inside string values
  try {
    let out = ""; let inStr = false; let esc = false;
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i];
      if (esc) { out += c; esc = false; continue; }
      if (c === "\\") { out += c; esc = true; continue; }
      if (c === '"') { inStr = !inStr; out += c; continue; }
      if (inStr && c === "\n") { out += "\\n"; continue; }
      if (inStr && c === "\r") { out += "\\r"; continue; }
      if (inStr && c === "\t") { out += "\\t"; continue; }
      out += c;
    }
    return JSON.parse(out);
  } catch (e) {
    console.error("[ai-writer] extractJSON failed:", String(e).slice(0,200), "raw:", candidate.slice(0,200));
    return {};
  }
}

/* ── Gemini: research location ── */
async function researchLocation(lokalita: string): Promise<string> {
  // Vyžaduje skutočnú adresu (aspoň ulicu alebo mestskú časť), nie len "Bratislava"
  if (!lokalita?.trim() || !process.env.GEMINI_API_KEY) return "";
  if (lokalita.trim().split(/[\s,]+/).filter(Boolean).length < 2) return "";
  try {
    const locBody = JSON.stringify({
      contents: [{
        parts: [{
          text: `Si realitný analytik. Mám nehnuteľnosť na adrese "${lokalita}". Napíš KONKRÉTNY prehľad okolia TEJTO ULICE/ADRESY:
- Čo je v bezprostrednom okolí (do 500m) — konkrétne názvy obchodov, škôl, reštaurácií
- Doprava — najbližšia zastávka MHD (meno), vzdialenosť do centra
- Charakter ulice a okolia — tichá/rušná, zeleň, parky v okolí (konkrétne názvy)
- Najbližšie nákupné centrum (názov)
- Zdravotníctvo v okolí

DÔLEŽITÉ: Píš o konkrétnej ulici/adrese "${lokalita}", nie o celej mestskej časti všeobecne.
Píš stručne, konkrétne fakty, max 150 slov. Slovenčina.`
        }]
      }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    });
    let res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: locBody }
    );
    if (res.status === 503) {
      await new Promise(r => setTimeout(r, 3000));
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: locBody }
      );
    }
    if (!res.ok) return "";
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  } catch { return ""; }
}

/* ── Fallback: research via GPT ── */
async function researchLocationGPT(lokalita: string): Promise<string> {
  if (!lokalita?.trim() || !process.env.OPENAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", temperature: 0.3, max_tokens: 500,
        messages: [{ role: "user", content: `Si realitný analytik. Pre KONKRÉTNU adresu "${lokalita}" napíš čo je v bezprostrednom okolí tejto ulice — konkrétne názvy obchodov, škôl, MHD zastávok, parkov. Charakter ulice. Max 150 slov, slovenčina.` }],
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch { return ""; }
}

/* ── Claude: generate text (s fotkami ak sú dostupné).
 *  Stratégia: Opus 4.7 (bohatší text) primárne, Sonnet 4.5 fallback pri chybe. */
async function generateClaude(details: string, locationInfo: string, images?: { data: string; mimeType: string }[]): Promise<Record<string, string>> {
  if (!process.env.ANTHROPIC_API_KEY) return {};

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build multimodal content if photos available
  const content: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [];
  if (images && images.length > 0) {
    for (const img of images) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.data },
      });
    }
    content.push({
      type: "text",
      text: `Vyššie sú REÁLNE fotky nehnuteľnosti. Opíš FAKTY ktoré sú jasné (farby, typ kuchyne), NEPREHÁŇAJ materiály — ak nevieš, píš "laminátové podlahy" nie "dubové". Nikdy nepíš "na fotkách vidíme". Píš ako maklér po obhliadke.\n\n${USER_PROMPT(details, locationInfo)}`,
    });
  } else {
    content.push({ type: "text", text: USER_PROMPT(details, locationInfo) });
  }

  async function call(model: string): Promise<Record<string, string>> {
    try {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: 2000,
        system: VIANEMA_SYSTEM,
        messages: [{ role: "user", content: content as never }],
      });
      const raw = (msg.content[0] as { type: string; text: string }).text.trim();
      const parsed = extractJSON(raw);
      if (!parsed.emotivny) return { __err: `${model} parse fail (raw ${raw.length} ch): ${raw.slice(0,200)}` };
      return parsed;
    } catch (e) {
      return { __err: `${model} exception: ${String(e).slice(0,200)}` };
    }
  }

  // Primárny: Opus 4.7 — bohatší, presnejší text
  const opus = await call("claude-opus-4-7");
  if (opus.emotivny) return opus;

  console.warn("[ai-writer] Opus failed, fallback na Sonnet:", opus.__err);
  const sonnet = await call("claude-sonnet-4-5");
  if (sonnet.emotivny) return sonnet;

  return { __err: opus.__err || sonnet.__err || "Claude obe modely zlyhali" };
}

/* ── GPT: generate text ── */
async function generateGPT(details: string, locationInfo: string): Promise<Record<string, string>> {
  if (!process.env.OPENAI_API_KEY) return {};
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", temperature: 0.7, max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VIANEMA_SYSTEM },
          { role: "user", content: USER_PROMPT(details, locationInfo) },
        ],
      }),
    });
    if (!res.ok) { const t = (await res.text()).slice(0,300); console.error("[ai-writer] GPT HTTP", res.status, t); return { __err: `GPT HTTP ${res.status}: ${t}` }; }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJSON(raw);
    if (!parsed.emotivny) return { __err: `GPT parse fail (raw ${raw.length} ch): ${raw.slice(0,200)}` };
    return parsed;
  } catch (e) {
    console.error("[ai-writer] GPT failed:", e);
    return { __err: `GPT exception: ${String(e).slice(0,200)}` };
  }
}

/* ── Gemini: generate text (with optional photos) ── */
async function generateGemini(details: string, locationInfo: string, images?: { data: string; mimeType: string }[]): Promise<Record<string, string>> {
  if (!process.env.GEMINI_API_KEY) return {};
  try {
    // Build parts: text + optional images
    const parts: Record<string, unknown>[] = [];
    // Add photos first so Gemini "sees" them
    if (images && images.length > 0) {
      for (const img of images) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
      parts.push({ text: `Vyššie sú REÁLNE FOTKY tejto nehnuteľnosti. Opíš FAKTY:\n- Podlahy: ak nevieš isto, píš "laminátové" alebo "plávajúce" — NIKDY "dubové/bukové/masív" bez dôkazu\n- Kuchynská linka: iba farba (biela/sivá/drevo) — nevymýšľaj materiál dvierok\n- Obklady: iba farba\n- Nikdy nepíš "na fotkách vidíme" — píš ako maklér po osobnej obhliadke\n- NEPREHÁŇAJ — text musí obstáť pred klientom\n\n${USER_PROMPT(details, locationInfo)}` });
    } else {
      parts.push({ text: USER_PROMPT(details, locationInfo) });
    }

    const geminiBody = JSON.stringify({
      systemInstruction: { parts: [{ text: VIANEMA_SYSTEM }] },
      contents: [{ parts }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2500, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    });
    let res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
    );
    // Retry once on 503 (overloaded)
    if (res.status === 503) {
      await new Promise(r => setTimeout(r, 3000));
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
      );
    }
    if (!res.ok) { const t = (await res.text()).slice(0,300); console.error("[ai-writer] Gemini HTTP", res.status, t); return { __err: `Gemini HTTP ${res.status}: ${t}` }; }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const finish = data.candidates?.[0]?.finishReason || "";
    const parsed = extractJSON(raw);
    if (!parsed.emotivny) return { __err: `Gemini parse fail (raw ${raw.length} ch, finish ${finish}): ${raw.slice(0,200)}` };
    return parsed;
  } catch (e) {
    console.error("[ai-writer] Gemini failed:", e);
    return { __err: `Gemini exception: ${String(e).slice(0,200)}` };
  }
}

/* ── Combine best from two results ── */
async function combineBest(
  a: Record<string, string>,
  b: Record<string, string>,
  details: string
): Promise<Record<string, string>> {
  if (!a.emotivny && !b.emotivny) return a;
  if (!b.emotivny) return a;
  if (!a.emotivny) return b;

  // Try Claude for combining
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system: `Si editor pre VIANEMA reality. Skombinuj dva návrhy do jedného. Text MUSÍ začínať "VIANEMA ponúka na predaj/nájom...". Použi odrážky pre parametre. Slovenčina.`,
        messages: [{
          role: "user",
          content: `Údaje: ${details}\n\nNÁVRH A:\n${a.emotivny}\n\nNÁVRH B:\n${b.emotivny}\n\nVráť IBA JSON:\n{"nazov":"IBA U NÁS! alebo NA PREDAJ! ... max 80 znakov","emotivny":"začni VIANEMA ponúka... + odrážky, 200-300 slov, SEP_SEO a SEP_TAGS","technicky":"100-150 slov","kratky":"max 3 vety"}`
        }],
      });
      const raw = (msg.content[0] as { type: string; text: string }).text.trim();
      const result = extractJSON(raw);
      if (result.emotivny) return result;
    } catch (e) {
      console.error("[ai-writer] Claude combine failed:", e);
    }
  }

  // Fallback: GPT for combining
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini", temperature: 0.5, max_tokens: 2000,
          messages: [
            { role: "system", content: `Si editor pre VIANEMA reality. Skombinuj dva návrhy do jedného. Text MUSÍ začínať "VIANEMA ponúka...". Odrážky pre parametre. Slovenčina.` },
            { role: "user", content: `NÁVRH A:\n${a.emotivny}\n\nNÁVRH B:\n${b.emotivny}\n\nVráť IBA JSON:\n{"nazov":"IBA U NÁS! alebo NA PREDAJ! max 80 znakov","emotivny":"začni VIANEMA ponúka... + odrážky","technicky":"technický text","kratky":"max 3 vety"}` },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || "";
        const result = extractJSON(raw);
        if (result.emotivny) return result;
      }
    } catch (e) {
      console.error("[ai-writer] GPT combine failed:", e);
    }
  }

  return a.emotivny?.length > (b.emotivny?.length || 0) ? a : b;
}

/* ── Fetch vzorové inzeráty (URL → plain text) ── */
async function fetchVzorInzerat(input: string): Promise<string> {
  if (!input?.trim()) return "";
  const lines = input.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const urls = lines.filter(l => /^https?:\/\//i.test(l));
  const nonUrls = lines.filter(l => !/^https?:\/\//i.test(l));
  const fetched: string[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 VianemaBot/1.0" } });
      if (!r.ok) continue;
      const html = await r.text();
      // Strip scripts, styles, tags → plain text
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
      if (text) fetched.push(`── Vzorový inzerát (${url}) ──\n${text}`);
    } catch { /* ignore */ }
  }
  if (nonUrls.length) fetched.push(nonUrls.join("\n"));
  return fetched.join("\n\n");
}

/* ══════ MAIN HANDLER ══════ */
export async function POST(req: NextRequest) {
  const { nazov, typ, lokalita, cena, plocha, izby, stav, popis, photos, maklerMeno, maklerTelefon, maklerEmail, vzorovyInzerat: vzorovyInzeratRaw, obec, okres, ulica, typCeny, uzitkovaPlocha, podlahovaPlocha, celkovaPlocha, zastavanaPlocha, extras } = await req.json();
  const vzorovyInzerat = await fetchVzorInzerat(vzorovyInzeratRaw || "");

  // popis teraz obsahuje KOMPLETNÝ kontext vrátane LV textu, dokumentov, vybavenia, vykurovania atď.
  const details = [
    `── FORMULÁROVÉ ÚDAJE (môžu byť nepresné, dokumenty majú prednosť) ──`,
    nazov && `Nehnuteľnosť: ${nazov}`,
    typ && `Typ: ${typ}`,
    lokalita && `Lokalita: ${lokalita}`,
    cena && `Cena: ${cena} €`,
    plocha && `Plocha (formulár): ${plocha} m²`,
    izby && `Izby (formulár): ${izby} — POUŽI TÚTO HODNOTU pre počet izieb! Iba ak dokument EXPLICITNE uvádza INÝ počet, použi dokument.`,
    maklerMeno && `Kontakt makléra: ${maklerMeno}${maklerTelefon ? ` ${maklerTelefon}` : ""}${maklerEmail ? ` ${maklerEmail}` : ""}`,
    vzorovyInzerat && `\n── VZOROVÝ INZERÁT (drž sa tohto štýlu) ──\n${vzorovyInzerat}`,
    stav && `Stav: ${stav}`,
    `── DOKUMENTY A KONTEXT (AUTORITATÍVNE ÚDAJE — majú prednosť) ──`,
    popis && `\n${popis}`,
    (photos?.length > 0) && `\n── FOTKY: ${photos.length} ks priložených — AI MUSÍ opísať čo na nich vidí (materiály, farby, stav interiéru) ──`,
  ].filter(Boolean).join("\n");

  // Fotky ako base64 pre Gemini multimodal
  const photoImages: { data: string; mimeType: string }[] = [];
  if (Array.isArray(photos)) {
    for (const p of photos.slice(0, 8)) {
      if (typeof p === "string" && p.startsWith("data:image/")) {
        const [header, b64] = p.split(",");
        const mime = header.match(/data:(image\/[^;]+)/)?.[1] || "image/jpeg";
        photoImages.push({ data: b64, mimeType: mime });
      }
    }
  }

  try {
    // Step 1: Research location (Gemini → GPT fallback)
    let locationInfo = await researchLocation(lokalita);
    if (!locationInfo) locationInfo = await researchLocationGPT(lokalita);

    // Step 2: Generate text with all available AIs in parallel (Gemini gets photos)
    const [claude, gpt, gemini] = await Promise.all([
      generateClaude(details, locationInfo, photoImages),
      generateGPT(details, locationInfo),
      generateGemini(details, locationInfo, photoImages),
    ]);

    console.log(`[ai-writer] Results — Claude: ${!!claude.emotivny}, GPT: ${!!gpt.emotivny}, Gemini: ${!!gemini.emotivny}`);

    // Step 3: Pick the best results and combine
    const results = [
      { name: "Claude", data: claude },
      { name: "GPT", data: gpt },
      { name: "Gemini", data: gemini },
    ].filter(r => !!r.data.emotivny);

    let final: Record<string, string>;

    if (results.length >= 2) {
      final = await combineBest(results[0].data, results[1].data, details);
    } else if (results.length === 1) {
      final = results[0].data;
    } else {
      console.error("[ai-writer] all empty:", { claude: JSON.stringify(claude).slice(0,300), gpt: JSON.stringify(gpt).slice(0,300), gemini: JSON.stringify(gemini).slice(0,300), hasGem: !!process.env.GEMINI_API_KEY, hasGpt: !!process.env.OPENAI_API_KEY, hasClaude: !!process.env.ANTHROPIC_API_KEY });
      const errs = [
        claude.__err && `Claude: ${claude.__err}`,
        gpt.__err && `GPT: ${gpt.__err}`,
        gemini.__err && `Gemini: ${gemini.__err}`,
      ].filter(Boolean).join(" | ");
      return NextResponse.json({ error: `Žiadna AI nevrátila text. ${errs || "(no errors captured)"}` }, { status: 500 });
    }

    // Post-processing: garancia správneho VIANEMA formátu.
    // Bez ohľadu na to čo AI vygenerovala, vynútime začiatok bez "VIANEMA ponúka"
    // a kompletný záver s reálnymi údajmi makléra + cenou.
    if (final.emotivny) {
      const cenaNum = typeof cena === "number" ? cena : Number(cena) || undefined;
      final.emotivny = enforceVianemaClosing(final.emotivny, {
        cena: cenaNum, maklerMeno, maklerTelefon, maklerEmail, typ,
        obec, okres, ulica, lokalita,
        izby, plocha,
        uzitkovaPlocha, podlahovaPlocha, celkovaPlocha, zastavanaPlocha,
        extras,
        typCeny: (typCeny === "prenajom" ? "prenajom" : "predaj"),
      });
      // Tiež vráť Baťovskú cenu v samostatnom poli pre frontend (auto-fill)
      if (cenaNum && cenaNum > 0 && typCeny !== "prenajom") {
        final.cena_batova = batovskaCena(cenaNum).toLocaleString("sk-SK") + " €";
      }
    }

    return NextResponse.json({
      ...final,
      _meta: {
        location_research: !!locationInfo,
        claude_ok: !!claude.emotivny,
        gpt_ok: !!gpt.emotivny,
        gemini_ok: !!gemini.emotivny,
      },
    });
  } catch (err) {
    console.error("[ai-writer] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
