# Záznam o spracovateľských činnostiach (RoPA)
### podľa čl. 30 nariadenia EÚ 2016/679 (GDPR) a § 37 zákona č. 18/2018 Z. z.

| | |
|---|---|
| **Verzia** | 1.0 — **NÁVRH** (na revíziu konateľa + ratifikáciu právnikom pred ostrou prevádzkou) |
| **Dátum vyhotovenia** | 7. jún 2026 |
| **Zostavil** | Compliance (toto okno) — discovery cez kód + syntéza |
| **Na schválenie** | Aleš Machovič (konateľ, CEO) — zatiaľ NESCHVÁLENÉ |
| **Platnosť** | do najbližšej zmeny spracovateľských činností / legislatívy |
| **Predmet** | Realitné CRM „os-machovic" prevádzkované pre RK Vianema |

> **Pozn. k údajom prevádzkovateľa:** IČO/DIČ/sídlo/registrácia prevzaté z kanonického zdroja
> projektu (`DEFAULT_FIRMA` / tabuľka `firma_info`). Pred finalizáciou overiť oproti ORSR.
> Tento RoPA je vyhotovený automatizovaným auditom kódu — pred ostrou prevádzkou ho má
> skontrolovať konateľ a ratifikovať právnik.

> **Legenda stavu subprocesora (jednotná, používaná v celom RoPA):**
> - **aktívny** — subprocesor reálne prijíma osobné údaje v aktuálnej prevádzke (env nastavené, kód volá).
> - **kód pripravený — NEAKTÍVNY na prode (env nenastavené, overí Bezpecnost)** — integrácia je v kóde hotová, no bez nastavených env premenných na prode reálne neprebieha žiadny prenos údajov; pred aktiváciou doplniť DPA a zaktualizovať privacy policy. Faktický stav env overuje okno Bezpecnost.
> - **zámerne neuvedený** — subprocesor sa pre danú činnosť úmyselne nepoužíva (napr. AI provider zakázaný na PII), uvedené pre úplnosť/transparentnosť.

---

## A. Identifikácia prevádzkovateľa a sprostredkovateľa

### Prevádzkovateľ (controller) — čl. 30 ods. 1 písm. a)
- **Obchodné meno:** Vianema s. r. o.
- **Sídlo:** Karpatské námestie 10A, 831 06 Bratislava — mestská časť Rača
- **IČO:** 47395095 · **DIČ:** 2023848508
- **Štatutárny orgán:** konateľ Aleš Machovič
- **Kontakt pre ochranu údajov:** privacy@vianema.sk
- **Zodpovedná osoba (DPO):** neurčená — spoločnosť nemá zákonnú povinnosť určiť DPO podľa čl. 37 GDPR (kontaktný bod: privacy@vianema.sk)

> **Odvetvová regulácia (zák. č. 170/2024 Z. z. o realitnom sprostredkovaní):** hlavná činnosť prevádzkovateľa (realitné sprostredkovanie) podlieha zákonu č. 170/2024 Z. z. Z neho plynú aj povinnosti s presahom do spracúvania a poskytovania údajov (povinné predzmluvné informácie klientovi, poistenie zodpovednosti za škodu, registrácia realitného sprostredkovateľa, odborná spôsobilosť). **Presné náležitosti a ich premietnutie do zmlúv/poučení a do tohto RoPA overí právnik** pred ostrou prevádzkou.

### Sprostredkovateľ (processor) — čl. 30 ods. 2
- **Obchodné meno:** Machovic s. r. o. — prevádzkovateľ CRM systému „os-machovic" (poskytovateľ SaaS, technická prevádzka, hosting, údržba, AI integrácie)
- **Postavenie:** spracúva osobné údaje výlučne na základe pokynov prevádzkovateľa (čl. 28 GDPR; sprostredkovateľská zmluva — viď samostatný register DPA)
- **Ďalší sprostredkovatelia (subprocesori):** Supabase Inc., Vercel Inc., Resend Inc., Google LLC, Anthropic PBC, OpenAI (LLC), Stripe Inc., Twilio Inc. / Smslogic s. r. o., ScrapingBee SAS — úplný register, stav (podľa legendy vyššie) a stav DPA viď samostatný dokument „Register DPA".

### Poznámka k vrstvenej štruktúre
Vianema je prevádzkovateľ (určuje účely a prostriedky spracúvania osobných údajov svojich klientov). Machovic je sprostredkovateľ (čl. 28), ktorý technicky prevádzkuje CRM a využíva ďalších subprocesorov. Tento RoPA je vedený za prevádzkovateľa Vianema; pre Machovic ako sprostredkovateľa slúži zároveň ako záznam podľa čl. 30 ods. 2 (kategórie spracúvania vykonávané v mene prevádzkovateľa).

---

## B. Spoločné bezpečnostné opatrenia (čl. 32) — platí pre všetky činnosti nižšie

Nasledujúci opis platí pre celý systém; pri jednotlivých činnostiach sa uvádzajú už len špecifiká.

**Šifrovanie a pseudonymizácia**
- **AES-256 at-rest** — celá databáza (Supabase, šifrovanie úložiska).
- **AES-256-GCM (authenticated encryption)** pre najcitlivejšie dokumenty (kópie OP/pasu, AML doklady, LV scany) — `lib/cryptoDocs.ts`, master kľúč `DOC_ENCRYPTION_KEY` (32 B), samostatný IV per záznam, ochrana pred neoprávnenou manipuláciou (tampering).
- **Šifrované OAuth tokeny** — Google access/refresh tokeny ukladané šifrovane (`encryptToken`, `lib/crypto.ts`), server-only.
- **Hashovanie** — heslá používateľov ako hash; OTP a podpisové tokeny hashované (SHA-256), nikdy plaintext.

**Riadenie prístupu a viacnájomnosť (multi-tenancy)**
- **`requireUser()` gate** ako prvý krok každého chráneného API handlera (overená HMAC session).
- **App-scope izolácia** podľa `company_id` + roly (`lib/scope.ts`) — fail-closed; zákaz fallbacku na pevné `VIANEMA_COMPANY_ID`.
- **Row Level Security (RLS)** na úrovni databázy (cieľ pre všetky tabuľky s osobnými údajmi).
- **Re-autentifikácia (`requireReAuth`)** pri citlivých operáciách (zmena role/hesla, storno faktúry, mazanie).

**Integrita a forenzná stopa**
- **Append-only audit log** — nemenný (trigger `block_audit_mutations`, migr. 080); zaznamenáva kto/čo/kedy/odkiaľ (vrátane prístupov k citlivým dokumentom, GDPR/AML akcií, súhlasov).
- **Nemennosť po podpise/vystavení** — podpísané zmluvy a vystavené faktúry sú uzamknuté (snapshot dodávateľa, append-only invariant).

**Sieťová a aplikačná bezpečnosť**
- **HTTPS / HSTS** na všetkých doménach; allowlist povolených hostov v `middleware.ts`.
- **Rate-limiting** prihlásení (max 5 neúspechov / 15 min / IP) + evidencia pokusov o prihlásenie.
- **Upload guardy** (kontrola MIME, veľkosti, base64 limit) na všetkých nahrávacích endpointoch.
- **Politika AI providerov** — identifikačné/klientske dokumenty spracúva výhradne **Anthropic** (SCC/DPA, zero-/krátka retencia); Gemini a OpenAI sú zakázané na PII a používajú sa len na neosobné údaje (copywriting, trhová/okolitá analýza).

**Posúdenie oprávneného záujmu (LIA / balančný test) pri čl. 6 ods. 1 písm. f**
- Pri každej činnosti opretej o **oprávnený záujem (čl. 6 ods. 1 písm. f)** je podľa zásady zodpovednosti (čl. 5 ods. 2) **povinné vykonať a zdokumentovať trojstupňový test proporcionality** (legitímnosť záujmu — nevyhnutnosť spracúvania — prevaha záujmu prevádzkovateľa nad záujmami/právami dotknutej osoby), vrátane zohľadnenia **práva namietať podľa čl. 21**.
- **Najmä pri:** Č.16 (scraping a profilovanie tretích osôb — oprávnený záujem hraničný), Č.2 a Č.13 (spoluvlastníci z LV — tretie osoby mimo klientskeho vzťahu). Tam je LIA kritická a musí byť doložená písomne.
- LIA je vedená buď stručne pri jednotlivej činnosti, alebo v **samostatnej prílohe LIA (to-do — pripraviť pred ostrou prevádzkou, ratifikuje právnik)**.

**Organizačné opatrenia**
- Politika uchovávania (`retention-policy.md`); automatická anonymizácia neaktívnych klientov (cron F11 `/api/cron/retention-anonymize`, default DRY-RUN); výnimka z výmazu pre AML/účtovné doklady; rámec posúdenia porušenia ochrany údajov (`gdpr-breach-decision-framework.md`).

> **Stav prostredia (kontext, nie súčasť právneho záznamu):** systém aktuálne beží ako interné test/demo prostredie s fiktívnymi dátami; RoPA je vyhotovený dopredu, aby pri prechode na ostrú prevádzku s reálnymi osobnými údajmi bola compliance vrstva pevná.

---

## C. Register spracovateľských činností

> Pre každú činnosť: (a) účel · (b) kategórie dotknutých osôb a údajov · (c) kategórie príjemcov · (d) prenosy do tretích krajín a záruky · (e) lehoty uchovávania · (f) bezpečnostné opatrenia (nad rámec spoločných v časti B) · právny základ · zdroj údajov.
> Pôvodných 56 objavených činností je konsolidovaných do **22 spracovateľských činností** (zlúčené duplicity: viaceré AI parse routy → 1; PDF generovanie naviazané na materskú činnosť; samostatne ponechané rôzne Google scopy a marketingové súhlasy kvôli odlišnému právnemu základu/prenosu). Elektronický podpis cez OTP je vedený ako samostatná činnosť **Č.21** (jednotný podpisový kanál SMS/e-mail pre náberový list aj objednávku — predtým sľubovaná konsolidácia „3× podpis → 1" je týmto fakticky zrealizovaná). Doplnené samostatné činnosti **Č.21** (elektronický podpis cez OTP) a **Č.22** (objednávky fotoprodukcie/videa).

---

### Č.1 — Evidencia klientov (CRM databáza klientov)
**(a) Účel:** Centrálna evidencia predávajúcich, kupujúcich a záujemcov pre sprostredkovanie predaja/kúpy/prenájmu nehnuteľnosti — kontakt, segmentácia (typ/status), priradenie maklérovi, evidencia odporúčaní a histórie aktivity.
**(b) Dotknuté osoby:** predávajúci klienti · kupujúci klienti · záujemcovia/leady · klienti typu „oboje".
**Kategórie údajov:** meno a priezvisko · telefón · e-mail · lokalita/oblasť záujmu · typ a status (segmentácia) · poznámka (voľný text — môže neúmyselne obsahovať osobitné kategórie) · dátum náberu · identifikátor priradeného/zakladajúceho makléra · identifikátor odporúčajúceho klienta (sieťová väzba medzi osobami) · timestamp poslednej interakcie (retencia).
**(c) Príjemcovia:** makléri a manažéri prevádzkovateľa (app-scope `company_id` + rola) · Machovic s. r. o. (sprostredkovateľ) · Supabase Inc. (DB) · Vercel Inc. (hosting).
**(d) Prenos do 3. krajín:** Supabase — EÚ (Frankfurt), bez prenosu. Vercel — USA: EU-US DPF + SCC.
**(e) Retencia:** počas spolupráce; následne 7 rokov od poslednej aktivity, potom anonymizácia (cron F11). Klienti v aktívnom obchode → zákonná retencia (AML/dane).
**Právny základ:** čl. 6 ods. 1 písm. b (zmluva/predzmluvné vzťahy) pri aktívnych klientoch; čl. 6 ods. 1 písm. f (oprávnený záujem — dlhý realitný cyklus, opakovaný obchod) pri uchovaní kontaktu neaktívnych. Pri písm. f sa uplatní LIA podľa časti B.
**Osobitná kategória:** nie (poznámka môže incidentálne obsahovať — bez cielenej kontroly obsahu).
**Zdroj údajov:** priamo od dotknutej osoby; časť cez odporúčanie iného klienta.
**(f) Špecifické opatrenia:** PATCH cross-tenant guard (`eq company_id`) + audit log každej zmeny polí; XSS sanitizácia voľného textu; `anonymized_at` realizuje právo na výmaz/anonymizáciu (čl. 17).

---

### Č.2 — Spracovanie údajov spoluvlastníkov z listu vlastníctva (kataster)
**(a) Účel:** Pri nábere predávajúceho parsovanie LV z katastra a štruktúrované uloženie na klienta (`lv_data`) — mená a vlastnícke podiely VŠETKÝCH spoluvlastníkov nehnuteľnosti; previerka vlastníckych pomerov pred sprostredkovaním.
**(b) Dotknuté osoby:** spoluvlastníci nehnuteľnosti uvedení na LV (**tretie osoby — nie sú klientmi a o spracúvaní spravidla nevedia**).
**Kategórie údajov:** meno a priezvisko spoluvlastníka · vlastnícky podiel · adresa/parcelné údaje nehnuteľnosti · ďalšie údaje uvedené na LV (potenciálne dátum narodenia; výnimočne rodné číslo, ak ho LV obsahuje).
**(c) Príjemcovia:** makléri/manažéri (scope firmy) · Machovic · Supabase · Vercel.
**(d) Prenos:** Supabase EÚ (bez prenosu); Vercel USA — DPF + SCC.
**(e) Retencia:** 7 rokov od poslednej aktivity klienta, resp. po dobu obchodu; potom anonymizácia/výmaz (`lv_data` sa pri anonymizácii nuluje).
**Právny základ:** čl. 6 ods. 1 písm. f (oprávnený záujem — previerka vlastníckych pomerov, obhajoba nárokov). **Údaje nezískané od dotknutej osoby → informačná povinnosť podľa čl. 14 GDPR.** **LIA povinná (čl. 5 ods. 2):** ide o tretie osoby mimo klientskeho vzťahu — test proporcionality + zohľadnenie práva namietať (čl. 21) doložiť (viď časť B / príloha LIA).
**Osobitná kategória:** **Osobitná kategória (čl. 9): NIE.** Ak LV obsahuje rodné číslo spoluvlastníka → ide o **osobitný identifikátor podľa § 78 zák. 18/2018 Z. z.** (osobitné posúdenie zákonnosti), nie o čl. 9.
**Zdroj údajov:** verejný register — kataster (katasterportal.sk), parsovaný LV (čl. 14).
**(f) Špecifické opatrenia:** anonymizácia `lv_data` cez F11. **GDPR riziko (čl. 14):** spracúvanie údajov osôb mimo klientskeho vzťahu — viď zoznam medzier.

---

### Č.3 — Evidencia dopytov kupujúcich (objednávky / matching)
**(a) Účel:** Záznam požiadaviek kupujúceho (druh, lokalita, rozpočet, parametre) pre párovanie s portfóliom; pri jednoznačnej lokalite geokódovanie na súradnice pre vzdialenostný matching.
**(b) Dotknuté osoby:** kupujúci klienti · záujemcovia o kúpu.
**Kategórie údajov:** väzba na klienta (kontakt cez `klient_id`) · druh hľadanej nehnuteľnosti · lokalita (kraje/okresy) · geosúradnice odvodené z lokality · cenový rozpočet · parametre dopytu (plocha, izby, stav, konštrukcia, vykurovanie, termín, záloha) · elektronický podpis kupujúceho (base64 obrázok).
**(c) Príjemcovia:** makléri/manažéri (scope) · Machovic · Supabase · Vercel · **OpenStreetMap/Nominatim — geokódovanie len názvu lokality/okresu, bez identity klienta** (geokóder volaný v `lib/geocode.ts`).
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC; **OpenStreetMap/Nominatim — Veľká Británia, rozhodnutie o primeranosti (UK adequacy decision)** (prenáša sa len lokalita, nie identita klienta). *(Zladené s Č.8 a privacy policy v2.2 — všade UK adequacy.)*
**(e) Retencia:** naviazané na klienta — počas spolupráce + 7 rokov od poslednej aktivity (anonymizácia/CASCADE cron F11). Podpis 7 rokov.
**Právny základ:** čl. 6 ods. 1 písm. b (predzmluvný/zmluvný vzťah sprostredkovania kúpy); čl. 6 ods. 1 písm. f (uchovanie podpisu ako dôkazu úkonu — LIA podľa časti B).
**Osobitná kategória:** nie (elektronický podpis je stopa úkonu, nie biometria na identifikáciu → nie čl. 9).
**Zdroj údajov:** priamo od dotknutej osoby; geosúradnice generované systémom.

---

### Č.4 — História interakcií s klientom (denník komunikácie)
**(a) Účel:** Manuálny denník komunikácie/aktivít ku klientovi (hovory, poznámky, stretnutia, e-maily, zmeny statusu); reálny kontakt resetuje retenčnú lehotu.
**(b) Dotknuté osoby:** predávajúci/kupujúci klienti · záujemcovia.
**Kategórie údajov:** väzba na klienta · typ interakcie · popis (voľný text — môže obsahovať ľubovoľné osobné okolnosti) · autor záznamu (meno makléra) · čas.
**(c) Príjemcovia:** oprávnení makléri (`canEditRecord` scope) a manažéri · Machovic · Supabase · Vercel.
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC.
**(e) Retencia:** naviazané na klienta — anonymizácia free-text PII po 7 rokoch nečinnosti (F11); CASCADE pri zmazaní klienta.
**Právny základ:** čl. 6 ods. 1 písm. f (evidencia priebehu sprostredkovania, dôkaz o službe — LIA podľa časti B); pri aktívnom obchode aj písm. b.
**Osobitná kategória:** nie (riziko neúmyselného zápisu citlivého údaja vo voľnom texte — bez obsahovej kontroly).
**Zdroj údajov:** generované maklérom; obsah z komunikácie s dotknutou osobou.

---

### Č.5 — Sprostredkovanie obchodov / životný cyklus dealu
**(a) Účel:** Sledovanie obchodu od rezervácie po vklad do katastra (cena, provízia, kupujúci, notár, banka, stav); právny základ pre zákonnú retenciu klienta.
**(b) Dotknuté osoby:** predávajúci klient (vlastník obchodu) · kupujúci v obchode (uvedený menom — tretia osoba, ak nie je samostatným klientom).
**Kategórie údajov:** väzba na klienta a nehnuteľnosť · meno kupujúceho (voľný text) · kúpna cena · provízia · notár · banka · stav obchodu · poznámky · úlohy obchodu vrátane kategórie „aml".
**(c) Príjemcovia:** makléri/manažéri (company scope) · Machovic · Supabase · Vercel · notár a financujúca banka (v rámci realitnej transakcie, mimo CRM, v SR/EÚ).
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC.
**(e) Retencia:** po dobu obchodu a následne podľa premlčacích lehôt (spravidla do 10 r.) na obhajobu nárokov; finančné údaje (provízia) prelínajú s účtovnou retenciou 10 r.
**Právny základ:** čl. 6 ods. 1 písm. b (zmluva o sprostredkovaní) pre vlastného klienta; čl. 6 ods. 1 písm. f (evidencia transakcie, obhajoba nárokov — LIA podľa časti B) vrátane mena kupujúceho ako tretej osoby. **Odvetvová regulácia:** realitné sprostredkovanie podlieha zák. č. 170/2024 Z. z. — povinné predzmluvné informácie, poistenie zodpovednosti, registrácia a odborná spôsobilosť sprostredkovateľa (presné náležitosti overí právnik).
**Osobitná kategória:** nie.
**Zdroj údajov:** generované maklérom; meno kupujúceho od kupujúceho/z rezervačnej zmluvy.
**(f) Špecifické opatrenia:** company scope (S6 guard) + audit. **Bezpečnostný nález (mimo právnej vrstvy → okno Bezpečnosť):** RLS na `obchod_ulohy`/migr. 045 je `USING(true)` — reálna izolácia len aplikačná.

---

### Č.6 — Správa voľných klientov a SLA (uvoľnenie / prebratie / napomenutia)
**(a) Účel:** Riadenie poolu „voľných" klientov a SLA dohľad — pri nekonaní makléra sa klient uvoľní, iný ho prevezme, manažér je upozornený; audit presunov a výkonu maklérov.
**(b) Dotknuté osoby:** klienti v SLA dohľade · **makléri prevádzkovateľa** (sledovanie výkonu/napomenutí).
**Kategórie údajov:** identifikácia klienta (meno, telefón, status) · SLA timestampy (warning/critical/last_chance) · počet a dôvod napomenutí · dôvod a čas uvoľnenia · história presunov (z/na makléra, kto akciu vykonal, dôvod, meta) · akcie manažéra.
**(c) Príjemcovia:** makléri a manažéri (`isManager` gate) · Machovic · Supabase · Vercel.
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC.
**(e) Retencia:** `klienti_history` po dobu existencie vzťahu/firmy ako interný audit presunov (CASCADE pri zmazaní klienta); SLA flagy sa nulujú pri prebratí/vrátení.
**Právny základ:** čl. 6 ods. 1 písm. f (oprávnený záujem — riadenie kvality, férové prerozdeľovanie, kontrola výkonu maklérov; LIA podľa časti B). Voči maklérom (zamestnanci/spolupracovníci) oprávnený záujem na evidencii pracovného výkonu — **pri ostrej prevádzke informovať dotknutých zamestnancov o monitoringu.**
**Osobitná kategória:** nie.
**Zdroj údajov:** generované systémom (SLA logika) a maklérmi/manažérmi.

---

### Č.7 — Realizácia práv dotknutej osoby (GDPR export čl. 15/20) a manažérsky CSV export
**(a) Účel:** Vygenerovanie kompletného JSON exportu údajov klienta (právo na prístup/prenositeľnosť) a hromadný CSV export klientov firmy pre manažment.
**(b) Dotknuté osoby:** predávajúci/kupujúci klienti · záujemcovia.
**Kategórie údajov:** kompletný profil klienta (vrátane kontaktných a LV údajov) · zoznam obhliadok · náberových listov · dokumentov (metadáta) · udalostí/histórie; CSV: meno, telefón, e-mail, typ, status, lokalita, dátum.
**(c) Príjemcovia:** dotknutá osoba (príjemca JSON exportu) · manažment (role super_admin/majitel/manazer, RBAC) · Machovic · Supabase · Vercel.
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC; samotný export sa odovzdá dotknutej osobe.
**(e) Retencia:** export sa negeneruje natrvalo (on-demand); samotná akcia exportu je auditovaná (`gdpr_export_subject` / `gdpr_export` v audit_log). **Follow-up (2026-06-11, nie blocker):** export NEzapisuje do `gdpr_requests` (type='export') ako erasure → forenzná stopa je (audit_log), ale chýba štruktúrovaná evidencia žiadosti s received_at→completed_at na preukázanie 30-dňovej lehoty (čl. 12 ods. 3). Doplniť pre evidenčnú paritu s erasure (jednotný register GDPR žiadostí). Vlastník: Bezpecnost (rovnaký vzor ako erasure).
**Právny základ:** čl. 6 ods. 1 písm. c (zákonná povinnosť — práva čl. 15/20) pre GDPR export; čl. 6 ods. 1 písm. f (manažérsky reporting — LIA podľa časti B) pre CSV.
**Osobitná kategória:** nie.
**Zdroj údajov:** agregované z existujúcich záznamov.
**(f) Špecifické opatrenia:** tenant guard (`eq company_id`) + RBAC + audit; cross-tenant IDOR na exporte zafixovaný.

---

### Č.8 — Evidencia a správa portfólia nehnuteľností + publikácia inzerátu a fotodokumentácie
**(a) Účel:** Vedenie evidencie nehnuteľností v predaji/prenájme (typ, lokalita, ulica, plocha, cena, stav, vybavenie); tvorba a uloženie inzerátu vrátane fotografií do verejného Supabase Storage bucketu pre prezentáciu nehnuteľnosti.
**(b) Dotknuté osoby:** predávajúci klienti (vlastníci, väzba `klient_id`) · makléri · **potenciálne tretie osoby zachytené na fotografiách** (tváre, ŠPZ, osobné predmety/dokumenty).
**Kategórie údajov:** identifikátory klienta/makléra · adresa nehnuteľnosti · geolokácia (auto-geocode) · cena, plocha, dispozícia, stav, vybavenie · meno hypotekárneho poradcu (ak vyplnené) · fotografie nehnuteľnosti (môžu nepriamo obsahovať PII tretích osôb).
**(c) Príjemcovia:** makléri/manažéri firmy · Machovic · Supabase (DB + Storage) · Vercel · **OpenStreetMap/Nominatim** (geokódovanie — prijíma adresný reťazec) · **verejnosť/inzertné portály** (po publikovaní sú fotky a cena verejne dostupné cez public URL).
**(d) Prenos:** Supabase EÚ (DB + Storage). Vercel USA — DPF + SCC. **Public URL znamená technickú dostupnosť fotodokumentácie komukoľvek na internete (aj mimo EÚ) bez ďalšej kontroly prístupu.** **OpenStreetMap/Nominatim — Veľká Británia, rozhodnutie o primeranosti (UK adequacy decision)** (prenáša sa len adresný reťazec).
**(e) Retencia:** počas aktívnosti inzerátu + v rámci dokumentácie k nehnuteľnosti (7 r. / po dobu obchodu); po stiahnutí inzerátu fotky zmazať (DELETE maže large+thumb).
**Právny základ:** čl. 6 ods. 1 písm. b (plnenie zmluvy — prezentácia) + čl. 6 ods. 1 písm. f (oprávnený záujem na predaji — LIA podľa časti B). **Pri fotkách tretích osôb je nutné anonymizovať/rozmazať tváre a ŠPZ pred publikáciou.**
**Osobitná kategória:** nie.
**Zdroj údajov:** od subjektu / vytvorené maklérom; geocode generovaný systémom.
**(f) Špecifické opatrenia:** `requireUser` + `company_id` scope (P0 fix 2026-05-24) + audit na PATCH/DELETE; upload má `requireUser` + MIME/size guard. **Nálezy pre okno Bezpečnosť:** verejný bucket `inzerat-fotky`; legacy fallback `VIANEMA_COMPANY_ID` v `inzerat/save`. Viď zoznam medzier (rozmazanie fotiek tretích osôb).

---

### Č.9 — Matching kupujúci ↔ nehnuteľnosť + cenový odhad (CMA/pricing)
**(a) Účel:** Výpočet zhody medzi dopytom kupujúceho a nehnuteľnosťami a trhový cenový odhad (CMA) zo scraped dát Monitora; pri zhode sa maklérovi zobrazí kontakt predávajúceho aj kupujúceho.
**(b) Dotknuté osoby:** predávajúci a kupujúci klienti (kontakt pri zhode) · **tretie osoby zo scrapingu** (predajcovia z konkurenčných inzerátov ako kandidáti) · maklér (žiadateľ odhadu).
**Kategórie údajov:** meno a telefón predávajúceho/kupujúceho · lokalita a rozpočet · parametre a lokalita nehnuteľnosti (lat/lng) · agregované porovnateľné CMA vzorky · identifikátory v logu `pricing_estimates` (`user_id`, `klient_id`, `nehnutelnost_id`, vstupné parametre, owner_target_price).
**(c) Príjemcovia:** makléri firmy (kontakty pri zhode, company scope) · Machovic · Supabase · Vercel.
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC. Bez AI/LLM subprocesora (čisto algoritmus/SQL).
**(e) Retencia:** matching je derivovaná operácia v reálnom čase (neukladá vlastné PII). **`pricing_estimates` — lehota nie je v politike definovaná (medzera):** odporúčaná väzba na životný cyklus dokumentov k nehnuteľnosti (7 r.) alebo anonymizácia identifikátorov po uzavretí.
**Právny základ:** čl. 6 ods. 1 písm. f (sprostredkovanie — párovanie ponuky a dopytu, cenotvorba; LIA podľa časti B); čl. 6 ods. 1 písm. b pre cenový odhad pre vlastného klienta. Pre scraped tretie osoby viď Č.16.
**Osobitná kategória:** nie.
**Zdroj údajov:** od subjektov (klienti) + zo scrapingu (`monitor_inzeraty`) pre kandidátov + agregáty.
**(f) Špecifické opatrenia:** matching routes `requireUser` + cross-tenant guard. **Nálezy pre okno Bezpečnosť:** `/api/pricing/estimate` bez `requireUser`; `monitor_inzeraty` sa číta bez company filtra.

---

### Č.10 — Evidencia obhliadok nehnuteľností
**(a) Účel:** Plánovanie a evidencia obhliadok (spárovanie predávajúceho + nehnuteľnosti + kupujúceho záujemcu, dátum/miesto/poznámka, status); právne krytie makléra (preukázanie, že kupujúci videl nehnuteľnosť cez RK).
**(b) Dotknuté osoby:** predávajúci klienti · kupujúci záujemcovia (vrátane ad-hoc kontaktov, ktorí ešte nie sú klientmi) · makléri.
**Kategórie údajov:** meno kupujúceho, väzby na `klient_id` predávajúceho aj kupujúceho · telefón a e-mail kupujúceho · dátum/čas, miesto stretnutia (voľný text — môže byť presná adresa) · poznámka · makléra a status · systémové (timestampy, `company_id`, `calendar_event_id`).
**(c) Príjemcovia:** Vianema (makléri v scope) · Machovic · Supabase · Vercel.
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC (sync do Google je samostatná činnosť Č.11).
**(e) Retencia:** 7 rokov od vytvorenia, potom anonymizácia free-text PII (F11); nová obhliadka resetuje retenčnú lehotu účastníkov.
**Právny základ:** čl. 6 ods. 1 písm. f (evidencia obhliadok, právna ochrana/preukázanie sprostredkovania; LIA podľa časti B); pri aktívnom obchode aj písm. b.
**Osobitná kategória:** nie.
**Zdroj údajov:** od dotknutej osoby (kupujúci na obhliadke) alebo z karty klienta.
**(f) Špecifické opatrenia:** `requireUser` + scope `company_id`; PATCH/DELETE strict re-auth + `canEditRecord`; anon RLS (pôvodne migr. 024) revoknuté (072/077). **GDPR riziko:** pri zadaní kupujúceho sa automaticky vytvorí/aktualizuje záznam v `klienti` (typ=kupujuci, zdroj=obhliadka) bez explicitného informovania dotknutej osoby — viď medzery.

---

### Č.11 — Synchronizácia obhliadok a CRM udalostí do Google Calendar (vrátane auto-detekcie)
**(a) Účel:** Vytvorenie/aktualizácia/zmazanie udalosti v Google Kalendári makléra (obhliadka, „zavolať", náber); spätné čítanie eventov a heuristická auto-detekcia nezaradených obhliadok (±30 dní).
**(b) Dotknuté osoby:** kupujúci/predávajúci klienti a tretie osoby uvedené v eventoch (meno/telefón/adresa) · makléri (vlastník kalendára).
**Kategórie údajov:** názov udalosti (meno klienta/typ úkonu) · popis (telefón, poznámka) · miesto (adresa) · dátum/čas · `calendar_event_id`/htmlLink.
**(c) Príjemcovia:** Google LLC (Calendar) · maklér · Vianema/Machovic · Vercel.
**(d) Prenos:** **Google LLC — USA: EU-US DPF + SCC.** Údaje klienta (meno/telefón/adresa) vložené do eventu sa prenášajú do Google.
**(e) Retencia:** dáta žijú v Google Kalendári makléra podľa nastavení účtu / do zmazania (DELETE maže event v Google); v CRM len `calendar_event_id`. Auto-detekcia je dočasné spracovanie.
**Právny základ:** čl. 6 ods. 1 písm. f (organizácia termínov makléra, úplnosť evidencie; LIA podľa časti B); pri aktívnom klientovi aj písm. b.
**Osobitná kategória:** nie.
**Zdroj údajov:** generované systémom z údajov obhliadky/CRM; auto-detect číta Google Kalendár makléra (sekundárny zdroj).
**(f) Špecifické opatrenia:** auto-detect už má `requireUser` + ownership (P0 fix 2026-05-20). **Nálezy pre okno Bezpečnosť (IDOR):** `/api/google/calendar`, `/api/calendar-sync` (ukladá event vrátane telefónu do `logy` ako `calendar_pending`) a `/api/calendar/events` (cache eventov s PII v `logy`) berú `userId` z query bez overenia.

---

### Č.12 — Detekcia a evidencia kolízií (duplicitný klient / dvojitý náber)
**(a) Účel:** Pri zakladaní klienta/nehnuteľnosti kontrola duplicít (rovnaký telefón/e-mail; tá istá nehnuteľnosť naberaná iným maklérom); záznam do kolízneho logu a notifikácia dotknutých maklérov.
**(b) Dotknuté osoby:** existujúci klienti (zhoda kontaktu) · makléri A vs B (pri kolízii nehnuteľnosti).
**Kategórie údajov:** meno + priezvisko klienta · telefón/e-mail klienta (popis kolízie + meta) · e-mail a meno makléra A/B · údaje o nehnuteľnosti, stav/závažnosť kolízie, poznámka.
**(c) Príjemcovia:** makléri/manažér Vianema · Machovic · Supabase · Vercel · Resend Inc. (notifikačný e-mail o kolízii, ak odoslaný).
**(d) Prenos:** Supabase EÚ; **notifikačný e-mail cez Resend Inc. — USA: EU-US DPF.**
**(e) Retencia:** **politika neuvádza samostatnú lehotu (medzera)** — odporúčanie: viazať na životnosť súvisiacich záznamov, resp. mazať/anonymizovať vyriešené kolízie staršie než stanovené obdobie. Aktuálne sa nemažú automaticky.
**Právny základ:** čl. 6 ods. 1 písm. f (integrita CRM, prevencia dvojitého náberu, ochrana provízneho nároku; LIA podľa časti B).
**Osobitná kategória:** nie.
**Zdroj údajov:** generované systémom z údajov zadaných pri zakladaní klienta/nehnuteľnosti.
**(f) Špecifické opatrenia:** pri anonymizácii klienta (F11) overiť anonymizáciu aj `kolizny_log`. **Nálezy pre okno Bezpečnosť:** `kolize` GET bez `requireUser` a bez `company_id` filtra (cross-tenant leak); `kolize/check` a `kolize/nehnutelnosti` bez auth; `kolize/schvalit` používa anon kľúč.

---

### Č.13 — Náberové listy a výhradné zmluvy o sprostredkovaní (ÚZ/RZ/KZ/výhradná)
**(a) Účel:** Evidencia nehnuteľnosti prijatej do sprostredkovania a generovanie/evidencia zmluvy o (výhradnom) sprostredkovaní — identifikácia majiteľa, užívateľa, konateľa (pri PO), spoluvlastníkov, nehnuteľnosti, ceny, provízie, podmienok a podpisu. Podklad pre celý realitný obchod.
**(b) Dotknuté osoby:** predávajúci klienti (majitelia) · užívatelia nehnuteľnosti odlišní od majiteľa · konatelia/jednatelia (PO) · spoluvlastníci z LV · makléri.
**Kategórie údajov:** meno a priezvisko majiteľa · telefón/e-mail majiteľa · meno a kontakt užívateľa · meno konateľa · adresa a identifikácia nehnuteľnosti (kraj/okres/obec/k.ú./ulica/súpisné/parcela/č. bytu) · predajná cena, provízia, podmienky · dátum a doba platnosti zmluvy · `lv_data` (mená spoluvlastníkov, podiely, dátum narodenia) · **RODNÉ ČÍSLO vlastníkov (`vyhradne_zmluvy.majitelia` JSONB — pole `rc`)** · príznak GDPR súhlasu · podpis (`podpis_data`) + metadáta (IP, UA, čas, príjemca) · poznámky (voľný text).
**(c) Príjemcovia:** Machovic · Supabase · Vercel · priradený maklér a manažér/majiteľ RK v scope firmy · notár/kataster (pri následnom obchode, údaje zo zmluvy).
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC. (Generovanie PDF a e-mailové odoslanie sú Č.14; elektronický podpis cez OTP je Č.21.)
**(e) Retencia:** dokumenty k nehnuteľnosti 7 rokov od poslednej aktivity / po dobu obchodu; **podpísaná zmluva (ÚZ/RZ/KZ/výhradná) po dobu premlčacích lehôt (spravidla do 10 r.)** na uplatnenie/obhajobu nárokov. Pri GDPR výmaze sa PII v poli `majitelia` (vrátane rodného čísla) anonymizuje/zmaže, údaje o nehnuteľnosti a zmluva ostávajú (G1 fix). Anonymizácia free-text cez F11.
**Právny základ:** čl. 6 ods. 1 písm. b (predzmluvné vzťahy a plnenie zmluvy o sprostredkovaní) pre údaje klienta; čl. 6 ods. 1 písm. f (uplatnenie/obhajoba nárokov, opakovaný obchod, spoluvlastníci z LV → čl. 14; LIA pre spoluvlastníkov povinná, viď časť B). **Pre rodné číslo: § 78 zák. 18/2018 Z. z. v spojení s AML (čl. 6 ods. 1 písm. c).** **Odvetvová regulácia:** zmluva o realitnom sprostredkovaní podlieha zák. č. 170/2024 Z. z. (povinné náležitosti, predzmluvné informácie, poistenie zodpovednosti, registrácia, odborná spôsobilosť — presné znenie a náležitosti overí právnik).
**Osobitná kategória:**
— **Osobitná kategória (čl. 9): NIE** (žiadne údaje o zdraví/biometrii).
— **Osobitný identifikátor (§ 78 zák. 18/2018): ÁNO — rodné číslo** vlastníkov (najcitlivejší PII bod domény). Dátum narodenia spoluvlastníkov je citlivý identifikátor z verejného registra (čl. 14).
**Zdroj údajov:** od dotknutej osoby (vlastník/užívateľ) + z katastra/LV (spoluvlastníci — čl. 14).
**(f) Špecifické opatrenia:** `/api/nabery` a `/api/vyhradna-zmluva` — `requireUser` + filter `company_id` + `canEditRecord` + audit (create/update/sign/delete). Po podpise záznam uzamknutý (integrita). LIST endpoint nevracia `podpis_data`/`podpis_meta`. RLS na `vyhradne_zmluvy` len service_role. **🔴 Akákoľvek zmena znenia/poľa `rc` spadá pod červený protokol (právo/compliance).**

---

### Č.14 — Generovanie a e-mailové doručenie PDF dokumentov (náberový list, obhliadkový list, objednávka)
**(a) Účel:** Vytvorenie PDF kópie náberového listu / obhliadkového listu (vyhlásenie kupujúceho o exkluzivite) / objednávky kupujúceho a jeho odoslanie e-mailom klientovi; uloženie kópie PDF (pri obhliadkovom liste).
**(b) Dotknuté osoby:** predávajúci klienti · kupujúci záujemcovia (príjemcovia) · spoluvlastníci z LV (v náberovom liste) · užívatelia · makléri (reply-to).
**Kategórie údajov:** meno, telefón, e-mail klienta · meno a kontakt majiteľa/užívateľa · spoluvlastníci z LV (meno, podiel, dátum narodenia) · údaje o nehnuteľnosti, cena, provízia, podmienky · dátum/čas a miesto obhliadky · e-signature blok (meno + dátum podpisu) · vygenerovaný PDF (uložený pri obhliadkovom liste `list_pdf_base64`), `email_sent_at`, `email_sent_to`.
**(c) Príjemcovia:** klient (príjemca e-mailu s PDF) · Resend Inc. (doručenie e-mailu) · Machovic · Supabase · Vercel.
**(d) Prenos:** **Resend Inc. — USA: EU-US DPF.** E-mail vrátane PDF prílohy s plným PII (vrátane dátumov narodenia spoluvlastníkov) prechádza cez Resend (USA).
**(e) Retencia:** PDF náberového listu/objednávky sa negeneruje natrvalo (on-demand → kopíruje retenciu materského záznamu, 7 r. / do premlčania). Uložené PDF obhliadkového listu (`list_pdf_base64`) 7 rokov, potom anonymizácia/zmazanie (F11). Logy doručenia u Resend podľa jeho politiky.
**Právny základ:** čl. 6 ods. 1 písm. b (kópia zmluvného podkladu/exkluzivita) + čl. 6 ods. 1 písm. f (komunikácia a evidencia; LIA podľa časti B). **⚠️ Otvorený bod — obhliadkový list (právny základ na rozhodnutí právnika):** generovaný PDF text obhliadkového listu dnes obsahuje formuláciu „súhlasím so spracovaním", čo implikuje **súhlas (čl. 6 ods. 1 písm. a)**; tento RoPA naopak uvádza ako základ **čl. 6 ods. 1 písm. b + f**. Ide o rozpor medzi textom dokumentu a deklarovaným právnym základom — **právny základ obhliadkového listu je OTVORENÝ a rozhodne ho právnik.** Samotný PDF text sa v tomto kroku neprepisuje (zmena znenia s právnym účinkom spadá pod červený protokol).
**Osobitná kategória:**
— **Osobitná kategória (čl. 9): NIE.**
— **Osobitný identifikátor (§ 78 zák. 18/2018): NIE** v tomto PDF (rodné číslo sa do týchto dokumentov negeneruje); dátum narodenia spoluvlastníkov je citlivý identifikátor z verejného registra (čl. 14).
**Zdroj údajov:** generované systémom z materského záznamu (klient + nehnuteľnosť + obhliadka).
**(f) Špecifické opatrenia:** `naber-pdf` GET/POST volá `assertCanReadNaber` (session + scope + `company_id`). **Nálezy pre okno Bezpečnosť (IDOR):** `GET /api/obhliadky/pdf?id=` a `GET /api/objednavka-pdf` bez `requireUser` — PDF so všetkými kontaktmi dostupné cez UUID. **Právny súlad textu:** rozpor „súhlas" vs deklarovaný základ (písm. b/f) — viď bod (e) a zoznam medzier; rozhodnutie o právnom základe je na právnikovi.

---

### Č.15 — AI extrakcia údajov z klientskych dokumentov a z voľného textu správy klienta (parse-doc / parse-pdf / parse-lv / ai-fill)
**(a) Účel:** (1) Automatické vyplnenie polí náberového listu/nehnuteľnosti z nahraného dokumentu (LV, znalecký posudok, kúpna/rezervačná zmluva, nadobúdací doklad, energetický certifikát) cez Anthropic Claude — extrakcia parametrov nehnuteľnosti aj údajov vlastníkov/spoluvlastníkov; (2) **AI extrakcia štruktúrovaných údajov z voľného textu správy/e-mailu klienta** (`/api/ai-fill`) — z textovej správy klienta sa vytiahnu kontaktné a dopytové polia (meno, telefón, e-mail, typ, lokalita, rozpočet, poznámka).
**(b) Dotknuté osoby:** predávajúci/kupujúci klienti · **spoluvlastníci a tretie osoby uvedené v dokumente** (z katastra, zmlúv, posudkov; znalec).
**Kategórie údajov:** obsah celého nahraného dokumentu — mená, dátumy narodenia, adresy/bydliská, čísla bytov/parciel, IČO, IBAN, ceny; pri LV: mená vlastníkov, podiely, dátumy narodenia, adresy, ťarchy/právne vady (záložné práva, vecné bremená, exekúcie); pri zmluve/OP potenciálne rodné číslo a kópia dokladu (ak je takýto dokument nahraný). **Pri `ai-fill`:** obsah voľnej textovej správy/e-mailu klienta vrátane jeho kontaktných údajov (meno, telefón, e-mail) a požiadaviek.
**(c) Príjemcovia:** Machovic · **Anthropic PBC (AI parsing klientskych dokumentov — Claude Haiku/Sonnet; AI extrakcia z voľného textu — Claude Haiku)** · Supabase (uloženie výsledku do `lv_data`) · Vercel.
**(d) Prenos:** **ÁNO — Anthropic PBC (USA): Štandardné zmluvné doložky (SCC)/DPA.** Obsah dokumentu (resp. správy klienta pri `ai-fill`) s PII sa odosiela do USA. **Gemini a OpenAI sú z PII parse/extrakčného flow zámerne neuvedené/odstránené (F2, 2026-06-03)** — free Gemini tier môže trénovať na dátach a chýba DPA.
**(e) Retencia:** nahraný súbor sa nespracúva trvalo — odošle sa na inferenciu a vráti sa extrahovaný JSON; aplikácia súbor neukladá (uloží sa len výsledné pole do náberového listu → retencia 7 r. / do premlčania). **Pri `ai-fill`: extrahovaný JSON výsledok sa neukladá natrvalo** — vráti sa do formulára na použitie maklérom; do DB sa uloží až vtedy, keď maklér z neho vytvorí klienta/dopyt (vtedy preberá retenciu Č.1/Č.3). Anthropic podľa DPA dáta z API neuchováva na tréning a maže v krátkej lehote. Pri zlyhaní len metadáta (`logParseFailure`), nie obsah.
**Právny základ:** čl. 6 ods. 1 písm. b (príprava/plnenie zmluvy) pre klienta; čl. 6 ods. 1 písm. f (efektívne spracovanie podkladov / extrakcia z komunikácie klienta — LIA podľa časti B) pre tretie osoby z dokumentu (kataster → čl. 14) a pre `ai-fill`. Pri rodnom čísle — § 78 zák. 18/2018.
**Osobitná kategória:**
— **Osobitná kategória (čl. 9): NIE** (žiadne údaje o zdraví/biometrii).
— **Osobitný identifikátor (§ 78 zák. 18/2018): MOŽNÝ — rodné číslo**, ak je v nahranom dokumente. LV štandardne neuvádza rodné číslo a `parse-lv` ho neextrahuje; spracúva sa však celý surový obsah dokumentu.
**Zdroj údajov:** od dotknutej osoby (dokument nahráva maklér v jej mene; resp. správa klienta pri `ai-fill`), z verejného registra (LV/kataster — čl. 14), od tretích strán v zmluvách/posudkoch.
**(f) Špecifické opatrenia:** `parse-doc`/`parse-pdf` majú `requireUser` + `assertFileSize` + `assertMime` + base64 guard + kill-switch `aiParseDisabled`; `maxDuration` 300 s pre `parse-doc`. **Princíp minimalizácie:** maklér má nahrávať len potrebné strany a do `ai-fill` vkladať len relevantný text. **Nálezy pre okno Bezpečnosť:** `/api/parse-lv` nemá `requireUser` (POST bez auth); `/api/ai-fill` posiela voľný text klienta do Anthropic — overiť `requireUser` na endpointe.

---

### Č.16 — Scraping konkurenčných inzerátov + klasifikácia predajcu (súkromník/RK) + manuálna AI analýza inzerátu z URL
**(a) Účel:** Automatizovaný zber verejne dostupných inzerátov z portálov (bazos, reality, nehnutelnosti, topreality, byty) pre prehľad konkurencie a trhu; klasifikácia predajcu (súkromník = potenciálny lead vs RK) pre cielenú notifikáciu makléra; manuálna AI analýza jedného inzerátu z URL (ocenenie/verdikt).
**(b) Dotknuté osoby:** **TRETIE OSOBY — predajcovia nehnuteľností z konkurenčných inzerátov (najmä súkromní predajcovia), ktorí NIE sú klientmi Vianema a o spracúvaní spravidla nevedia;** realitní makléri/RK konkurencie (firemné kontakty).
**Kategórie údajov:**
— **Transientne (len v pamäti počas behu, NEUKLADÁ sa do DB — migr. 106):** meno predajcu, telefón predajcu, voľný text popisu, surové scrape dáta (možný e-mail/identifikátory); pri manuálnej URL analýze celý text inzerátu (do 18 000 znakov) + fotka (og:image).
— **Ukladané do DB (`monitor_inzeraty`) — neosobné údaje o objekte:** URL inzerátu, portál, external_id, typ, lokalita, cena, plocha, izby, foto_url, poschodie, stav, dátumy first/last_seen, odvodený nadpis (NIE pôvodný titulok s menom/kontaktom).
— **Anonymný identifikátor účtu predajcu (`inzerent_id`)** + výsledok profilovania (`predajca_typ` súkromný/firma, confidence, signály — bez samotného mena).
**(c) Príjemcovia:** Machovic · Supabase (neosobné údaje o objekte) · **ScrapingBee SAS (SaaS scraping — obsah stránok vrátane PII predajcu cez ňu prechádza v PRENOSE, neukladá sa)** · **Anthropic PBC (manuálna URL analýza — dostáva text + fotku vrátane prípadného PII predajcu)** · Vercel · realitné portály (zdroj) · makléri Vianema (notifikácia o leade).
**(d) Prenos:** **ScrapingBee SAS — mimo zoznamu subprocesorov v privacy policy (medzera — doplniť DPA + posúdiť lokalitu/záruky).** Anthropic PBC (USA) — SCC (manuálna URL analýza). Vercel (USA) — DPF + SCC. Supabase — EÚ (neosobné dáta). Klasifikácia samotná je deterministický kód bez externého AI.
**(e) Retencia:** **PII predajcu (meno/telefón/popis): NULOVÁ — nikdy sa neukladá** (data-minimizácia, migr. 106 DROP COLUMN; overené v kóde). Manuálna URL analýza nič neukladá do DB (výsledok len v odpovedi). Neosobné `monitor_inzeraty`: **bez explicitnej lehoty (medzera)** — odporúčaná retencia napr. 12–24 mes. od last_seen. Audit behu scrape (`monitor.scrape`) append-only bez PII.
**Právny základ:** čl. 6 ods. 1 písm. f (oprávnený záujem RK na prehľade konkurencie a trhu). **Pri PII tretích osôb je oprávnený záujem HRANIČNÝ → vyžaduje sa povinný a doložený test proporcionality (LIA, čl. 5 ods. 2 — viď časť B / príloha LIA) a informačná povinnosť podľa čl. 14.** **Pozor na argumentačné rozdelenie (oprava oproti predchádzajúcej verzii):**
— **Neukladanie PII nie je samo o sebe výnimkou z čl. 14;** je to argument k zásade **minimalizácie údajov (čl. 5 ods. 1 písm. c)** a k zmierneniu rizika.
— **Transientné spracúvanie PII predajcu počas behu + profilovanie predajcu** napriek neukladaniu **podlieha čl. 6 ods. 1 písm. f a vyžaduje LIA.**
— **Informačná povinnosť podľa čl. 14 sa splní** buď **verejným oznámením** (privacy notice pre dotknutých predajcov), alebo **individuálne odôvodnenou výnimkou podľa čl. 14 ods. 5 písm. b** (neprimeranosť úsilia) — výnimku treba zdokumentovať, nie len predpokladať.
**Profilovanie (čl. 4 bod 4)** — nejde o automatizované rozhodovanie s právnym účinkom (čl. 22; rozhoduje človek), ale treba ho pokryť informačnou povinnosťou (čl. 14) a v LIA.
**Osobitná kategória:** nie.
**Zdroj údajov:** scraping verejne dostupných inzerátov (nie od dotknutej osoby — čl. 14); priamy fetch (reality.sk, bazos.sk) alebo cez ScrapingBee (ostatné).
**(f) Špecifické opatrenia:** manuálna URL analýza má `requireUser(strict)` + SSRF allowlist domén. **Najcitlivejšia časť RoPA z hľadiska tretích osôb.** Medzery: (1) ScrapingBee v privacy policy + DPA; (2) retencia `monitor_inzeraty`; (3) do AI pri URL analýze ide nedataminimizovaný text inzerátu vrátane mena predajcu; (4) profilovanie predajcov výslovne uviesť v čl. 14 oznámení; (5) doložiť LIA.

---

### Č.17 — AI analýza okolia a trhová/cenová analýza nehnuteľnosti (neosobné údaje)
**(a) Účel:** Posúdenie okolia nehnuteľnosti (doprava, vybavenosť, charakter, skóre) cez Google Gemini z adresy; ocenenie nehnuteľnosti voči trhu (benchmark €/m², odchýlka, AI verdikt) cez Gemini s fallbackom OpenAI; voliteľné uloženie do `analyzy_trhu`.
**(b) Dotknuté osoby:** nepriamo predávajúci klient/vlastník (adresa nehnuteľnosti spojiteľná s osobou; väzba `klient_id` v `analyzy_trhu`); inak žiadne priame osobné údaje.
**Kategórie údajov:** adresa nehnuteľnosti (do Gemini — okolie) · neosobné údaje o objekte/trhu (lokalita, typ, plocha, cena, izby — do Gemini/OpenAI) · v `analyzy_trhu`: obec, typ, plocha, ceny, hodnotenie, odchýlka, komentár + voliteľný `klient_id`.
**(c) Príjemcovia:** Machovic · **Google LLC (Gemini)** / **OpenAI (GPT-4o fallback)** — dostávajú len neosobné údaje o objekte/trhu (adresa pri analýze okolia) · Supabase (uloženie analýzy).
**(d) Prenos:** **Google LLC (Gemini, USA) — EU-US DPF + SCC; OpenAI (USA) — EU-US DPF.** Posielajú sa LEN neosobné údaje (adresa pri analýze okolia) — v súlade s politikou AI providerov (Gemini/OpenAI len na nie-PII).
**(e) Retencia:** `analyzy_trhu` — **bez explicitnej lehoty (medzera);** obsah neosobný okrem FK `klient_id` (pri výmaze klienta `ON DELETE SET NULL` → ostáva anonymná trhová analýza). Odporúčaná väzba na retenciu klienta (7 r.). Endpointy okolia samé nič neukladajú.
**Právny základ:** čl. 6 ods. 1 písm. f (trhová analýza/cenotvorba; LIA podľa časti B); pri vlastnom klientovi čl. 6 ods. 1 písm. b (ocenenie pre klienta). Dáta do AI sú neosobné → minimálny GDPR dopad na AI vrstvu.
**Osobitná kategória:** nie.
**Zdroj údajov:** generované systémom z údajov o nehnuteľnosti + agregáty z `monitor_inzeraty`.
**(f) Špecifické opatrenia:** **Nález pre okno Bezpečnosť:** `okolie-analysis` a `naber-analyza` nemajú `requireUser` (POST bez auth, spúšťa platené AI volania).

---

### Č.18 — Faktúry, odberatelia, dodávateľský profil makléra a billing predplatného (finančná doména)
**(a) Účel:** Vystavovanie a evidencia odberateľských faktúr za realitné služby (nemenný účtovný/daňový doklad); správa číselníka odberateľov; uloženie identity makléra ako dodávateľa (hlavička, bankové spojenie, podpis); generovanie PDF faktúry (rozpis DPH ak je dodávateľ platiteľom DPH, platobné QR Pay by Square); správa predplatného CRM cez Stripe; evidencia províznych sadzieb a výpočet provízií; evidencia pravidelných nákladov firmy; finančný/prehľadový záznam makléra (`prehlad_zaznamy`).
**(b) Dotknuté osoby:** odberatelia — fyzické osoby (živnostníci/SZČO a nepodnikajúce FO) · kontaktné osoby odberateľa (PO) · makléri/SZČO (dodávateľ, provízne sadzby, prehľadové záznamy) · realitná kancelária ako zákazník SaaS a jej fakturačná osoba (billing).
**Kategórie údajov:** identifikačné údaje odberateľa (názov/meno, adresa, IČO, DIČ, IČ DPH — `odberatel_snapshot` + tabuľka `odberatelia`) · kontakt odberateľa (e-mail, telefón) · číslo faktúry, VS · finančné údaje (suma bez DPH, DPH, celkom, dátumy vystavenia/dodania/splatnosti, forma a stav úhrady) · položky faktúry (voľný text — môže obsahovať meno klienta/adresu) · snapshot dodávateľa (meno, adresa, IČO/DIČ/IČ DPH, IBAN, banka, SWIFT, e-mail, telefón, **obrázok podpisu**) · provízne percentá/medziprovízia + meno makléra · údaje o storne · **prehľadové záznamy `prehlad_zaznamy`** (finančný/prehľadový záznam makléra: typ príjem/výdaj, dátum, popis, suma, stav úhrady; väzba `user_id` makléra a `faktura_id`) · billing: názov a e-mail firmy, Stripe customer/subscription ID, plán, platnosť.
**(c) Príjemcovia:** Machovic · Supabase · Vercel · **Stripe Inc. (spracovanie platieb predplatného — kód pripravený, NEAKTÍVNY na prode)** · odberateľ/príjemca faktúry (vidí údaje dodávateľa vrátane IBAN a podpisu na faktúre) · daňový/účtovný poradca (mimo systému) · Finančná správa / ÚOOÚ pri kontrole.
**(d) Prenos:** Supabase EÚ (bez prenosu). Vercel USA — DPF + SCC. **Stripe Inc. — USA: EU-US DPF/SCC — stav: „kód pripravený — NEAKTÍVNY na prode (env nenastavené, overí Bezpecnost)".** Checkout predplatného bez nastaveného Stripe price ID zlyhá, takže reálny prenos údajov do Stripe aktuálne neprebieha; pred aktiváciou doplniť Stripe do zoznamu subprocesorov v privacy policy + DPA. Anthropic/OpenAI/Gemini sa pri faktúrach **zámerne neuvádzajú** (nepoužívajú sa).
**(e) Retencia:** **faktúry + účtovné doklady 10 rokov** — § 76 zák. 222/2004 Z. z. (DPH) + § 35 zák. 431/2002 Z. z. (účtovníctvo). Faktúra je append-only/nemenná po vystavení (PATCH dovoľuje meniť len zaplatene/datum_uhrady/poznamka; oprava len storno + nová faktúra; mazanie = soft-delete, fyzicky ostáva 10 r.). **Žiadna GDPR erasure** na faktúrach v rámci lehoty (čl. 17 ods. 3 písm. b). `prehlad_zaznamy` viazané na faktúru sa pri storne nemažú (zostávajú ako účtovný/prehľadový záznam, len sa označia ako nezapočítavané do príjmov). Číselník odberateľov mazateľný (faktúry držia immutable snapshot). Dodávateľský profil po dobu spolupráce (snapshot na faktúre 10 r.). Billing po dobu zmluvného vzťahu + 10 r. účtovná retencia faktúr za predplatné. Provízne sadzby po dobu spolupráce; pri premietnutí do účtovníctva 10 r.
**Právny základ:** čl. 6 ods. 1 písm. c (zákonná povinnosť — DPH a účtovníctvo) + čl. 6 ods. 1 písm. b (plnenie zmluvy/fakturácia). Podpis dodávateľa: písm. b/f (riadne vyhotovenie dokladu). Pravidelné náklady a prehľadové záznamy: prevažne mimo osobných údajov FO (písm. f, pri účtovnom premietnutí písm. c).
**Daňové spresnenie (DPH):** **rozpis DPH sa na faktúre aplikuje LEN ak je dodávateľ platiteľom DPH** (`firma_info.platca_dph = true`). **V aktuálnom stave je `firma_info.platca_dph = false` (default v `getFirmaInfo.ts` aj migr. 079) → faktúra sa vystavuje bez rozpisu DPH** (neplatiteľ). Pri prechode na platiteľa DPH sa aktivuje rozpis sadzieb a táto poznámka sa upraví.
**Osobitná kategória:** nie (obrázok podpisu nie je biometrický údaj v zmysle čl. 9 — nie je to technické spracúvanie na jedinečnú identifikáciu).
**Zdroj údajov:** od dotknutej osoby (odberateľ/dodávateľ); z verejného registra cez `/api/ico-lookup` (názov, adresa, DIČ, IČ DPH podľa IČO); generované systémom (číslo faktúry, VS, výpočet DPH ak platiteľ); od Stripe (webhook eventy — po aktivácii).
**(f) Špecifické opatrenia:** `requireUser` na GET/POST/PATCH/DELETE faktúr/odberateľov; audit (`faktura.*`, `odberatel.*`, `dodavatel.upsert`, `provizie.*`, `billing.*`); `company_id` scope; `prehlad_zaznamy` filtrované podľa `user_id` makléra; M1 re-auth pri storne; snapshot dodávateľa = integrita nemennej faktúry; Stripe webhook overuje podpis `STRIPE_WEBHOOK_SECRET` (po aktivácii). **Nálezy pre okno Bezpečnosť (IDOR):** `GET /api/faktury/pdf?id=` (PDF s PII oboch strán + IBAN + podpis cez UUID — task_2bd71f5d), `GET /api/dodavatel` (IBAN/SWIFT/podpis cez `?user_id`), `makler-provizie-pct` GET, `pravidelne-naklady` GET bez `requireUser`.

---

### Č.19 — AML/KYC identifikácia a overenie totožnosti (FO, PO + KÚV) a zákonná retencia AML dokladov
**(a) Účel:** Splnenie zákonnej povinnosti povinnej osoby (RK podľa § 5 ods. 1 písm. h zák. 297/2008 Z. z.) — identifikovať a overiť totožnosť klienta-FO a klienta-PO vrátane štatutára a konečného užívateľa výhod (KÚV) pred uzavretím obchodného vzťahu; uchovať AML dokumentáciu v zákonnej lehote a riadiť kolíziu s právom na výmaz; procesný AML gate v životnom cykle obchodu (blokovanie KZ bez dokončenej AML kontroly).
**(b) Dotknuté osoby:** predávajúci a kupujúci klienti (FO) · spoluvlastníci/ďalší účastníci obchodu z LV · zákonní zástupcovia a splnomocnené osoby · štatutárni zástupcovia/konatelia klienta-PO · koneční užívatelia výhod (KÚV).
**Kategórie údajov:** meno a priezvisko · dátum narodenia · **RODNÉ ČÍSLO (§ 78 zák. 18/2018)** · adresa trvalého pobytu · štátna príslušnosť · číslo dokladu totožnosti (OP/pas) · **kópia/scan dokladu totožnosti vrátane fotografie a podpisu (`text_content` + `data_base64`, šifrované AES-256-GCM)** · pri PO: obchodné meno, sídlo, IČO, údaje štatutára a KÚV, výpis z OR · stav AML úloh obchodu + audit pokusu o obídenie (`kz.aml_blocked`).
**(c) Príjemcovia:** Machovic (processor) · Supabase (DB, EÚ Frankfurt) · **Finančná spravodajská jednotka SR / NAKA** (pri ohlásení neobvyklej obchodnej operácie — § 17 zák. 297/2008, presné ustanovenie ohlásenia **overí právnik**) · ÚOOÚ a orgány dohľadu AML (na vyžiadanie) · Anthropic PBC (LEN ak sa identifikačný/AML dokument posiela na AI parse — výhradne Anthropic; Gemini/OpenAI zámerne neuvedené/zakázané na PII).
**(d) Prenos:** primárne úložisko (`klient_dokumenty` v Supabase) v EÚ (Frankfurt) — **prenos mimo EHP nevzniká.** Hosting Vercel (EU edge + USA) — DPF + SCC. Pri AI parse identifikačného dokumentu prenos do USA (Anthropic PBC) na základe SCC.
**(e) Retencia:** **5 rokov po skončení obchodného vzťahu (§ 20 zák. 297/2008 Z. z.).** Technicky: `aml_retention=true`; **pri GDPR výmaze klienta sa AML doklady NEMAŽÚ** (čl. 17 ods. 3 písm. b), nastaví sa `retention_do = koniec vzťahu + 5 r.`; po vypršaní maže retention cron (`klient_dokumenty.aml_retention_expired`, default DRY-RUN). Audit AML procesu append-only po dobu existencie firmy.
**Právny základ:** čl. 6 ods. 1 písm. c (zákonná povinnosť — zák. 297/2008 Z. z.): **identifikácia klienta § 7, overenie identifikácie § 11, (základná) starostlivosť vo vzťahu ku klientovi § 10, ohlásenie neobvyklej obchodnej operácie § 17 (presné ustanovenie overí právnik), uchovávanie údajov § 20.** Pre rodné číslo § 78 zák. 18/2018 v spojení s AML. Výnimka z práva na výmaz: čl. 17 ods. 3 písm. b. Audit trail: čl. 6 ods. 1 písm. f + accountability (čl. 5 ods. 2).
**Osobitná kategória:**
— **Osobitná kategória (čl. 9): NIE** — na účel identifikácie sa osobitná kategória priamo nespracúva (kópia OP obsahuje podobizeň a podpis, no nejde o spracúvanie biometrie na jedinečnú identifikáciu v zmysle čl. 9).
— **Osobitný identifikátor (§ 78 zák. 18/2018): ÁNO — rodné číslo.** Spolu s kópiou OP ide o **najcitlivejšiu kategóriu v systéme** — režim zaobchádzania najvyššej citlivosti.
**Zdroj údajov:** priamo od dotknutej osoby (predloženie dokladu); pri spoluvlastníkoch/KÚV čiastočne z verejného registra (kataster, OR) — čl. 14.
**(f) Špecifické opatrenia:** `text_content` aj `data_base64` šifrované **AES-256-GCM** (`lib/cryptoDocs.ts`, kľúč `DOC_ENCRYPTION_KEY`, IV per záznam). `/api/klient-dokumenty` po F1 fixe (2026-06-03) vynucuje `requireUser` + scope (`company_id`, vlastník) — pred fixom cross-tenant IDOR na najcitlivejšej tabuľke. **Forenzný audit KAŽDÉHO prístupu k dešifrovaným dokumentom** (`klient_dokumenty.read`, F8 fix) — kto/kedy/IP, pre rozsah pri ohlasovaní porušenia (čl. 33/34). AML gate (`/api/obchody/[id]`): hard blocker (403 + audit) pri nesplnených AML úlohách (§ 10). **🔴 Akákoľvek zmena spracúvania rodného čísla/kópie OP spadá pod červený protokol.** **Medzera:** nezosúladenie AML 5 r. vs dokumenty k nehnuteľnosti 7 r. — overiť u právnika (F6/F14).

---

### Č.20 — Marketingové súhlasy, kampane a prevádzkové notifikácie (consent ledger, e-mail/push, Google integrácie, používateľské účty, audit)
**(a) Účel:** Preukázateľná evidencia udelenia/odvolania marketingového súhlasu (consent ledger); re-permission e-mailová kampaň (consent-refresh) + verejné potvrdenie/odhlásenie cez e-mail link; sprístupnenie dokumentov a komunikácie klienta z Google Drive/Gmail (read-only) a OAuth tokeny maklérov; web push + e-mail + in-app notifikácie maklérom; správa používateľských účtov a pozvánky zamestnancom; audit log a evidencia pokusov o prihlásenie.
**(b) Dotknuté osoby:** klienti (najmä záujemcovia/kupujúci pri marketingu; nepriamo v texte notifikácií) · spoluvlastníci z LV (v dokumentoch na Drive) · protistrany v e-mailovej korešpondencii · **makléri/zamestnanci (users)** · ktokoľvek pri pokuse o prihlásenie.
**Kategórie údajov:**
— *Súhlasy:* účel, verzia textu, stav (granted/withdrawn) + časy, zdroj, **dôkaz (IP, user-agent)**, väzba `klient_id`.
— *Kampaň/link:* meno (oslovenie), e-mail, `klient_id` v HMAC tokene.
— *Google Drive/Gmail:* názvy a obsah súborov (LV, OP, zmluvy — **môžu obsahovať rodné číslo, č. OP, vlastnícke pomery**), metadáta; e-mail odosielateľa, predmet, dátum, snippet.
— *OAuth tokeny:* **šifrovaný** access/refresh token, expirácia, Google e-mail makléra.
— *Notifikácie:* e-mail/meno makléra, push endpoint + kľúče (p256dh, auth), user-agent, preferencie, obsah (môže obsahovať meno klienta/odkaz).
— *Účty:* meno, e-mail/login_email, telefón, rola, **heslo (hash)**, väzby (pobocka_id, makler_id, company_id), invite token + expirácia.
— *Audit/login:* `user_id` aktéra + meno, akcia, entity, IP, user-agent, detail (JSONB), čas; pokusy o prihlásenie (IP, identifikátor, úspešnosť, UA).
**(c) Príjemcovia:** Machovic · Supabase · Vercel · **Resend Inc.** (e-maily: consent-refresh, notifikácie, kolízie, pozvánky) · **Google LLC** (Drive/Gmail/Calendar, vydavateľ OAuth tokenov) · **push služba prehliadača** (Google FCM / Mozilla / Apple).
**(d) Prenos:** súhlasy, OAuth tokeny (úložisko), účty, audit, login attempts — **Supabase EÚ (Frankfurt), bez prenosu.** **Resend Inc. — USA: EU-US DPF.** **Google LLC — USA: EU-US DPF + SCC** (Drive/Gmail/Calendar, výmena tokenov). **Push cez Google FCM — USA: DPF + SCC.**
**(e) Retencia:**
— *Súhlasy/opt-out:* dôkaz o súhlase po dobu možného sporu o oprávnenosti marketingu; **opt-out trvalo/dlhodobo (suppression list)**, aby sa marketing znovu neposlal; väzba sa ruší pri anonymizácii klienta (F11).
— *Kampaň:* odoslaný e-mail sa neuchováva (best-effort); výsledok (počty bez PII) do audit logu.
— *Google Drive/Gmail/Calendar:* CRM dáta neukladá (číta on-demand) — retencia podľa Google účtu makléra. Dokumenty k nehnuteľnosti 7 r. / AML 5 r. (ak by sa stiahli do CRM).
— *OAuth tokeny:* do odpojenia Google účtu (`disconnectGoogle` → NULL) alebo zmazania makléra.
— *Push subscriptions:* do odhlásenia / zmazania makléra (CASCADE) / auto-deaktivácie pri HTTP 410/404.
— *Účty:* po dobu vzťahu; pri mazaní sa FK v faktury/odberatelia nullujú, audit ostáva; heslá ako hash.
— *Audit log:* **append-only po dobu existencie firmy** (nemenný, migr. 080) — nemaže sa.
— *Pokusy o prihlásenie:* krátkodobo (okno rate-limitu ~15 min); vhodné periodické čistenie.
— *In-app notifikácie:* bez explicitnej lehoty (kandidát na doplnenie).
**Právny základ:** súhlas dotknutej osoby (čl. 6 ods. 1 písm. a) pre marketing + jeho odvolanie (čl. 7 ods. 3); ePrivacy (zák. 351/2011 — one-click unsubscribe). Evidencia súhlasov a audit: čl. 7, čl. 5 ods. 2 (accountability), čl. 32 (bezpečnosť), čl. 6 ods. 1 písm. f. Google integrácie, notifikácie, účty, login: čl. 6 ods. 1 písm. f/b (prevádzka CRM, pracovný vzťah, bezpečnosť; LIA pri písm. f podľa časti B). Re-permission oslovenie existujúceho klienta: čl. 6 ods. 1 písm. f / príprava súhlasu písm. a.
**Osobitná kategória:**
— **Osobitná kategória (čl. 9): NIE.**
— **Osobitný identifikátor (§ 78 zák. 18/2018): NEPRIAMO ÁNO — rodné číslo / č. OP** sa môžu vyskytnúť v obsahu Drive/Gmail súborov (LV, OP, zmluvy). Audit log nemá obsahovať osobitné kategórie ani osobitné identifikátory.
**Zdroj údajov:** od subjektu (klik klienta, údaje makléra, prepojenie Google účtu); generované systémom (audit, notifikácie); od adminov (pozvánky, účty).
**(f) Špecifické opatrenia:** verejné consent endpointy autorizované cez HMAC token (`verifyConsentToken`); `consent-refresh` admin-only, default dry-run, max 300 príjemcov; odoslanie e-mailu neresetuje retenciu (zámerne); `notifyManagers` fail-closed na `company_id`; účty — M1 re-auth pri zmene role/hesla; in-app/notifikácie IDOR fix (`?user_id` len super_admin); OAuth tokeny šifrované (`encryptToken`). **Nálezy pre okno Bezpečnosť:** `/api/google/drive`, `/api/google/gmail`, `/api/google/calendar` a `push/subscribe` berú `userId` z query/body bez `requireUser` (IDOR); `email/kolizia` bez auth; **PII v logoch — `auth/google/callback` loguje `google_email`+`userId` cez `console.log`** (→ okno Bezpečnosť na odstránenie + Pravo na posúdenie GDPR dopadu).

---

### Č.21 — Elektronický podpis cez OTP (SMS/e-mail jednorazový kód) — náberový list a objednávka
**(a) Účel:** Diaľkový elektronický podpis náberového listu alebo objednávky kupujúceho: maklér iniciuje podpis, podpisujúcej osobe sa pošle odkaz na verejnú stránku `/podpis/{token}` + jednorazový overovací kód (OTP), osoba kód zadá a dokument podpíše. Slúži ako dôkaz prejavu vôle a úkonu podpisu. *(Konsolidácia — jeden podpisový kanál pre náberový list aj objednávku; tým sa fakticky realizuje skôr sľubovaná konsolidácia „3× podpis → 1".)*
**(b) Dotknuté osoby:** podpisujúci predávajúci (pri náberovom liste) a kupujúci (pri objednávke); maklér iniciujúci podpis.
**Kategórie údajov:** telefón **alebo** e-mail príjemcu podpisu (na doručenie OTP/odkazu) · **hash OTP kódu a hash podpisového tokenu** (SHA-256, nikdy plaintext) · väzba na entitu (`entity_type` naber/objednavka + `entity_id`) · **IP adresa a user-agent z okamihu podpisu** (`signed_ip`, `signed_user_agent`) · časové známky (požiadanie, expirácia, použitie, podpis) · stav a provider doručenia (`sms_status`/`sms_provider`/`sms_error`) · identifikátor makléra, ktorý podpis vyžiadal.
**(c) Príjemcovia:** Machovic · Supabase (`signature_otps`, len service_role) · Vercel · **doručovateľ kódu podľa kanála:** pri SMS **Twilio Inc. (USA)** — *stav: „kód pripravený — NEAKTÍVNY na prode (env nenastavené, overí Bezpecnost)"*; pri e-maile **Resend Inc. (USA)** — *aktívny*.
**(d) Prenos:** Supabase EÚ (úložisko `signature_otps`, bez prenosu). Vercel USA — DPF + SCC. **Twilio Inc. — USA: EU-US DPF/SCC — „kód pripravený — NEAKTÍVNY na prode".** Bez nastavených `TWILIO_*` env premenných `sendSms` vráti „manual" režim (maklér oznámi kód klientovi ručne) a žiadne dáta sa do Twilio neodošlú; **pozor — default kanál podpisu je `sms`**, preto pri budúcom nastavení Twilio env sa telefón príjemcu reálne začne prenášať do USA (vtedy doplniť Twilio do subprocesorov v privacy policy + DPA). **Resend Inc. — USA: EU-US DPF — aktívny** (e-mail s odkazom a OTP).
**(e) Retencia:** záznam OTP/tokenu v `signature_otps` má **TTL 15 minút** (`expires_at`); kód/token sú uložené len ako hash a sú jednorazové (use-once + limit pokusov). Forenzné metadáta podpisu (IP, UA, čas) zostávajú naviazané na podpísanú entitu (náberový list/objednávka) podľa jej retencie (7 r. / do premlčania). Logy doručenia u Twilio/Resend podľa ich politiky.
**Právny základ:** čl. 6 ods. 1 písm. b (vykonanie úkonu podpisu ako súčasť predzmluvného/zmluvného vzťahu); čl. 6 ods. 1 písm. f (preukázateľnosť a integrita podpisu — IP/UA/čas ako dôkaz úkonu; LIA podľa časti B).
**Osobitná kategória:** nie (OTP/token a metadáta podpisu nie sú osobitnou kategóriou ani osobitným identifikátorom).
**Zdroj údajov:** od dotknutej osoby (podpisujúci); telefón/e-mail z karty entity zadaný maklérom; IP/UA zachytené pri podpise.
**(f) Špecifické opatrenia:** OTP aj token hashované (SHA-256); `signature_otps` RLS len service_role; TTL 15 min; jednorazovosť + max počet pokusov; pri zlyhaní doručenia „manual" fallback (kód sa nezobrazí verejne, vráti sa iniciujúcemu maklérovi). **🔴 Zmena kanála/textu podpisu alebo rozsahu metadát podpisu má právny účinok — posúdiť cez červený protokol.**

---

### Č.22 — Evidencia objednávok fotoprodukcie / videa (produkcia_objednavky)
**(a) Účel:** Evidencia produkčných objednávok k nehnuteľnosti predávajúceho klienta (foto-video, homestaging, energetický certifikát) — workflow od konceptu po dodanie; uchovanie snapshotu kontaktných údajov klienta v čase objednávky, aby história objednávky zostala čitateľná aj po anonymizácii klienta.
**(b) Dotknuté osoby:** predávajúci klienti (objednávateľ produkcie) · makléri (zadávateľ objednávky).
**Kategórie údajov:** **snapshot kontaktu klienta v čase objednávky — `snapshot_meno`, `snapshot_telefon`, `snapshot_lokalita`** · väzby `klient_id` a `makler_id` · typ produkcie (foto_video/homestaging/certifikat) · stav workflow · **`details` (JSONB) — môže obsahovať PII: kontakt vlastníka/osoby na mieste (`ownerContact`), meno iného makléra (`otherAgentName`), voľné poznámky (`notes`)** · termíny (plánovaný/odoslaný/dokončený) · odkaz na výstup (`deliverable_url`).
**(c) Príjemcovia:** makléri/manažéri firmy (company scope) · Machovic · Supabase · Vercel · produkčný tím/dodávateľ produkcie (v rámci realizácie objednávky).
**(d) Prenos:** Supabase EÚ; Vercel USA — DPF + SCC.
**(e) Retencia:** naviazané na nehnuteľnosť/klienta a životný cyklus objednávky. **✅ VYRIEŠENÉ (2026-06-07, commit 0c00029):** retenčný cron F11 (`/api/cron/retention-anonymize`) pri anonymizácii klienta **anonymizuje `snapshot_meno`/`snapshot_telefon`/`snapshot_lokalita` aj vynuluje celý `details` (JSONB)**; filter zachytí aj objednávky, kde je PII iba v `details`. PII teda nepretrváva mimo retencie (čl. 5 ods. 1 písm. e). F11 je tým kompletná pre PII (klienti, obhliadky, produkcia_objednavky snapshot+details, kolizny_log; AML doklady mazané po 5 r.).
**Právny základ:** čl. 6 ods. 1 písm. b (objednávka služby ako súčasť plnenia voči predávajúcemu klientovi) + čl. 6 ods. 1 písm. f (interná evidencia objednávok a histórie produkcie; LIA podľa časti B).
**Osobitná kategória:** nie.
**Zdroj údajov:** z karty klienta (snapshot v čase objednávky) + zadané maklérom.
**(f) Špecifické opatrenia:** company scope (`company_id`) + väzba `makler_id`; RLS na `produkcia_objednavky`. **Nález pre okno Klienti & Pipeline:** doplniť snapshot polia do retenčného/anonymizačného cronu (F11).

---

## D. Súhrn

- **Počet konsolidovaných spracovateľských činností:** 22 (z 56 objavených, po zlúčení duplicít; doplnené Č.21 elektronický podpis cez OTP a Č.22 objednávky fotoprodukcie/videa).
- **Činnosti so spracovaním osobitných identifikátorov (rodné číslo, § 78 zák. 18/2018 — NIE osobitná kategória čl. 9):** Č.2 (ak je RČ na LV), Č.13, Č.15, Č.19, Č.20 (nepriamo cez Drive).
- **Činnosti s prenosom mimo EÚ:**
  — *USA (Vercel/Resend/Google/Anthropic/OpenAI):* Č.1, 3, 5–22 (podľa činnosti).
  — *USA — „kód pripravený — NEAKTÍVNY na prode (env nenastavené, overí Bezpecnost)":* **Stripe Inc.** (Č.18) a **Twilio Inc.** (Č.21). Tieto sa reálne neaktivujú, kým nie sú nastavené env premenné; pred aktiváciou doplniť do subprocesorov v privacy policy + DPA. (Twilio pozor: default kanál podpisu = `sms`.)
  — *Veľká Británia — rozhodnutie o primeranosti (UK adequacy):* **OpenStreetMap/Nominatim** (Č.3, Č.8 — geokódovanie len lokality/adresy, bez identity klienta).
  — viď Register DPA.
- **Činnosti so spracovaním údajov tretích osôb mimo klientskeho vzťahu (čl. 14, s povinnou LIA):** Č.2, Č.13, Č.15, Č.16 (najvýznamnejšie Č.16 — scraping).
- **Činnosti bez osobných údajov (mimo vecnej pôsobnosti GDPR, uvedené pre úplnosť):** agregované trhové sentimenty/snapshoty (`market_sentiments`) — neosobné agregáty.
- **Otvorené body na rozhodnutie právnika:** (1) právny základ obhliadkového listu — súhlas vs písm. b/f (Č.14); (2) presné ustanovenie ohlásenia NOO podľa zák. 297/2008 (Č.19); (3) náležitosti podľa zák. č. 170/2024 Z. z. o realitnom sprostredkovaní (časť A, Č.5, Č.13); (4) samostatná príloha LIA pre činnosti s čl. 6 ods. 1 písm. f.

*Tento RoPA sa aktualizuje pri každej zmene spracovateľskej činnosti, pridaní subprocesora alebo zmene zákonných lehôt. Zmeny právneho/compliance baseline podliehajú červenému protokolu so súhlasom konateľa.*