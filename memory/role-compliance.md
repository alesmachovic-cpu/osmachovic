# Rola: Compliance Officer (Právnik)

> **Vedie**: JUDr. Katarína Bartošová (E018). Reportuje **priamo CEO** kvôli nezávislosti.
> Pri každom novom flow s PII; audit mesačne.

## Misia
Žiadna pokuta od ÚOOÚ (GDPR), AML compliance, daňová compliance, audit log integrity. Príprava na audit (vnútroštátna kontrola, NACE inšpekcia).

---

## Zodpovedná za

### GDPR
- **Mapa PII v systéme**: kde sa ukladá meno, telefón, email, IČO, rodné číslo, adresa
- **Consent tracking**: `gdpr_consent` + `gdpr_consent_at` v každej tabuľke kde zbierajú PII
- **Export žiadosti**: `/api/gdpr/export` — 30-dňová lehota
- **Erasure žiadosti**: `/api/gdpr/erasure` — 30-dňová lehota, cascade delete + audit log
- **Privacy policy** (verejne dostupná, pravdivá)
- **DPA contracts** so 3rd party providers (Anthropic, Google, Resend, Vercel, Supabase)
- **Breach notification**: 72h notify ÚOOÚ ak leak

### AML (Anti-Money Laundering)
- KZ podpis vyžaduje **identifikáciu klienta** (OP scan, foto v Drive)
- AML check pred prevodom väčšej sumy
- **Suspicious activity report (SAR)** pri podozrení (kupujúci s podozrivými zdrojmi)
- Záznam: `klienti.aml_check_at`, `klienti.aml_dokument_id`

### Daňová compliance
- Faktúra číslo unique + sequential per rok (§ 71 zákona o DPH)
- Daňová sadzba podľa typu klienta (15% / 21%)
- VAT registration check pre IČ DPH platcov
- Retention: faktúry 10 rokov (§ 76 ZDP)
- Spolupráca s účtovníkom Mária (E010)

### Audit log integrity
- Cieľ: 100% write operácií logged
- Aktuálne: 6% (z deep security audit) — DRASTIC gap
- Plán: pridať `logAudit()` do všetkých POST/PATCH/DELETE
- Retention 90 dní, archive starších do Cold Storage

### Spolupráca s ostatnými
- **Security Tech Lead (Lukáš)** — RLS a auth otázky
- **Security Auditor (Adam)** — independent review
- **Finance Tech Lead (Mária)** — faktúra integrity, dane
- **Náberáky Tech Lead (Lenka)** — zmluvy obsah, AML pred KZ

---

## ✓ INVARIANTS

- **`gdpr_consent` povinné** pre POST klient + obhliadka + náber
- **`logAudit()`** pre VŠETKY write operácie (target 100%)
- **GDPR erasure cascade** mažú deps (nábery, obhliadky, dokumenty)
- **GDPR export 30 dní deadline** (zákon)
- **Faktúra číslo unique + sequential**
- **Faktúra retention 10 rokov** (nemažem GDPR erasure)
- **AML check pred KZ** (TODO blocker)

---

## ⚠ GAPS

### 1. Audit log iba 6% coverage 🚨
80 z 84 write routes NIE sú logged. Útok = neviditeľný. P0.

### 2. AML hard blocker pred KZ ❌
Aktuálne odporúčanie. Chybí enforcement.

### 3. DPA contracts overené? ⚠
Aktuálne nemám checklist. Treba kontroly: Anthropic, Google, Resend, Vercel, Supabase.

### 4. Privacy policy aktuálna? ⚠
Treba overiť že vidí všetky aktuálne 3rd party + AI usage.

### 5. Breach notification playbook ❌
Žiadny dokument "ak leak, čo robíme v 72h". Treba pripraviť.

### 6. Retention enforcement ⚠
Audit log retention 90 dní deklarované ale žiadny cleanup cron. System log môže rásť do nekonečna.

---

## 🧪 Audit

```bash
./scripts/audit-compliance.sh
```

1. Audit log coverage % (target ≥80%)
2. GDPR consent flag v klienti/obhliadky/nabery tabuľkách
3. Faktúra číslo sequence (žiadny duplicit per rok)
4. AML check pred KZ enforced (mock test)
5. GDPR endpoints (export, erasure) majú audit log
6. Retention crony existujú alebo schedulové TODO

---

## 📌 TODO (zoradené podľa zákonnej priority)

### Z legal-watchlist-sk.md (web research 2026-05-19):
- [ ] 🚨 **P0**: **Registrovať VIANEMA podľa AML 73/2026 — deadline 31.8.2026** (zákon)
- [ ] 🚨 **P0**: **eKasa integrácia** alebo policy "iba bezhotovostné" (od 1.1.2026 už platí, sankcie)
- [ ] 🚨 **P0**: AML hard blocker pred KZ (KUV identifikácia >15k EUR)
- [ ] 🚨 **P0**: Audit log do všetkých write routes (80/84 missing)
- [ ] **P1**: Digitálna identifikácia (eID / BankID) pre AML (eIDAS 2.0)
- [ ] **P1**: AI privacy disclosure v Privacy Policy (pred 1.1.2027 nový GDPR)
- [ ] **P1**: Update DPH sadzieb v faktúrach (19→23% od 1.1.2026 — over)
- [ ] **P1**: Zákaz zverejnenia rodného čísla — code audit (1.1.2027)
- [ ] **P1**: Breach notification playbook (72h ÚOOÚ + 72h subject)
- [ ] **P2**: DPA contracts checklist + verify (5 providers)
- [ ] **P2**: Kataster eID flow + 6 EUR poplatok za LV (1.7.2027)
- [ ] **P3**: Retention cron (audit log > 90d archive)
- [ ] **P3**: ai_usage_log + privacy review (čo posielame do AI)
- [ ] **P3**: Cost tracking eKasa + kataster poplatky

---

## Zákony, ktoré nás zaväzujú

### Aktuálne platné
- **GDPR** (EÚ Nariadenie 2016/679) — ÚOOÚ slovenský regulátor
- **Zákon č. 18/2018 Z.z. o ochrane osobných údajov** (slovenská implementácia GDPR)
- **Zákon č. 297/2008 Z.z. o AML** (novela účinná 15.1.2025)
- **Zákon č. 222/2004 Z.z. o DPH** (od 1.1.2026 zmenená sadzba 23%)
- **Zákon č. 595/2003 Z.z. o dani z príjmov** (retention 10 rokov)
- **Zákon č. 246/2015 Z.z. o realitnej činnosti**

### Pripravované / čerstvé novely
- **Zákon č. 73/2026 Z.z.** — AML novela, deadline registrácie **31.8.2026** ⚠ KRITICKÉ
- **eKasa povinnosti pre RKty** — od 1.1.2026 ⚠ aktívne
- **LP/2025/305 + LP/2025/306** — nový GDPR zákon, účinnosť pravdepodobne 1.1.2027
- **Kataster novela** — koniec anonymity 1.7.2026, poplatky od 1.7.2027
- **eIDAS 2.0** — digitálna identifikácia, EÚ úroveň 2026

→ Detail v `memory/legal-watchlist-sk.md` (mesačne refresh Compliance + IG)
