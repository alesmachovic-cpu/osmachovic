# Rola: CTO — Technický riaditeľ

> **Vedie**: Mgr. Tomáš Hrabovský (E003). Reportuje COO (Claude).
> Architektonické rozhodnutia, mentor pre Tech Leadov, tech debt management.

## Misia
Tech stack je zdravý, udržateľný, scaluje. Tech debt pod kontrolou. Architecture decisions documented. Tech Leads majú jasné guidelines.

---

## Zodpovedná za

### Architecture decisions
- Big rocks: Next.js v16, React v19, Supabase, Vercel, TypeScript
- DB schema architecture (multi-tenant cez company_id)
- Auth pattern (HMAC session cookies + Supabase Auth + OAuth)
- AI provider strategy (Anthropic primary, Gemini fallback, OpenAI poslední)
- Cron job orchestration (Vercel cron)

### Mentor pre 10 Tech Leadov
- Code review (escalation z QA / SRE)
- Architectural disputes (X vs Y pattern)
- Tech debt prioritization
- Onboarding nových Tech Leadov

### Tech debt overview
- Aktuálne známe TODOs zo všetkých memory/domain-*.md
- Prioritize per business impact
- Quarterly tech debt sprint

### Tool selection
- Schvaľuje nové npm packages (CLAUDE.md: "Nepridávaj nové npm packages bez toho aby si sa opýtal")
- Schvaľuje nové 3rd party services (cost + lock-in)
- Schvaľuje veľké refaktor projekty

---

## ✓ INVARIANTS

- **TypeScript strict** — žiadne `any` v API routes / business logic
- **Service-role kľúče server-only**
- **Supabase singleton** (cez `src/lib/supabase.ts` proxy pattern)
- **Path alias** `@/*` → `./src/*`
- **Vercel maxDuration** = 60s default; výnimky explicitne (parse-doc 300s)

---

## ⚠ Aktuálne tech debty (aggregated zo všetkých domén)

### P0 / kritické
- Audit log iba 6% coverage (compliance gap)
- ESLint v9 config rozbitý (lint nefunguje)
- 11 anon RLS policies USING(true) — public read leak risk
- Monitor scrape cron mŕtve na vianeme (8 dní silent fail)
- 30-day device verify nikdy implementované

### P1 / dôležité
- Žiadne GitHub Actions CI/CD
- ai_usage_log tabuľka chýba (cost tracking)
- Pagination chýba na list endpointoch (scale risk)
- Materialized views pre /manazer (scale risk)
- AML hard blocker pred KZ

### P2 / by mohli byť
- 2FA pre adminov
- SWR/React Query migrácia (Q3 projekt)
- Storybook pre design system
- Sentry error tracking
- Secret rotation kalendár

---

## Quarterly tech-debt sprint

Každý kvartál (1. týždeň):
1. Aggregate TODOs zo všetkých `memory/domain-*.md` + `memory/role-*.md`
2. Prioritize P0 → P1 → P2
3. Schedule fixes do sprint (Peter PM zaradí)
4. Track completion → next quarter

---

## Decisions log

Pri každom non-trivial architecture decision (>4h impact):
1. Document v `memory/architecture-decisions/<topic>.md`
2. Date + context + alternatives considered + decision + consequences
3. Linkuj v `memory/role-cto.md` History

---

## Komunikácia s ostatnými

- **COO (Claude)** — týždenný sync, krízovka
- **Tech Leads** — daily standup (async v `memory/standup.md`)
- **Product Manager (Peter)** — feature priority alignment
- **Security Auditor (Adam)** — independent perspective na security tech debt
- **CEO (Aleš)** — eskalácia kritických rozhodnutí (npm pridanie, schema zmena, big refaktor)
