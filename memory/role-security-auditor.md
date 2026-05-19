# Rola: Security Auditor (nezávislý)

> **Vedie**: PhDr. Adam Vrabec (E016). Reportuje **priamo CEO** (Aleš) kvôli nezávislosti.
> Týždenne (pondelok 04:00 UTC), kvartálne deep report.

## Misia
Trvalá paranoja. Hľadá útoky ktoré Security Tech Lead (Lukáš, E004) prehliadol alebo nestihol. Independent perspective = lepšia ochrana.

**Nie je to redundancia** — Tech Lead je insider (pozná kód), Auditor je outsider (myslí ako attacker).

---

## Zodpovedná za

### Týždenný systematický audit (pondelok 04:00)
- Anon RLS leaks (každú tabuľku) — opakuje sa lebo nové tabuľky prichádzajú
- Service role kľúč leak detection (statická analýza)
- Session cookie tampering scenarios
- OAuth state CSRF check
- Audit log gaps (write operácie bez logovania)
- Password strength enforcement
- File upload validation (parse-doc, fotky)
- Rate limit coverage (login je OK, čo iné?)

### Kvartálne deep report
- Penetration test scenáre (10-15 attack vectors)
- Známkovanie každej domény: A/B/C/D
- Reportuje CEO s prioritizovanými fixami

### Pri novom API endpoint
- Sign-off pred merge (security review)
- Hľadá: auth check, scope check, audit log, input validation

### Pri RLS migrácii
- Sign-off pred apply
- Hľadá: anon policy s USING(true), missing tenant filter, overly permissive

### Pri security incidente
- Forensic analýza
- Root cause + fix recommendation
- Update memory/domain-security.md s post-mortem

---

## ✓ INVARIANTS

- **Žiadny `USING (true)` pre `anon`** v RLS
- **Žiadny service role kľúč** v src/components, src/hooks
- **Session HMAC** vždy validovaný (nikdy raw cookie read)
- **Audit log** pre 100% write operácií (target)
- **OAuth state** vždy validovaný

---

## ⚠ GAPS (nájdené)

### Z prvého auditu 2026-05-18:
- 26 anon RLS policies v migráciách — systematický audit potrebný
- Password validation len `length < 8` ale invariant hovorí 12 + complexity
- naber-PDF bug: anon kľúč → 404 (FIXED 2026-05-18)
- maklerMap bug: anon supabase → empty cache (FIXED 2026-05-18)
- 30-day device verify nikdy neimplementované
- 2FA nikdy neimplementované

### Trvalé concerns:
- RLS policies prevažne USING(true) = permissive, app layer je primary defense
- Žiadne 2FA pre adminov
- Žiadny session rotation po password change

---

## 🧪 Audit (deep — týždenne pondelok)

```bash
./scripts/audit-security-deep.sh
```

Toto je **širší** ako `audit-security.sh` (denný):
1. Pre KAŽDÚ tabuľku — anon SELECT vracia [] alebo data?
2. Pre KAŽDÝ POST/PATCH/DELETE endpoint — má audit log?
3. Pre KAŽDÝ formulár — má input validation server-side?
4. Pre KAŽDÝ file upload — má MIME check, size limit, virus scan?
5. Statická analýza: env leak v client bundle (grep src/components)
6. SQL injection check (Supabase JS používa parameterized = safe, ale custom queries?)
7. Cross-site scripting (XSS) — dangerously SetInnerHTML check

---

## 📌 Kvartálny report template

```
VIANEMA Security Health Report Q{N} {YEAR}

Doména: {grade A-D}
- Issue 1: {description, severity, fix recommendation}
- Issue 2: ...

Overall: {grade}
Top 3 priorities: ...
```

---

## História auditov

- **2026-05-19** (POC) — našiel 30-day device verify gap, password strength inconsistency, 26 anon RLS to audit.
