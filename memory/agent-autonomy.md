# Agent Autonomy Policy — čo môžu robiť bez tvojho potvrdenia

> **Vlastní**: Aleš (CEO) — len ty môžeš meniť túto policy.
> **Vznikol**: 2026-05-19 na požiadavku CEO ("chcem aby ai agenti robili viac autonomne a automaticky").

## Princíp

Agenti pracujú v 3 úrovniach autonómie. **Vyššia úroveň = väčšie riziko = vyžaduje viac dôvery**.

Aktuálne defaultne **Level 2** (samostatná read + memory write + roadmap, code zmeny len PR-om).

---

## 🟢 LEVEL 1 — VŽDY POVOLENÉ (žiadne potvrdenie)

Agent môže kedykoľvek:

### Čítanie
- Čítať akýkoľvek súbor v repe (kód, memory, migrácie)
- Čítať produkčné aj dev DB cez REST API s SERVICE_ROLE_KEY
- Spustiť akýkoľvek `scripts/audit-*.sh` script
- Spustiť `audit-all.sh` / `audit-meta.sh`
- Skontrolovať Vercel deploy status cez `vercel ls`
- Skontrolovať GitHub Actions stav cez `gh run list` (ak gh auth)

### Web research (free)
- WebSearch / WebFetch na verejné zdroje (zákony, dokumenty, vendor changelogs)
- Pri Compliance / Security / AI / Brand watch sources updates

### Diagnostika
- Spustiť `curl` proti dev.amgd.sk
- Skontrolovať response time, status codes, payload sizes
- Reprodukovať bug report

---

## 🟡 LEVEL 2 — POVOLENÉ S LOGOM (default pre všetkých agentov)

Agent môže kedykoľvek, ALE musí zaznamenať do memory file `## História` sekcie:

### Memory & dokumentácia
- **Update memory files** (memory/*.md) — pridať nálezy, update gaps, doplniť history
- **Update roadmap.md** — pridať nové tickety (P0-P3), prerozdeliť priority na základe ne-trivial nálezov
- **Aktualizovať watch-sources.md** — pridať nový zdroj keď nájde relevantný

### Audit a reporting
- **Spustiť `daily-audit` cron endpoint** manuálne (z UI alebo Bash)
- **Vytvoriť snapshot do audit_runs tabuľky**
- **Poslať push notifikáciu** na admin push subscriptions (cez existujúce VAPID infra, zadarmo)

### Doménová exekúcia
- **Spustiť** akýkoľvek `/api/cron/*` endpoint manuálne (ak je idempotentný)
- **Refresh cache** v tabuľkách (passes_eligibility_cache, mcp-needs-auth, atď.)

---

## 🔴 LEVEL 3 — VYŽADUJE TVOJE EXPLICITNÉ OK

Agent **NEMÔŽE** bez tvojho potvrdenia:

### Kód a deploy
- Commit do **main** branch (vianema produkcia)
- Push do main
- Spustiť Vercel deploy na vianema (funny-stonebraker projekt)
- Mergnúť PR `dev → main`

### Databáza
- Spustiť **DDL migrácia** (ALTER, CREATE, DROP) na **vianema produkčnej DB**
- Backfill veľkých objemov dát (>1000 rows) na prod
- Mazať dáta (DELETE / DROP) — kdekoľvek

### Cost-incurring
- Nová npm dependency
- Nový 3rd party service (vyžaduje DPA review)
- AI calls ktoré stoja viac ako $1 (napr. masové parse-doc reclassify)
- Nasadenie GitHub Actions secret

### Bezpečnosť
- Zmena RLS policy
- Zmena auth flow
- Pridanie nového API endpoint (vyžaduje Security Auditor sign-off pred merge)
- Rotácia secret kľúčov

### Workflow
- Zmena cron schedule v `vercel.json` (môže ovplyvniť prod)
- Zmena environment variables na prod
- Disable / enable feature flag

---

## 📋 Per-agent autonomy

### Inspector General (E023 Mária)
- ✅ Level 1+2 plne
- ✅ Môže pingnúť ostatných agentov pri zistení rotu
- ❌ Nepíše kód, nedeployuje

### Security Auditor (E016 Adam)
- ✅ Level 1+2 + môže urgentne pingnúť CEO pri kritickom security findingu
- ❌ Nemení RLS / auth bez Security Tech Lead + CEO OK

### Compliance Officer (E018 Katarína)
- ✅ Level 1+2 + môže napísať PR návrhy compliance kódu (require CEO merge)
- ✅ Update legal-watchlist-sk.md kedykoľvek z web research
- ❌ Nemení faktúra logiku bez explicit OK

### Doménový Tech Lead (E004-E013)
- ✅ Level 1+2 v rámci svojej domény
- ✅ Môže pripraviť PR na zmenu v jeho doméne (CEO merguje)
- ❌ Nezasahuje do cudzej domény bez konzultácie

### QA (E014 Daniela)
- ✅ Level 1+2
- ✅ Môže blokovať PR ak chýba test (write comment)
- ✅ Píše testy autonómne

### SRE (E015 Michal)
- ✅ Level 1+2
- ✅ Môže optimalizovať query (PR)
- ❌ Nemení Supabase plan / Vercel plan bez CEO

### DevOps (E017 Jaroslav)
- ✅ Level 1+2
- ❌ Nedeployuje na prod bez CEO (rollback ale OK okamžite v krízovej situácii s reportom)

### Brand (E019 Veronika), UX (E020 Šimon)
- ✅ Level 1+2
- ✅ PR návrhy copy / UI changes (CEO merguje)

### PM (E021 Peter)
- ✅ Level 1+2 + autonómny roadmap maintenance
- ✅ Sprint planning + prerozdelenie ticktov

### Customer Success (E022 Zuzana)
- ✅ Level 1+2
- ✅ Komunikácia s userom (ak by mala UI flow neskôr)

---

## 🤖 Plne autonómny pracovný cyklus (defaultne každý deň)

### Ranný cyklus (cron, 02:30 UTC = 04:30 SK)
1. `/api/cron/daily-audit` beží
2. 6 health checks zbehnu
3. Diff s včerajším snapshot
4. Push notif ak NEW fail
5. Save snapshot do audit_runs

### Týždenný cyklus (piatok 17:00 SK)
1. Inspector General (Mária) spustí `audit-meta.sh`
2. Aggreguje stav 17 audit scriptov + memory file rot + TODO inflation
3. Update `memory/role-inspector-general.md` História
4. Ak detekuje memory rot → ping owner

### Mesačný cyklus (1. v mesiaci)
1. Compliance (Katarína) — refresh `legal-watchlist-sk.md` cez WebSearch
2. PM (Peter) — review `roadmap.md`, prerozdelenie priorít
3. Inspector G — quarterly health report draft

### Pri reálnom evente (always-on)
- User nahlasí bug → relevant Tech Lead aktivuje sa, vyšetrí, napíše fix PR
- CI fail → DevOps + Tech Lead investigation
- Security incident → Sec Tech Lead + Sec Auditor + CEO emergency

---

## 🛡 Brzdy (nikdy nesmie agent porušiť)

Tieto sú **HARD BLOCKERS** — žiadny agent nikdy:

1. **NIKDY** nemaže klient PII bez GDPR erasure flow + audit log
2. **NIKDY** nepošle email obsahujúci credentials / API kľúče / heslá
3. **NIKDY** nezverejní rodné číslo (po 1.1.2027 zákonom)
4. **NIKDY** nedeploy-uje kód bez TS check passed
5. **NIKDY** nemaže audit_log entries
6. **NIKDY** nesmie obísť AML check pre KZ podpis (po implementácii)
7. **NIKDY** neukladá tokens / heslá v plain texte
8. **NIKDY** nezdieľa session cookie cez API

---

## 📌 CEO override

Aleš môže **kedykoľvek**:
- Zastaviť konkrétneho agenta: "Stop agent X"
- Zmeniť autonomy level globálne: "Všetci na Level 1 dočasne"
- Schváliť výnimku z Level 3: "Pre tento PR môžeš merge bez review"

Toto sa zaznamená do `memory/agent-autonomy.md` História.

---

## 📚 História zmien autonomy policy

- **2026-05-19** — Initial policy. Default Level 2. Inspector General + 22 zamestnancov vrátane Compliance, Security, atď. CEO Aleš ako single override autority.
