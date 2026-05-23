# Plán: Prístupové práva (read-only pre cudzích klientov)

## Cieľ
Klient/nehnuteľnosť/náber/obhliadka/faktúra ktorá patrí **cudziemu maklérovi** je pre mňa read-only (tlačidlá vidno ale **disabled, sivé**). Výnimky (full access):
- **Admin** (super_admin)
- **Majiteľ** (majitel)
- **Manažér** — má priradené **viaceré pobočky**, full access k záznamom maklérov v ktorejkoľvek z jeho pobočiek

## Čo už máme ✅
1. **Roly** v DB: `super_admin | majitel | manazer | makler` (migrácia 030)
2. **`src/lib/scope.ts`**:
   - `canEditRecord(scope, makler_id)` — admin/majiteľ vždy, vlastník vždy, manažér ak v rovnakej pobočke
   - `getReadFilter(scope)` — vracia zoznam makler_ids pre čítanie
   - `UserScope` typ s `isAdmin`, `isManager`
3. `canEditNaber()` — extra logika pre podpísané nábery (uzamknuté)

## Čo treba spraviť ⏳

### 1. DB — Manažér na viac pobočiek (migrácia 087)
Aktuálne `users.pobocka_id` je single FK. Manažér chce viac pobočiek.

**Nová tabuľka:**
```sql
CREATE TABLE user_pobocky (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  pobocka_id uuid REFERENCES pobocky(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, pobocka_id),
  created_at timestamptz DEFAULT now()
);

-- migrácia existujúcich dát
INSERT INTO user_pobocky(user_id, pobocka_id)
SELECT id, pobocka_id FROM users WHERE pobocka_id IS NOT NULL;

-- users.pobocka_id ponechať (default pre maklérov), manazer ho ignoruje
-- RLS policies pre user_pobocky: čítať môže ten istý user + admin
```

### 2. Backend — `scope.ts` update
- `UserScope`: pridať `pobocka_ids: string[]` (load z `user_pobocky`)
- `canEditRecord`: manazer check zmeniť na `ownerUser.pobocka_id IN scope.pobocka_ids`
- `getReadFilter`: manazer query peers vo všetkých svojich pobočkách

### 3. Frontend foundation
- Nový hook `useUserScope()` v `src/hooks/useUserScope.ts`:
  ```ts
  export function useUserScope() {
    // fetch /api/user-scope → cache
    return { scope, isLoading };
  }
  ```
- Nový API endpoint `GET /api/user-scope`:
  ```ts
  return getUserScope(authedUserId);
  ```
- Pomocný helper `canEditOnFE(scope, record.makler_id)` — synchronná verzia (manažér potrebuje len `scope.pobocka_ids` + map od `makler_id` → `pobocka_id` ktorá sa načíta raz s zoznamom)

### 4. Vyčistiť hardcoded `user?.id === "ales"` — 9 súborov
**Security bug** — všade nahradiť `scope.isAdmin`:
- `src/app/klienti/[id]/page.tsx` (r.412)
- `src/app/klienti/page.tsx`
- `src/app/kupujuci/page.tsx`
- `src/app/portfolio/page.tsx`
- `src/app/nastavenia/faktury/page.tsx`
- `src/app/naber/page.tsx`
- `src/components/Sidebar.tsx`
- `src/lib/userStorage.ts`
- `src/lib/featureToggles.ts`

### 5. Aplikovať disabled-pattern na write tlačidlá
Všade kde sa rendruje write akcia (Upraviť, Zmazať, Stav, Pridať poznámku, Vytvor obhliadku, atď.):
```tsx
const canEdit = useCanEdit(klient.makler_id);
<button disabled={!canEdit} style={{ opacity: canEdit ? 1 : 0.4, cursor: canEdit ? "pointer" : "not-allowed" }}>...</button>
```

### 6. Cross-tenant audit + manuálne testovanie
- Spustiť `./scripts/audit-cross-tenant.sh` — overiť že ani jeden write endpoint nezabúda `canEditRecord`
- Manuálne otestovať 4 roly cez 4 typy záznamov

## Rozsah pravidla
**ÁNO** read-only check pre tieto entity (všetky majú `makler_id`):
- klienti (kupujúci, predávajúci, oboje)
- nehnutelnosti
- náberové listy (`nabery`)
- obhliadky
- faktúry

**NIE** (zdieľané čítanie, write už backend gating má):
- monitor inzeráty (konkurenčná inzercia — všetci čítajú)
- analýzy trhu (read-only pre všetkých)

## Fázovanie (odporúčam tak)
| Fáza | Čo | Čas | Risk |
|------|-----|-----|------|
| **F1** | Migrácia 087 + scope.ts update | 30 min | nízky |
| **F2** | `/api/user-scope` + `useUserScope()` hook | 30 min | nízky |
| **F3** | Migrácia 9 hardcoded "ales" | 1 h | stredný (testovať každý súbor) |
| **F4** | Disabled-pattern na write tlačidlá | 1-2 h | stredný |
| **F5** | Cross-tenant audit + manuál test 4 roly | 30 min | overenie |

## Otvorené otázky
- [ ] **Súčasní manažéri:** Sú nejakí v DB? Ak áno, treba im pridať záznamy do `user_pobocky` ručne (skript v migrácii)?
- [ ] **UI pre admin/majiteľa:** Treba ho pridať na priradenie maklérov k pobočkám (Nastavenia → Pobočky → priradiť maklérov)?
- [ ] **Manažér môže meniť priradenie maklérov k jeho pobočke?** Alebo to robí len admin/majiteľ?

## Mimo scope
- Geo-aware matching → `plan-matching.md`
- Workflow kupujúcich (objednávky, AML) → `plan-kupujuci.md`
