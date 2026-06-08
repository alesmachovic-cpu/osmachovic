# Plán: Uzamknutie faktúr (dodavatel_snapshot)

## Problém
`src/app/faktury/[id]/page.tsx` a `src/app/api/faktury/pdf/route.ts` zobrazujú údaje dodávateľa (Vianema) z aktuálnej tabuľky `makler_dodavatel`, nie zo snapshotu na faktúre. Keď maklér zmení v Nastaveniach IBAN / adresu / IČO / IČ DPH → **všetky historické faktúry sa zobrazia s novými údajmi**.

Odberateľ (klient ktorý platí) už správne snapshotovaný v `faktury.odberatel_snapshot`. Dodávateľ chýba — nesymetrické.

## Legal context
- **Zákon 222/2004 (DPH) § 71-76** — vystavená faktúra je nemenný účtovný doklad, údaje platné **k dátumu vystavenia**.
- **Zákon 431/2002 (účtovníctvo)** — účtovný záznam sa neopravuje prepisovaním, len storno + nová.
- Daňová kontrola porovná tvoju kópiu s tou u odberateľa — nezhoda = pokuta + dorovnanie DPH.

## Riešenie

### 1. Migrácia 100 — `faktury.dodavatel_snapshot jsonb`
```sql
ALTER TABLE faktury ADD COLUMN IF NOT EXISTS dodavatel_snapshot jsonb;

-- Backfill: pre existujúce faktúry vezmi aktuálne makler_dodavatel ako "best effort"
UPDATE faktury f
SET dodavatel_snapshot = to_jsonb(md.*) - 'user_id' - 'updated_at' - 'created_at'
FROM makler_dodavatel md
WHERE md.user_id::text = f.user_id
  AND f.dodavatel_snapshot IS NULL;
```
Nemá `NOT NULL` constraint — staré faktúry bez settings budú NULL → fallback na live lookup.

### 2. POST `/api/faktury` — uložiť snapshot pri vytvorení
- Načítaj `makler_dodavatel` pre `faktura.user_id`
- Zapíš do `dodavatel_snapshot` payloadu
- Bezpečné aj keď chýba — uloží sa `null` a fallback rieši zobrazenie.

### 3. Detail page (`/faktury/[id]/page.tsx`)
- Preferuj `f.dodavatel_snapshot` ak existuje
- Fallback: `fetchDodavatel(user.id)` pre legacy faktúry (po backfille by nemali byť žiadne, ale pre istotu)

### 4. PDF route (`/api/faktury/pdf`)
- Preferuj `f.dodavatel_snapshot`
- Fallback na `makler_dodavatel` query (legacy)

## Mimo scope
- **PATCH guard proti zmene sensitive polí** (`cislo_faktury`, `datum_vystavenia`, `suma_celkom`, `dodavatel_snapshot`, `odberatel_snapshot`, `polozky`) — to je manuálna zmena, nie "samá od seba". Rieši sa samostatne ak treba. PATCH zatiaľ legitímne mení len `zaplatene` flag a poznámku.
- **Položky faktúry** — `faktura_polozky` rieši samostatný insert (uložené v DB), nie z live settings. Nemá tento problém.
- **DPH suma** — už uložená ako field `faktury.dph` a `suma_celkom`, nie recomputed z `firma_info`. OK.

## Test plán
1. Pred zmenou: vytvor faktúru. Otvor v Nastaveniach a zmeň IBAN. Vráť sa na detail faktúry → IBAN sa zmenil ❌
2. Po zmene: znova zmeň IBAN v nastaveniach. Otvor existujúcu faktúru → IBAN ostal pôvodný ✅. Vytvor novú → má nový IBAN ✅.
3. PDF — to isté pre staré aj novú.
