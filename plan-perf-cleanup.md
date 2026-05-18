# Plán: Performance & Stability Cleanup (dev)

**Cieľ**: Opraviť všetky zistené problémy z network monitoringu a doladiť systém na "Mac úroveň" — clean kód, žiadne band-aidy, predvídateľný výkon pri 50 maklérov × 30 inzerátov + tisíce klientov/obhliadok.

**Rozsah**: Všetka práca **iba na dev branch** v `os-machovic-test`. Vianema (kód aj DB) zostáva nedotknutá. Po overení na dev.amgd.sk pripravím PR `dev → main` na schválenie.

**Princípy** (CLAUDE.md):
- Hľadáme root cause, nie záplaty
- Pred zmenou prečítam existujúci kód
- Po každej zmene `npm run lint` + manuálny test
- Žiadna migrácia bez výslovného OK

---

## Fáza 1 — Kritické fixy (P0)

### 1.1 Migrácia: `naberove_listy.makler_id` + composite indexy
**Súbor**: nová migrácia `supabase/migrations/064_naberove_makler_id_and_indexes.sql`

```sql
ALTER TABLE naberove_listy ADD COLUMN makler_id uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE naberove_listy nl
SET makler_id = k.makler_id
FROM klienti k
WHERE k.id = nl.klient_id AND k.makler_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_naberove_listy_company_makler_created
  ON naberove_listy(company_id, makler_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_naberove_listy_company_klient
  ON naberove_listy(company_id, klient_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_obhliadky_company_datum
  ON obhliadky(company_id, datum DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_klienti_company_makler
  ON klienti(company_id, makler_id);
```

**Overenie**: REST query `naberove_listy?select=id,makler_id&makler_id=eq.<UUID>` vráti 200.

**Reverzibilita**: down migration `DROP COLUMN makler_id`, `DROP INDEX ...`. Žiadne dáta sa nestratia (zdroj zostáva v `klienti`).

### 1.2 Code fix: `/api/nabery` route
**Súbor**: `src/app/api/nabery/route.ts`

- POST handler (riadok 72-77): pridaj `makler_id: ownerMakler` do payloadu — nové nábery budú mať stĺpec naplnený od začiatku
- Bonus: `dnes=1` timezone fix — `new Date().toISOString().slice(0,10)` vracia UTC; použijem `Europe/Bratislava`

**Overenie**: 
- `curl /api/nabery?mine=1` → 200 + JSON pole
- `curl /api/nabery?dnes=1&mine=1` → 200 + dnešné záznamy v SK time
- POST vytvorí náber, GET ho nájde s `mine=1`

### 1.3 Diagnostika 503 na `/portfolio`, `/operativa`, `/manazer`, `/klienti?tab=predavajuci`
Pre každú stránku prečítam `page.tsx` + API ktoré volá, reprodukujem cez curl proti dev DB, identifikujem typ chyby (render error / API timeout / cold start / chýbajúce env).

### 1.4 Cleanup duplicit
`find . -name "* 2.*" -not -path "./node_modules/*" -not -path "./.git/*"` → ručne overím a zmažem.

**Commit Fáza 1**: `fix(api): nabery 500 + dashboard 503 + composite indexes`

---

## Fáza 2 — Bandwidth wins (P0)

### 2.1 SELECT * audit a fix na `/api/obhliadky`
- `grep -rn "obhliadk" src/components src/app --include="*.tsx"` → zoznam použitých fields
- Zmena `.select("*")` → `.select("id, datum, klient_id, nehnutelnost_id, stav, poznamka, created_at")` (presný zoznam po audite)
- **NE-mažem** stĺpce `parametre`, `podpis_data` — len ich nevraciam v list endpointe. Detail endpoint ich naďalej vráti.

**Overenie**: Network tab → `/api/obhliadky` má < 20KB. Dashboard sa renderuje rovnako, žiadne `undefined` errors.

### 2.2 Rovnaký audit na `/api/nehnutelnosti` a `/api/klienti`

**Commit Fáza 2**: `perf(api): drop SELECT *, return only fields UI uses`

---

## Fáza 3 — Pagination (P1)

### 3.1 Helper `src/lib/paginate.ts`
Parse `?limit`, `?offset`, default 50, max 200.

### 3.2 Aplikácia na 3 najväčšie endpointy
`/api/nabery`, `/api/obhliadky`, `/api/klienti` — vrátia `{ data, total, has_more }`.

### 3.3 UI refaktor
"Načítať ďalších 50" alebo virtuálny scroll. **Pýtam sa pred**: ktorý pattern?

**Commit Fáza 3**: `feat(api+ui): server-side pagination for list endpoints`

---

## Fáza 4 — Duplikované requesty + Google 401 (P1)

### 4.1 Deduplication hook (najmenej invazívne — nie SWR refaktor)
- `src/hooks/useDedupedFetch.ts` — singleton cache 1-2 sek pre rovnaké URL+params
- Migrácia useEffect-ov v Dashboard komponentoch

**Overenie**: každý endpoint volaný max raz pri load dashboardu.

### 4.2 Google 401 fix
- Prečítam `/api/obhliadky/auto-detect` a `/api/google/calendar`
- Diagnostika: expired token / chýbajúci refresh / scopes / auth header
- Ak refresh logic problém → fixnem
- Ak Google nepripojený → 412 + UI "Pripojiť Google" tlačidlo

**Pýtam sa pred**: ak treba reconnect flow, postavím alebo nechám manuál?

**Commit Fáza 4**: `fix(google): handle expired tokens + dedupe parallel API calls`

---

## Fáza 5 — Prefetch fine-tuning (P2)

- `grep -rn "<Link" src/components/Sidebar.tsx src/components/Navbar.tsx src/components/BottomTabs.tsx`
- `prefetch={false}` na Linkoch mimo hot path (admin, archív, štatistiky)
- Ponechám prefetch=true len pre top 3 (dashboard, klienti, nehnuteľnosti)

**Overenie**: Network tab pri load dashboardu má max 3-4 prefetch RSC requesty.

**Commit Fáza 5**: `perf(navigation): selective prefetch`

---

## OUT OF SCOPE (samostatné projekty)

- **SWR/React Query migrácia** — Q3 projekt. Fáza 4.1 (deduped fetch) rieši 80% lacnejšie.
- **RLS sprísnenie** (`USING (true)` → ozajstné policies) — security audit projekt.
- **Schema cleanup** starých stĺpcov — riziko zhodiť prod kód.

---

## Časový odhad

| Fáza | Náročnosť | Čas mňa | Tvoj review |
|---|---|---|---|
| 1 | Stredná | 1.5 h | 15 min |
| 2 | Nízka | 1 h | 10 min |
| 3 | Vyššia | 2-3 h | 30 min |
| 4.1 | Stredná | 1 h | 10 min |
| 4.2 | Variabilná | 0.5-2 h | 15 min |
| 5 | Nízka | 0.5 h | 5 min |

**Celkom**: 6-9 h práce, ~1.5 h review (rozdelené do 5 commitov/PRov).

---

## Verifikácia pred merge do main

1. Všetkých 6 pôvodných problémov vyriešených (curl + UI test)
2. `npm run lint` zelený
3. `npm run build` prejde bez warningov
4. Manuálne preklikať dev.amgd.sk: dashboard, klienti, portfolio, nehnuteľnosti, obhliadky, manazer
5. Network tab: load dashboardu < 500KB total (pred fixom ~2MB)
6. Žiadne 500/503 v Vercel logs po 30 min beh
7. Tvoje OK na merge

---

## Status

- [x] Plán schválený userom
- [x] Fáza 1: 1.1 migrácia 070 (commit `34a1977`, applied dev DB, 35/47 rows backfilled)
- [x] Fáza 1: 1.2 /api/nabery code fix (POST píše makler_id, dnes=1 timezone fix)
- [x] Fáza 1: 1.3 503 diagnostika — auto-vyriešilo sa Fázou 1.1/1.2 (manazer/portfolio/operativa všetky 200)
- [~] Fáza 1: 1.4 cleanup — dev worktree čistý, duplicit len v main repo (mimo scope)
- [x] Fáza 2: 2.1 obhliadky SELECT (commit `c389469`) + nový detail endpoint `/api/obhliadky/[id]`
- [x] Fáza 2: 2.2 nabery SELECT (commit `c389469`)
- [ ] Fáza 3: 3.1 pagination helper
- [ ] Fáza 3: 3.2 aplikácia
- [ ] Fáza 3: 3.3 UI refaktor — **čaká rozhodnutie: tlačidlo / virtuálny scroll?**
- [ ] Fáza 4: 4.1 dedupe hook
- [ ] Fáza 4: 4.2 Google 401 fix — **čaká rozhodnutie: auto-reconnect alebo manuál?**
- [ ] Fáza 5: prefetch tuning
- [ ] PR `dev → main` pripravený

### Merané dopady (po deployi)
- /api/nabery: 1.75 MB → cieľ ~50 KB (97% drop)
- /api/obhliadky: 177 KB → cieľ ~15 KB (91% drop)
- Detail page obhliadky: prestane sťahovať celý list pri otvorení (z O(N) na O(1))
