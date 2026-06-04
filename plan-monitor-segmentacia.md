# Plán: Monitor — čisté delenie (segmentácia), ukladať všetko

Cieľ (Aleš): **ukladať VŠETKY inzeráty pre analýzu**, ale **jasne rozdelené** v 3 osiach.
Nič nezahadzovať — len presne štítkovať. Pracujeme na `dev`.

## 3 osi štítkov (na každom inzeráte)
1. **ponuka_typ**: `predaj` | `prenajom`
2. **predajca_typ**: `sukromny` | `firma` (RK) | `null` (nejasné)
3. **typ**: `byt` | `dom` | `pozemok` | `iny`

## Čo je dnes rozbité (na ukladaní)
- **Prenájmy sa ZAHADZUJÚ** (`matchesFilter` vyhodí čokoľvek s „prenájom") → 0 dát na analýzu prenájmov.
- **RK sa ZAHADZUJE** pri filtroch s `len_sukromni=true` → chýba na cenovú analýzu.
- Falošné RK text-signály (P1) → zlé predajca_typ štítky.
- Analytika (market_sentiments) by po uložení prenájmov **miešala nájomné s predajnými cenami** → musí segmentovať.

## Kroky (po schválení)
1. **Migrácia**: `ALTER TABLE monitor_inzeraty ADD COLUMN ponuka_typ text DEFAULT 'predaj'` + index. (ADD COLUMN — nedeštruktívne, žiadne PII.)
2. **types.ts**: `ScrapedInzerat.ponuka_typ?: 'predaj'|'prenajom'`.
3. **Parsery**: spoľahlivo nastaviť ponuka_typ (z URL/slugu/textu). Pri prenájom-detekcii NEvyhadzovať, ale otagovať.
4. **scrape route**:
   - `matchesFilter`: prestať dropovať prenájmy — namiesto toho nastaviť ponuka_typ.
   - Prestať dropovať RK — ukladať všetko. `len_sukromni` ostane len pre **notifikácie** (RK nenotifikovať), NIE pre ukladanie.
   - buildUpsertRow: pridať ponuka_typ.
5. **classifier.ts (P1)**: vyhodiť „na predaj/predaj" z RK prefixov; „kontaktujte ma"/„ponúkam" presunúť na súkromníka. → čistejšie predajca_typ.
6. **monitor-daily analytika**: segmentovať podľa ponuka_typ (predajné a nájomné ceny NEMIEŠAŤ). market_sentiments kľúč rozšíriť o ponuka_typ alebo filtrovať predaj.
7. **monitor UI**: filter predaj/prenájom + badge; štítky 3 osí viditeľné.

## Otvorené rozhodnutia (pre Aleša)
- **A) Aktívne scrapovať aj prenájmy?** Aby `ponuka_typ=prenajom` mal reálne dáta, scraper musí ťahať aj `/prenajom/` stránky (nový rozmer filtra), nie len čakať na „leaky" z predaj-listov. Inak prenájmov bude takmer 0.
- **B) Ukladať aj RK + developerov** (viac riadkov, ~2–4× objem) — pre cenovú analýzu áno.

## Mimo scope
- P2 (hash telefónu pre „opakovaný inzerent") — GDPR, červený protokol, zvlášť.
- ScrapingBee 401 (3 portály) — zvlášť.
