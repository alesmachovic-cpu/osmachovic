# Parse regression harness (F2 — AI parsovanie dokumentov)

Spustiteľný regresný + benchmark test pre parsovanie dokumentov cez Claude.
Rieši: gold-standard očakávaný výstup, regresia pri každej zmene, P50/P95 latencia.

## Spustenie

```bash
node tools/parse-regression/run.mjs                  # proti dev.amgd.sk
RUNS=3 node tools/parse-regression/run.mjs           # 3 behy/fixtúra (latencia)
BASE_URL=http://localhost:3000 node ...run.mjs       # proti lokálu
ACCURACY_MIN=0.9 LATENCY_P95_MAX_MS=50000 node ...    # prísnejšie prahy
```

Exit 0 = PASS, exit 1 = niektorá fixtúra pod prahom presnosti alebo p95 nad limit.
**Spúšťaj pred každým merge-om ktorý sa dotýka parse-* alebo AI promptu.**

## Pridanie fixtúry (gold standard)

Do `fixtures/` daj dvojicu súborov s rovnakým menom:

1. **`<name>.expected.json`** — polia ktoré MUSIA vyjsť + ich očakávané hodnoty.
   Číselné polia majú 2 % toleranciu; texty sa porovnávajú voľne (case/diakritika).
   `majitelia` je pole — kontroluje sa meno + dátum narodenia každého vlastníka.

2. Zdroj dokumentu — jedno z:
   - **`<name>.pdf`** — reálny dokument (⭐ najmä skenované LV — to je skutočný OCR test).
     Použi ANONYMIZOVANÉ dáta alebo si over že fixtúry nejdú do verejného repa.
   - **`<name>.source.txt`** — text, ktorý harness vyrenderuje do PDF (rýchla syntetická fixtúra).

### Odporúčaná sada fixtúr (cieľ 8–10)
- `lv-digital-*` — LV stiahnuté z katastra (textové PDF)
- `lv-sken-*` — odfotené/naskenované LV ⭐ (najdôležitejšie)
- `posudok-*` — znalecký posudok
- `zmluva-*` — kúpna / rezervačná zmluva
- `docx-*` — Word dokument (iný flow — extrakcia textom)
- `multi-owner-*` — viacero spoluvlastníkov
- `edge-prazdne` — nečitateľné PDF (očakávaný výstup = chyba, nie polia)

## .docx / multipart mód (#7)

`.docx` ide iným flow ako PDF (extrakcia textu cez mammoth → Claude) a cez
endpoint `/api/parse-doc`, ktorý **vyžaduje prihlásenie**. Pre docx fixtúru pridaj:

- `<name>.docx` — reálny Word dokument
- `<name>.expected.json` — gold standard
- `<name>.meta.json` — `{ "mode": "multipart", "endpoint": "/api/parse-doc" }`

A spusti s auth cookie:
```bash
AUTH_COOKIE='crm_session=...' node tools/parse-regression/run.mjs
```
(cookie získaš z DevTools → Network → hlavička `Cookie` po prihlásení)

## Request-level security test (F1 / #5)

Izolácia medzi firmami (maklér firmy B nesmie vidieť dokumenty klienta firmy A)
sa testuje samostatným skriptom: `tools/security/klient-dokumenty-authz.mjs`.
Pozri jeho hlavičku — potrebuje 2 cookies (2 firmy) + klientId firmy A.

## Pozn. k bezpečnosti fixtúr
Fixtúry s reálnymi PII (skeny OP/LV) **nepatria do gitu**. Drž ich lokálne alebo
v privátnom úložisku; do repa commituj len `.source.txt` syntetické a `.expected.json`.
