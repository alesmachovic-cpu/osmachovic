# Vianema · weby maklérov

Samostatná aplikácia: osobné weby maklérov (každý na vlastnej doméne), správa
webu s prihlásením a formulár na ocenenie, ktorý posiela dopyty maklérovi.
Nemá žiadnu väzbu na CRM.

## Ako to funguje

- **Každý maklér má vlastnú doménu** (napr. `silviahurova.sk`). Koreň domény
  zobrazí jeho publikovaný web. Bez domény web beží na `/s/<adresa>`.
- **Správa webu** je na `/admin` na každej doméne. Maklér sa prihlási svojím
  e‑mailom a heslom a vidí iba svoj web a svoje dopyty.
- **Správca** (rola `admin`) vidí všetky weby, spravuje používateľov, domény,
  poradie tímu a spoločné texty pobočky.
- **Publikovanie**: úpravy sa ukladajú automaticky ako rozpracovaná verzia,
  verejnosť vidí až po kliknutí na *Publikovať*.

## Nasadenie (Vercel + Supabase)

1. **Supabase**: vytvor projekt, v SQL editore spusti `supabase/schema.sql`
   a potom `supabase/seed.sql` (7 webov a účty maklérov, stav zo 17. 9. 2026).
   Prvý správca: `machovic@vianema.eu`, heslo `ZmenMaHned2026` — po prvom
   prihlásení zmeň v sekcii *Moje heslo*. Rovnaké počiatočné heslo majú
   makléri; nastav im vlastné v sekcii *Používatelia*.
2. **Vercel**: nový projekt z tohto priečinka (`weby/` ako Root Directory).
   Env premenné podľa `.env.example` (`SUPABASE_SERVICE_ROLE_KEY`,
   `SESSION_SECRET`, voliteľne `RESEND_API_KEY`).
3. **Domény**: v Settings → Domains pridaj hlavnú doménu (napr.
   `weby.vianema.eu`) a doménu každého makléra. V admine pri webe vyplň
   *Vlastná doména* — od tej chvíle koreň domény zobrazuje jeho web.

## Vývoj

```bash
npm install
cp .env.example .env.local   # doplň hodnoty
npm run dev                  # http://localhost:3000/admin
```

Seed sa generuje z `src/lib/defaults.ts`:
`node --experimental-strip-types src/lib/seed-sql.mts > supabase/seed.sql`

## Štruktúra

- `src/app/page.tsx` — koreň domény (web makléra podľa domény, inak presmeruje do adminu)
- `src/app/s/[slug]` — web na záložnej adrese, `src/app/nahlad/[id]` — náhľad draftu (iframe v admine)
- `src/app/admin` — správa webov, `src/app/login` — prihlásenie
- `src/app/api/*` — auth, weby, publikovanie, nastavenia, upload, dopyty, používatelia
- `src/components/SiteView.tsx` — šablóny (maklér / manažér), `LeadForm.tsx` — formulár
- `src/lib/types.ts`, `defaults.ts`, `styles.ts`, `db.ts`, `auth.ts`, `session.ts`
