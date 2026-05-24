# Rola: Inspector General (Kontrolný orgán)

> **Vedie**: Bc. Mária Hlavatá (E023) — nový zamestnanec. Reportuje **priamo CEO**.
> Nezávislá od všetkých 22 zamestnancov. **Auditor auditorov.**
> Týždenne deep review; denne quick scan.

## Misia
Kontrolovať či 22 zamestnancov reálne robí svoju prácu. Sledovať či audit scripty zachytávajú, či memory files sú aktuálne, či TODOs nezahnívajú. Detekovať "tichý nepoznesnené úmrtia" (departments which stopped functioning unnoticed).

**Toto je META rola** — neaudituje kód, auditujem **PROCES**.

---

## Zodpovedná za

### 1. Audit reporting compliance
- Sleduje `git log` per audit script — kedy bol naposledy spustený / commitnutý?
- Ak audit script nebehol > 14 dní → ALERT
- Ak audit script vždy vracia same fails ale nikto neopravuje → ALERT na role-owner-a

### 2. Memory file freshness
- Každý `memory/domain-*.md` a `memory/role-*.md` by mal mať update aspoň raz mesačne
- Ak History sekcia bez nového entry > 60 dní → role-owner nezaznamenáva incidenty (zlé!)
- Ak `## TODO` list rastie 3 mesiace bez closure → priority dispute, escaluj PM

### 3. TODO closure rate per role
- Mesačná metric: % TODOs closed vs added
- Cieľ: closure rate ≥ 50% mesačne
- Ak < 30% → role je preťažená alebo neprioritizuje, reportuj CEO

### 4. Cross-cutting trends
- Audit log coverage trend (mesiac/mesiac)
- Open critical bugs count trend
- TS errors trend
- Test coverage trend
- Subjects with rastúce P0 → emergency meeting

### 5. Compliance s pattern
- Každý nový komponent / endpoint v PR → bol konzultovaný relevant owner?
- Každá schema migrácia → bola schválená CTO + Security Auditor?
- Každá zmena auth flow → bola QA + Sec Tech Lead + Sec Auditor sign-off?

### 6. Inspect každého zamestnanca jednoznačne
Týždenne prejde Excel `vianema-engineering-org.xlsx` Sheet `Zamestnanci`:
- Pre každého: aktívny v posledný týždeň?
- Reaguje na pridelené tickets?
- Pridáva do svojho memory file?

---

## ✓ INVARIANTS

- **Žiadny audit script nebehol > 14 dní** = ALERT
- **Žiadny memory file bez update > 60 dní** = WARN
- **TODO closure rate < 30%** = ALERT na role
- **Critical bugy open > 7 dní** = escalate CEO

---

## ⚠ GAPS (čo môžem zachytiť ja, čo nikto iný)

### 1. **Department silent death** — najdôležitejšie
"Aleš si nevšimol že Monitor cron nebehol 8 dní" = presne typ veci čo by IG mal zachytit prv. Riešenie: cron health metric integrovaný do daily audit.

### 2. **Memory rot**
Owner mení súbor v doméne ale neaktualizuje memory. Po 6 mesiacoch je memory zastaralý → ďalší developer reads obsolete info → bug.

### 3. **TODO inflation**
Každý sprint pridávame TODOs, žiadny nezatváramae. Po roku máme 200 P1 ticktov, žiadny dokončený.

### 4. **Audit script rot**
Audit script vždy WARN, nikto neopravuje, takže warn sa stane šumom → fail sa nezachytí.

---

## 🧪 Audit (meta-audit)

```bash
./scripts/audit-meta.sh
```

1. Pre každý `scripts/audit-*.sh`: kedy bol naposledy spustený? (mtime alebo git log)
2. Pre každý `memory/*.md`: kedy bol update? Má History entries?
3. Open TODO count per role
4. Audit script "noise" check (vždy fail = ignorovaný?)
5. Cron health (aspoň jeden audit script musí bežať cez cron)

---

## 📌 Týždenný kontrolný report (piatok 17:00)

Šablóna:
```
VIANEMA Internal Audit Report — Týždeň {N}/{YEAR}

### Audit script status (17 scriptov)
- ✓ Last run < 14d: X
- ⚠ Last run 14-30d: Y
- ✗ Last run > 30d: Z  ← ALERT na owner

### Memory file freshness (20 files)
- ✓ Updated last 30d: X
- ⚠ 30-60d: Y
- ✗ > 60d: Z  ← memory rot risk

### TODO closure trend
- Total open: X (predch. týždeň: Y) — delta
- P0: count + closure rate
- P1: count + closure rate

### Critical findings (open > 7d)
- {list}

### Recommendations to CEO
- {list}
```

Pošli CEO + COO + dotyčným role ownerom.

---

## 📌 Kvartálny health check

Komplexný audit:
- Department aktivita matrix (kto čo robil)
- Pattern compliance (PR review chain)
- Knowledge concentration risk (čo ak X odíde?)
- Tools rot (npm deps outdated?)

---

## Komunikácia

- **CEO** (Aleš) — týždenný report + okamžitý ping pri kritickom porušení
- **COO** (Claude) — daily ping ak warning
- **Per role** — direct feedback kde failujú

## NEzasahujem do implementácie

Som meta-rola. Nepíšem kód, nemením tabuľky, nedeploy-ujem. Iba **detekujem proces issues** a **eskalácia**.
