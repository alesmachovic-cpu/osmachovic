# os-machovic — Pravidlá projektu

## Čo je tento projekt
**os-machovic** je realitné CRM pre slovenskú realitnú kanceláriu **Vianema**. Pokrýva celý životný cyklus realitnej činnosti:

- **Klienti** — predávajúci, kupujúci, záujemcovia, AML/KYC, história interakcií
- **Nehnuteľnosti** — portfólio, náberové listy, inzeráty (Bazos/Reality), kalkulátor a matching
- **Obchody** — ÚZ/RZ/KZ, vklad do katastra, podpisy u notára, integrácia s bankami
- **Obhliadky** — plánovanie, prepojenie s Google Calendar, kolízie
- **Provízie a faktúry** — výpočet, vystavenie, evidencia, dohoda s maklérmi
- **Monitor a analýza** — sledovanie konkurenčnej inzercie, segmentácia trhu, AI analýza okolia nehnuteľnosti
- **AI nástroje** — copywriter pre Property Stories, fill formulárov, parse znaleckých posudkov a listov vlastníctva (LV)
- **Google integrácia** — Drive (dokumenty klientov), Gmail (komunikácia), Calendar (termíny)
- **Operatíva** — produkcia tímu, vyťaženosť, štatistiky, push notifikácie

Produkcia: **https://vianema.amgd.sk**
Test/staging: **https://dev.amgd.sk**

## Jazyk a štýl komunikácie
- **Komunikuj so mnou v slovenčine.**
- Buď stručný, konkrétny, bez zbytočných úvodov.
- Keď niečo neviem alebo si neistý, povedz to priamo. Žiadne "isto budeš zvládať".
- Som realitný maklér, nie programátor — vysvetľuj rozhodnutia rečou ktorá dáva zmysel realiťákovi.

## 🧠 Buď kritický — nie áno-pán
- **Žiadne automatické áno.** Pri každom mojom zadaní aj pri každom svojom riešení sa najprv spýtaj: aký je skutočný cieľ za zadaním (čo tým naozaj chcem dosiahnuť), nie len doslovné znenie.
- Keď vidíš slabinu, riziko alebo jednoduchšiu/lepšiu cestu — **povedz to priamo PRED implementáciou** a navrhni alternatívu. Platí to rovnako na tvoje vlastné návrhy: over, že riešia reálny cieľ.
- Cieľ je **najlepší výsledok, nie odpor zo zásady.** Tam, kde je zadanie zjavne správne, nehľadaj problém umelo — kritickosť má slúžiť výsledku, nie kontrariánstvu.

## 🔒 ZLATÉ PRAVIDLO: Bezpečnosť 100%, vždy, bez výnimky

**Bezpečnostný baseline NESMIE klesnúť ani o jeden bod, ani na minútu.** Nie len pri security-súvisiacich commitoch — pri **každom** commite, **každej** zmene, **každej** novej feature. UI refactor, drobný fix, kozmetika — všetko prechádza tým istým gate-om.

**Konkrétne to znamená:**
- `./scripts/audit-all.sh` pred **každým** push-om (nie len pred merge-om).
- Ak audit ukáže nový `✗` ktorý nie je v baseline → **commit/push sa NEUSKUTOČNÍ**. Stash zmeny, oprav root cause, audit znova, až potom push.
- Nikdy nepoužívať `--no-verify`, `--no-gpg-sign`, `git commit --amend` na obídenie hooku alebo audit-u — ani keď je neskoro v noci, ani keď je to "len kozmetika".
- Nikdy si nepovedz "tento failed audit je pre-existing, takže môj nový tiež môže projsť". Pre-existing fails sú TODO ktoré budeme riešiť, **nové fails sú zákaz commitu**.
- Tri known gaps (HSTS, dev password protect, CSP nonce) sú evidované, ale **nepribúdajú** ďalšie gaps — to je pevný limit.
- Pri novej API route / DB migrácii / session emitteri: vyžadované checks z "Security Regression Guardian Mode" sekcie sú **nezjednateľné**, nie nice-to-have.

**Prečo:** Vianema má reálnych klientov, reálne osobné údaje (AML/KYC, OP, listy vlastníctva), reálne peniaze (provízie, faktúry). Jeden security breach = okamžitý koniec firmy + GDPR pokuty + osobná zodpovednosť Aleša ako CEO. Žiadna feature, žiadna deadline, žiadny "rýchly fix" toto neprebije.

## 🔴 ZAMRZNUTÝ BASELINE: Bezpečnosť + Právo/Compliance (platí na `dev` aj `main`)

**Pri KAŽDEJ zmene — aj na `dev` branchi — sa nesmie nepozorovane oslabiť ani zmeniť dvojica: (a) bezpečnostné nastavenie, (b) právne / compliance nastavenie.** `dev` nie je "ihrisko kde sa to nemusí riešiť" — všetko čo na `dev` vznikne smeruje do produkcie, takže ten istý gate platí od prvého commitu.

### Čo je chránený PRÁVNY / COMPLIANCE baseline (popri security baseline)
Toto sa nesmie zmeniť bez výslovného súhlasu Aleša:
- **GDPR** — súhlasy (cookie consent, marketing), právo na výmaz, retention/lehoty uchovávania, export osobných údajov, audit trail prístupov k PII.
- **AML/KYC** — povinné kontroly, evidencia, lehoty, identifikácia klienta.
- **Faktúry — zákonné náležitosti** — IČO/DIČ/IČ DPH, číslovanie radov, dátumy (vystavenie/dodanie/splatnosť), DPH sadzby a výpočet, dodávateľ snapshot (nemennosť faktúry po vystavení), integrita/append-only.
- **Provízie a daňové polia** — výpočtové pravidlá ktoré majú daňový/účtovný dopad.
- **Texty s právnym účinkom** — zmluvy (ÚZ/RZ/KZ/ZZ), súhlasy, poučenia, podpisové doložky, znenie e-mailov s právnym obsahom.

### 🔴 ČERVENÉ UPOZORNENIE — povinný protokol
Ak akákoľvek zmena (vrátane "len UI", "len refactor", "len kozmetika") **vyžaduje alebo spôsobí** zmenu security alebo právneho/compliance baseline:

1. **ZASTAV. Nerob commit, nepokračuj v kóde.**
2. Vypíš Alešovi na začiatok odpovede tento presný banner (aby bol nemožné prehliadnuť):

   ```
   🔴🔴🔴 POZOR — ZMENA BEZPEČNOSTI / PRÁVA 🔴🔴🔴
   ```
   Pod ním v **tučnom** texte: čoho sa zmena týka (security / GDPR / AML / faktúra / zmluva …), **čo presne sa mení**, **prečo to inak nejde**, a **aké je riziko** (pokuta, leak, neplatná faktúra, neplatná zmluva).
3. **Počkaj na výslovné „áno, zmeň to"** od Aleša. Ticho ≠ súhlas.
4. Až po súhlase pokračuj — a zmenu zapíš do commit message + (ak je trvalá) do tohto CLAUDE.md.

**Nikdy** túto zmenu neschovaj do väčšieho diffu, neoznač ako „drobnosť", ani neprejdi ďalej s predpokladom že to bude OK. Realiťák Aleš nemusí v kóde vidieť že sa práve mení niečo právne — preto je červené upozornenie jeho jediná poistka.

> Bezpečnostná časť tohto baseline je detailne rozpísaná nižšie v sekciách „🔒 ZLATÉ PRAVIDLO", „🛡️ API Security Rules" a „🛡️ Security Regression Guardian Mode". Tento blok ich **rozširuje o právnu/compliance vrstvu a o povinné červené upozornenie** — neruší ich.

## Workflow — DÔLEŽITÉ
1. **Pri každej netriviálnej úlohe (3+ kroky) najprv vytvor plán** v `plan.md`.
2. Pred kódom prečítaj existujúci kód, aby si pochopil kontext.
3. Po napísaní kódu vždy spusti dev server alebo testy (`npm run lint`) a over že to funguje.
4. **Supabase migrácie aplikuj VŽDY AUTOMATICKY do test DB** cez `supabase db query --linked --file supabase/migrations/XXX_*.sql` — neopytuj sa, nečakaj na pokyn. Ja som realitný maklér nie SQL admin.
5. **Pred KAŽDÝM mojím turn-om** — `scripts/tg-inbox.sh` ako prvý Bash call. Ak inbox nie je prázdny, najprv odpovedz, potom pokračuj.
6. **Auth zmeny VŽDY** spusti `./scripts/audit-auth-paths.sh` PRED commitom. Lesson z 2026-05-20: 2FA bypass cez Google OAuth + invite/accept ktoré CEO sám našiel. Každý súbor čo vystavuje session musí mať 2FA gate alebo explicit allowlist.
7. **Ja nemám kontrolovať každú blbosť cez oddelenia** — mám firmu s departments práve preto. Ak nájdem chybu ktorú malo zachytiť Security Auditor / Compliance / QA, **najprv oprav koreňovú príčinu** (proces / regression check / pravidlo do role súboru), potom oprav sám bug. Nikdy nie len bug bez procesnej zmeny.
8. **Pred KAŽDÝM commitom** — spusti `./scripts/audit-all.sh` pre regression check 9 oblastí:
   - audit-cross-tenant (multi-tenant scope)
   - audit-write-audit-log (forenzný trail)
   - audit-anon-rls (RLS policies)
   - audit-upload-guards (file upload DoS)
   - audit-pii-logs (sensitive data v console)
   - audit-ts-any (TypeScript any types)
   - audit-rate-limit (auth brute force)
   - audit-secrets-in-code (leaked credentials)
   - audit-auth-paths (2FA gate na session emitteroch)
   Ak akýkoľvek `✗`, **NEROBí commit** — najprv oprav alebo pridaj do allowlist s odôvodnením. Žiadne "tváriť že robíme".
9. **NIKDY alias-swap** medzi Vercel preview a production deployment cez API. Lekcia z 20.5.2026: prepol som `vianema.amgd.sk` na preview deployment ktorý nemal `NEXT_PUBLIC_*` env vars (per-environment) → klient JS dostal undefined → 1h výpadok. Pre PROD deploy do `funny-stonebraker` projektu: VŽDY `vercel deploy --prod` (target=production) z fresh clone main, NIKDY alias swap.
10. Nikdy neoznač úlohu ako hotovú bez verifikácie.

## 🪟 Viac okien naraz — disciplína (DÔLEŽITÉ, číta KAŽDÉ okno)

Aleš pracuje s **viacerými Claude oknami súčasne**, každé na inej doméne (kupujúci / analyza / právo / security / …). **Všetky zdieľajú ten istý adresár a git repo** (`/Users/alesmachovic/Code/os-machovic`, branch `dev`). Necommitnuté zmeny aj commity sa preto medzi oknami miešajú. Aby sa **žiadne okno nepomýlilo**:

1. **Svoj scope ber z chatu, NIE z pamäte.** Memory je zdieľaná; záznam „toto okno = X" napísalo INÉ okno o sebe — nevzťahuj ho na seba. Keď nevieš svoj scope, spýtaj sa Aleša.
2. **Rob len vo svojej doméne. Keď nájdeš niečo mimo svojej kompetencie** (napr. security, právo, iná doména), **NEopravuj to tu** — namiesto toho:
   - **(a) upozorni Aleša** na nález: čo to je, prečo je to dôležité, aké je riziko (pri security/práve použi 🔴 banner podľa protokolu nižšie);
   - **(b) priprav hotový copy-paste prompt pre správne okno** — sebestačný, s presnými súbormi/riadkami a už overenými faktami, nech cieľové okno nezačína od nuly.
3. **Commituj LEN svoje konkrétne súbory** — `git add cesta/k/suboru`, **NIKDY `git add -A` ani `git add .`**. Inak zahrnieš rozrobenú prácu iného okna.
4. **Pred commitom vždy `git status`** a over, že stage-uješ len svoje. Vo working tree môžu byť `M`/`??` súbory iných okien — **nedotýkaj sa ich**, nestage-uj ich, nevracaj späť.
5. **Po `git push` over `git log origin/dev`**, že tvoj commit tam reálne je. „Everything up-to-date" často znamená, že iné okno už pushlo (a odnieslo aj tvoj commit) — nie že push zlyhal.
6. **Baseline/audit porovnania**: stashuj LEN svoj súbor (`git stash push <file>`), nie celý working tree — inak do baseline zamiešaš cudzie zmeny.
7. **NIKDY `git checkout`/`switch` na iný branch** — prepol by si súbory pod rukami ostatným oknám. Všetci sme na `dev`.

> Reálny incident 2026-06-06: počas práce na kupujúci (commit 9e9aeaa) iné okno pushlo `13f27ab` (analyza) a odnieslo aj môj commit. Nič sa nerozbilo len preto, že commit bol čistý (`git add` len 1 súbor). Tieto pravidlá to robia spoľahlivým, nie šťastím.

## 🗂️ Register okien / kompetencie (jediný zdroj pravdy)

**Toto je záväzná mapa „kto vlastní čo". Spravuje ju KOORDINAČNÉ okno (MD). Každé okno si na štarte nájde svoj riadok a drží sa svojich ciest.** Keď nájdeš chybu mimo svojho riadku → neopravuj, upozorni Aleša + priprav prompt pre správne okno (pozri „🪟 Viac okien naraz").

| Okno | Doména | Vlastní (kľúčové cesty) | NErobí → odovzdáva |
|---|---|---|---|
| **Koordinácia (MD)** | Kompetencie, onboarding okien, register | `CLAUDE.md` (sekcia Register), prekryvy hraníc | Nepíše doménový kód — pripraví prompt domén. oknu |
| **Klienti & Pipeline** | Klienti, kupujúci, voľní, obchody/pipeline | `app/klienti`, `app/kupujuci`, `app/volni-klienti`, `api/klienti*`, `api/klient-dokumenty`, `api/klient-udalosti`, `api/objednavky`, `api/obchody`, `lib/scope.ts`, `lib/maklerMap.ts` | Parse dokumentov → Náberáky; GDPR/AML texty → Compliance |
| **Nehnuteľnosti & Portfólio** | Portfólio, inzeráty, matching, kalkulačka | `app/nehnutelnosti`, `app/portfolio`, `app/matching`, `app/inzerat`, `app/kalkulator`, `api/nehnutelnosti`, `api/inzerat`, `api/matching`, `api/fotky`, `api/pricing` | Property Story copy → AI |
| **Náberáky, Zmluvy & Dokumenty** | Nábery, zmluvy, podpis, parse LV/posudkov | `app/naber`, `app/podpis`, `api/nabery`, `api/naber-pdf`, `api/naber-analyza`, `api/parse-doc`, `api/parse-pdf`, `api/parse-lv`, `api/vyhradna-zmluva`, `api/sign`, `api/objednavka-pdf`, `NaberyForm`, `VyhradnaZmluvaModal` | AI model vrstva → AI; právny text zmlúv → Compliance |
| **Obhliadky & Kalendár** | Obhliadky, kolízie, kalendár | `app/kalendar`, `app/kolize`, `api/obhliadky`, `api/kolize`, `api/calendar`, `api/calendar-sync`, `useKoliziaCheck` | OAuth/token vrstva Google → Google; podpisová komponenta → Náberáky |
| **Financie** | Faktúry, provízie, náklady, odberatelia | `app/faktury`, `app/provizie-maklerov`, `app/uctovny-prehlad`, `app/prehlad-financii`, `app/pravidelne-naklady`, `app/naklady`, `app/odberatelia`, `app/potvrdenie-provizii`, `api/faktury`, `api/maklerske-provizie`, `api/makler-provizie-pct`, `api/odberatelia`, `api/dodavatel`, `api/billing`, `api/firma-info`, `api/ico-lookup` | Zákonné náležitosti faktúr/DPH → Compliance (🔴 protokol) |
| **Monitor & Analýza** | Scraping konkurencie, AI analýza okolia/trhu | `app/monitor`, `app/analyzy`, `api/monitor`, `api/analyze`, `api/analyze-url`, `api/analyze-pdf`, `api/analyzy-trhu`, `api/okolie-analysis`, `api/market-sentiments`, `cron/scrape`, `lib/monitor` | AI model vrstva → AI |
| **AI nástroje** | Copywriter, fill, generate, property story | `app/ai-writer`, `app/nastroje`, `api/ai-writer`, `api/ai-analyze`, `api/ai-fill`, `api/generate`, `api/property-story`, `lib/ai` | Parse routes (parse-doc/lv) → Náberáky |
| **Google integrácia** | Drive, Gmail, OAuth, token/connect | `app/gmail`, `app/disk`, `api/google`, `api/auth/google`, `api/email`, `lib/google.ts`, `useGoogleConnected` | Calendar business logika → Obhliadky |
| **Operatíva & Manažér** | Dashboard, push, úlohy, štatistiky, tím | `app/manazer`, `app/operativa`, `app/notifikacie`, `app/upozornenia`, `app/log`, `app/ulohy`, `app/statistiky`, `app/vytazenost`, `app/tim`, `app/produkcia`, `api/manazer`, `api/push`, `api/notifications`, `api/ulohy`, `api/logy`, `api/makleri`, `api/pobocky`, `api/dashboard`, `api/prehlad` | — |
| **Security & Auth** | Auth, session, RLS, audit, users | `app/auth`, `app/pridat-heslo`, `app/reset-password`, `app/registracia`, `app/admin`, `api/auth`, `api/users`, `api/user-scope`, `api/audit`, `api/admin`, `middleware.ts`, `lib/auth`, `lib/audit`, RLS migrácie | — (cross-cutting, 🔴 protokol) |
| **GDPR / Compliance / Právo** | Súhlasy, výmaz, AML, zákonné náležitosti | `app/(legal)`, `app/gdpr`, `app/klientska-zona`, `app/odklik`, `api/gdpr`, `api/consents`, `api/consent-confirm`, `api/consent-refresh`, `api/consent-unsubscribe` + právne náležitosti faktúr/zmlúv/AML | — (cross-cutting, 🔴 protokol) |

**Vyriešené prekryvy (kanonický vlastník):**
- **Podpis** (`app/podpis`, `api/sign`) = **Náberáky** vlastní podpisovú primitívu; Obhliadky ju len volajú pre protokoly.
- **Calendar**: **Obhliadky** vlastnia business logiku (`api/calendar`, `api/calendar-sync`); **Google** vlastní OAuth/token vrstvu (`lib/google.ts`, `api/auth/google`).
- **Parse-doc/lv/pdf** = **Náberáky** vlastnia parse endpointy; **AI** vlastní len model/prompt vrstvu (`lib/ai`), ktorú parse volá.
- **Obchody** (`api/obchody`) = **Klienti & Pipeline** (stav obchodu od ÚZ po vklad); zmluvné dokumenty k obchodu → **Náberáky**.
- **Zdieľané utility** (`api/locale`, `api/weather`, `api/ulica-search`, `api/api-status`, `app/nastavenia`): meniť len po dohode; default správca = Operatíva.

## Tri hlavné princípy (Boris Cherny)
1. **Jednoduchosť** — minimálny kód. Ak vieš niečo zmazať namiesto pridať, sprav to.
2. **Žiadne band-aidy** — hľadaj koreňovú príčinu, nie rýchle záplaty.
3. **Žiadne vedľajšie účinky** — meň len to čo treba. Nepridávaj nové bugy pri opravovaní starých.

## Tech stack
- **Framework:** Next.js 16.1.7 (App Router) + React 19.2.3 + TypeScript 5
- **DB:** Supabase (PostgreSQL) — `@supabase/supabase-js`
- **Styling:** Tailwind CSS 4
- **AI:** Anthropic Claude SDK (`@anthropic-ai/sdk`), Google Gemini (REST), OpenAI GPT-4o (fallback)
- **Google APIs:** Drive, Gmail, Calendar (OAuth)
- **Auth:** HMAC session cookies + Supabase Auth + Google OAuth
- **Email:** Resend
- **PDF/DOCX:** `pdf-parse`, `pdfjs-dist`, `mammoth`, `jspdf`
- **Push notifikácie:** `web-push`
- **DnD:** `@dnd-kit/core`, `react-grid-layout`
- **Hosting:** Vercel (Hobby plan — `maxDuration: 60s`, výnimka `parse-doc: 300s`)
- **Testing:** Vitest (zatiaľ minimálne pokrytie)

## Príkazy
```bash
npm run dev      # dev server na http://localhost:3000
npm run build    # produkčný build
npm run lint     # ESLint
npm run test     # Vitest
```

## Štruktúra projektu
- `src/app/` — Next.js App Router stránky a API routes
- `src/app/api/` — backend (AI, Google, parse-doc, faktúry, monitor, atď.)
- `src/components/` — zdieľané React komponenty (formy, modaly, Sidebar/Navbar/BottomTabs)
- `src/lib/` — utility (Supabase singleton, Google helpers, auth, domain logika)
- `src/hooks/` — React hooks (`useKoliziaCheck`, `useMatching`)
- `supabase/migrations/` — SQL migrácie schémy

## Doménový slovník (Slovak → English)
| Slovak | English / význam |
|---|---|
| klient | client (predávajúci, kupujúci, záujemca) |
| nehnuteľnosť | property |
| náberový list / nábery | acquisition document |
| inzerát | listing/ad (Bazos, Reality, …) |
| obhliadka | viewing/showing |
| obchod | transaction / deal (od ÚZ po vklad) |
| ÚZ | úschovná zmluva |
| RZ | rezervačná zmluva |
| KZ | kúpna zmluva |
| ZZ | záložná zmluva |
| LV | list vlastníctva |
| znalecký posudok | property appraisal |
| provízia | commission |
| faktúra | invoice |
| maklér | real estate agent / broker |
| odberateľ | subscriber (príjemca faktúry) |
| AML | anti-money laundering check |
| OP | občiansky preukaz |
| kataster | cadaster |

## Konvencie kódu
- TypeScript: preferuj `type` pred `interface`. Nikdy `enum` — radšej string literal unions.
- Žiadne `any` typy v API routes ani v doménovej logike.
- API routes vždy s error handling + správny HTTP status.
- Supabase: vždy importuj zo singletonu `src/lib/supabase.ts` (proxy pattern). Nikdy neinštancuj `createClient()` priamo.
- Server-only kľúče (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, …) **nikdy do klienta**.
- TypeScript path alias `@/*` → `./src/*`.

## Štýl UI
- **Apple-style.** Čisté biele karty na pozadí `#F5F5F7`, jemné tiene, žiadne zbytočnosti.
- **Slovenčina v UI.** Všetky labely v slovenčine (zámerne — pre slovenského makléra).
- **Mobile-first** kde to dáva zmysel. Komponenty `BottomTabs` (mobil) + `Sidebar` (desktop).
- **Dark mode** podporovaný cez CSS premenné v `globals.css`.

## AI a copywriter — pravidlá pre Property Stories
Toto sa vzťahuje **iba** na generovanie inzerátov / property story copy (`ai-writer`, `PropertyStoryModal`), nie na ostatné AI funkcie (parse, fill, analyze).

- **Žiadne klišé.** Zakázané: "exclusive opportunity", "dream home", "must see", "jedinečná príležitosť", "vysnívaný domov".
- **Pravidlo troch.** Presne 3 unique selling points. Nie 2, nie 5.
- **Neviditeľná technológia.** Nepopisuj features, popisuj pocit. Nie "south-facing windows" — "natural light that follows your morning coffee".
- **Data-driven.** Použi market sentiment dáta na zdôvodnenie ceny.

### Output format pre Property Story (striktne)
- **[The Hook]** — 1 veta, hlavička zachytávajúca esenciu
- **[The Lifestyle]** — 3 krátke odstavce
- **[The Investment Logic]** — 1 veta o tom prečo má kúpa zmysel dnes
- **[Social Snippet]** — 2-vetová verzia pre IG/WhatsApp

## ENV premenné
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-only
ANTHROPIC_API_KEY
GEMINI_API_KEY
OPENAI_API_KEY                   # fallback pre parse-doc/parse-pdf
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
RESEND_API_KEY
MANAGER_EMAIL
SESSION_SECRET                   # HMAC kľúč pre crm_session cookie
VAPID_PUBLIC_KEY                 # web-push
VAPID_PRIVATE_KEY                # web-push
```

## Obmedzenia ktoré treba rešpektovať
- **Vercel Hobby `maxDuration`** = 60s pre väčšinu routes. Výnimka: `parse-doc/route.ts` má 300s. PDF musia byť **rasterizované client-side** pred uploadom aby sa stihla spracovať.
- **Supabase Free tier** — 500 MB DB, 5 GB bandwidth. Fotky sa do DB neukladajú, ale do Google Drive.
- **Google APIs quoty** — pri masovom posielaní mailov / vytváraní eventov sleduj kvótu.
- **RLS** — všetky tabuľky musia mať policies pre `authenticated` rolu (nie len `anon`). Pri novej tabuľke vždy doplň policies.

## Čo NIKDY nerob
- Nemeň schému databázy bez výslovného potvrdenia.
- Nepridávaj nové npm packages bez toho aby si sa opýtal.
- Negeneruj copy s emoji pokiaľ to nie je výslovne pre social media snippet.
- Nepúšťaj testy ktoré niečo posielajú von (mail, push notifikácie, AI volania platené) bez potvrdenia.
- Nevypisuj sensitive údaje (API keys, tokens, session secret) do logov ani do error response.
- Žiadne commity priamo do `main` bez prečítania diffu — preferuj feature branch alebo worktree.

## 🛡️ API Security Rules (mandatórne — automaticky vynucované cez CI)

**Po dvojkolovom security audite 24.5.+2.6.2026 (P0 leaks na 11+ endpointoch) platia:**

### Pravidlo 1: Každý nový `src/app/api/**/route.ts` handler MUSÍ volať `requireUser(req)` ako prvý krok

```ts
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  // ... zvyšok handlera
  const scope = await getUserScope(auth.user.id);
  const companyId = scope.company_id;  // ✓ správne — z verifikovanej session
}
```

### Pravidlo 2: NIKDY nepoužívaj VIANEMA_COMPANY_ID ako fallback

**❌ Zakázaný pattern (toto bol P0 bug):**
```ts
const sessionUserId = readSessionUserId(req);
let companyId = VIANEMA_COMPANY_ID;        // ← bez session → leak všetkých dát
if (sessionUserId) { ... }
```

Bez session → fallback servíruje VŠETKY záznamy firmy komukoľvek. **CI fail.**

### Pravidlo 3: Verejný endpoint? Musí byť v PUBLIC_WHITELIST

Ak je nový endpoint zámerne verejný (auth login, webhook, cron) → pridaj cestu do `scripts/check-api-auth.mjs` `PUBLIC_WHITELIST` + komentár prečo. Inak CI fail.

### Pravidlo 4: 11 sensitive routes je TIER 1 protected

Tieto routes boli ručne fix-nuté po audite a sú watchované:
`/api/klienti`, `/api/nehnutelnosti`, `/api/faktury`, `/api/dashboard`, `/api/obhliadky`, `/api/nabery`, `/api/klienti/counts`, `/api/audit`, `/api/ulohy`, `/api/klient-dokumenty`, `/api/obchody`.

**Odstránenie `requireUser()` z ktoréhokoľvek z nich = CI hard fail.**

### Local check pred push

```bash
node scripts/check-api-auth.mjs
```

Beží automaticky v CI cez `.github/workflows/security.yml` → job `api-auth-guard`.

## Lessons learned (2026-05-21)
- **URL generátory:** Nikdy nepoužívaj `process.env.VERCEL_ENV === "production"` na rozhodnutie medzi `vianema.amgd.sk` vs `dev.amgd.sk`. Dev je samostatný Vercel projekt (`vianema-dev`) deployovaný ako `target=production` → `VERCEL_ENV === "production"` je `true` aj na dev. Vždy použi `request.headers.get("host")` + `x-forwarded-proto`. Whitelist hostov rieši `middleware.ts` (`ALLOWED_HOSTS`).
- **PATCH endpointy s M1 re-auth gate:** Backend kontroluje `"role" in updates` (alebo iné sensitive pole) → spúšťa `requireReAuth`. Frontend MUSÍ posielať len **reálne zmenené polia**. Ak posielaš nezmenený `role` v body, spustí sa false-positive re-auth alert. Pattern: zostav `payload` postupne a sensitive polia pridávaj iba pri ich reálnej zmene.

## Lessons learned (2026-05-23)
- **Vercel auto-deploy z `dev` branch FUNGUJE** (pôvodne som si myslel že je rozbitý — bola to moja chyba pozorovania). Production Branch v Vercel je nastavený na `dev`, GitHub webhook beží, každý `git push` automaticky spustí deploy (source: "git"). **NIKDY nerob `vercel deploy --prod --yes` po pushe** — to robí 2× deploy (jeden git, jeden cli) a vyčerpá 100/day limit free tier. Sám push stačí. Ako overiť: `curl api.vercel.com/v6/deployments` cez Vercel API token → `source: "git"` = auto-deploy beží.

## Lessons learned (2026-05-22)
- **Pracovný adresár NIE je Desktop.** Aktívny projekt žije v `/Users/alesmachovic/Code/os-machovic` (mimo iCloud). `~/Desktop/os-machovic` je dnes **živý symlink** na `Code/os-machovic` (nie samostatná kópia) — je jedno cez ktorú cestu vojdeš, je to ten istý repo. Adresár `/Users/alesmachovic/os-machovic` je marcový boilerplate (11-bajtový CLAUDE.md, prázdne `src/`) — **NIE** je to projekt, nezamieňať. Po reset session: `cd /Users/alesmachovic/Code/os-machovic`, prečítaj `CLAUDE.md`, `ls plan*.md`, `git status`, `git log -5 --oneline` — neopytuj sa "kde je projekt".
- **Plány rozdeľuj podľa domény, nie chronologicky.** Keď sa rieši viac súvisiacich vecí naraz (matching + kupujúci), maj **samostatný `plan-<doména>.md`** pre každú. `plan.md` je len pre aktuálny bug sweep. Zachová to fokus pri resetoch — pri otázke "kde sme skončili" stačí otvoriť relevantný plan-*.md a pokračovať. Spájať sa to dá až keď je každá doména hotová.
- **Audit fails ≠ blocked commit ak sú pre-existing.** CLAUDE.md pravidlo 8 ("ak akýkoľvek ✗, NEROBí commit") platí len pre **regression**. Pred commitom: stash zmeny → spusti `audit-all.sh` na čistom stave (baseline) → unstash → spusti znova → porovnaj počty failov. Ak nepribudol nový fail, commit je OK. Vždy uveď baseline vs current počty fail-ov v commit message.

## 🔒 Security Regression Guardian Mode (active od 2026-05-21)

CEO (Aleš) sa sústredí na nové features. Existujúci security baseline (**8/10 B+** podľa Opus 4.7 auditu, viď `security-audit/security-comparison-2026-05-21.jpg`) **NESMIE regresnúť** pri novom vývoji.

**Pri každej zmene v repo (mandatórne):**

1. **Ak meníš čokoľvek v `src/lib/auth/`, `src/middleware.ts`, `src/app/api/auth/`, `src/lib/audit.ts`, alebo `supabase/migrations/`:**
   - PRED commitom spusti `./scripts/audit-security.sh`
   - Porovnaj výsledok s `security-audit/baseline-2026-05-21.txt`
   - Akákoľvek nová `WARN` alebo `FAIL` = neposúvaj merge. Upozorni CEO + spýtaj sa.

2. **Pri akejkoľvek novej API route (POST/PATCH/DELETE):**
   - MUSÍ mať `requireUser()` guard
   - MUSÍ mať `logAudit()` call po úspešnej write operácii
   - MUSÍ filtrovať podľa `company_id` (multi-tenancy)
   - Sensitive akcia (privilege change, password reset, GDPR, status zmena, mazanie) → MUSÍ mať `requireReAuth()` gate
   - Žiadny `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SESSION_SECRET` v `src/components/**` alebo `src/hooks/**`

3. **Pri novej DB migrácii:**
   - Žiadny `USING (true) FOR anon` (public read leak)
   - Tabuľka so sensitive dátami → RLS policies pre `authenticated` rolu
   - Nemen audit_log triggers (block_audit_mutations) — append-only invariant

4. **Pri akejkoľvek zmene v session emitteroch** (`grep -rln "buildSessionCookieValue"`):
   - MUSÍ mať 2FA gate (`totp_enabled_at` check + `requires_2fa` branch)
   - Spusti `./scripts/audit-auth-paths.sh` PRED commitom

**3 known gaps (NETLAČIŤ aktívne, len evidovať):** HSTS, dev.amgd.sk password protect, CSP nonce. Plán v `security-audit/PROMPT-fix-missing-security.md`. Toto sú feature requests do `Active Hunting Mode`, nie regression.

**Aktivácia späť do Active Hunting:** CEO musí explicitne povedať *"prepnime sa do active security work"*.

## Self-improvement loop
Po každej oprave alebo nedorozumení sa ma opýtaj: **"Mám to pridať do CLAUDE.md?"**
Tento súbor je živý dokument — má sa zlepšovať každým týždňom.
