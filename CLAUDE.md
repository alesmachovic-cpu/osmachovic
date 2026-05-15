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

## Workflow — DÔLEŽITÉ
1. **Pri každej netriviálnej úlohe (3+ kroky) najprv vytvor plán** v `plan.md`.
2. Pred kódom prečítaj existujúci kód, aby si pochopil kontext.
3. Po napísaní kódu vždy spusti dev server alebo testy (`npm run lint`) a over že to funguje.
4. Nikdy neoznač úlohu ako hotovú bez verifikácie.

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

## Self-improvement loop
Po každej oprave alebo nedorozumení sa ma opýtaj: **"Mám to pridať do CLAUDE.md?"**
Tento súbor je živý dokument — má sa zlepšovať každým týždňom.
