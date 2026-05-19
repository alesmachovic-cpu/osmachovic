# Master Roadmap — VIANEMA Engineering

> **Vlastní**: Ing. Peter Halás (E021) — Product Manager. Aktualizácia týždenne.
> Toto je **master backlog**. Aggregated z všetkých `memory/domain-*.md` a `memory/role-*.md`.
> CEO (Aleš) signs-off pre P0 / nové epicy.

---

## 🔴 P0 — Critical (must-fix v najbližšom sprinte)

Tieto bugy blokujú produkčný workflow alebo majú právne implikácie.

| # | Issue | Doména / Role | Owner | Žiadané | Deadline |
|---|---|---|---|---|---|
| 1 | **Monitor scrape cron mŕtve 8 dní na vianeme** | Operativa + Monitor | Patrik + Martin | Diagnostika, fix, monitoring banner | ASAP |
| 2 | **Audit log iba 6% coverage** (5/84 write routes) | Compliance | Katarína | Pridať `logAudit()` do 80 routes | Q2 2026 |
| 3 | **11 anon RLS `USING(true)` policies** | Security Audit | Adam | Systematický scan, fix každý | Q2 2026 |
| 4 | **ESLint v9 config rozbitý** | QA | Daniela | Migrácia .eslintrc → eslint.config.js | ASAP |
| 5 | **`ai_usage_log` tabuľka chýba** | AI + Financie | Eva + Mária | Cost tracking po DB + middleware | Q2 2026 |
| L1 | 🆕 **Resend API key INVALID — všetky CRM emaily rozbité** | DevOps + CEO | Jaroslav + Aleš | Nový kľúč na resend.com + update Vercel env | TERAZ |
| L2 | 🆕 **AML registrácia VIANEMY (zákon 73/2026)** | Compliance | Katarína | Registrácia povinnej osoby | **31.8.2026 zákon** |
| L3 | 🆕 **eKasa pre RKty** — povinnosť od 1.1.2026 | Financie + Náberáky | Mária + Lenka | Integrácia alebo policy "iba bezhotovostné" | **AKTÍVNE** |
| L4 | 🆕 **AML hard blocker pred KZ** (KUV identifikácia >15k EUR) | Náberáky + Compliance | Lenka + Katarína | API check pred KZ podpis | Q2 2026 |

---

## 🟡 P1 — Dôležité (4-8 týždňov)

| # | Issue | Doména / Role | Owner |
|---|---|---|---|
| 6 | Pagination na list endpointoch (scale 100 maklerov) | SRE + Tech Leads | Michal koord |
| 7 | Materialized views pre `/manazer` dashboard | Operativa + SRE | Patrik + Michal |
| 8 | AML hard blocker pred KZ podpis | Náberáky + Compliance | Lenka + Katarína |
| 9 | Reconnect Google OAuth UX (auto-flow) | Google | Roman |
| 10 | 30-day device verification (security) | Security | Lukáš |
| 11 | GitHub Actions CI/CD (TS + test + audit gate) | DevOps | Jaroslav |
| 12 | Cron health monitoring tabuľka `cron_runs` | Operativa | Patrik |
| 13 | Password validation: register/reset používa min 12+complexity | Security | Lukáš |
| 14 | Brand voice blacklist v AI Writer (pre-display) | AI + Brand | Eva + Veronika |
| 15 | Test coverage pre 8 critical flows | QA + Tech Leads | Daniela |
| 16 | Sentry / error tracking | DevOps | Jaroslav |
| 17 | UI copy inventory + i18n setup | Brand + UX | Veronika + Šimon |
| 18 | a11y audit (axe-core) v CI | UX | Šimon |
| 19 | Bundle size audit + tree-shake | SRE | Michal |
| 20 | Faktúra číslo atomic generation (DB sequence) | Financie | Mária |
| 21 | Breach notification playbook (72h GDPR) | Compliance | Katarína |
| 22 | Drive folder auto-create cron pre nové nehnuteľnosti | Nehnuteľnosti + Google | Andrej + Roman |
| 23 | Support ticket system (Plain / Linear) | Customer Success | Zuzana |

---

## 🟢 P2 — Mali by byť (Q3-Q4 2026)

| # | Issue | Doména / Role | Owner |
|---|---|---|---|
| 24 | 2FA / TOTP pre adminov | Security | Lukáš |
| 25 | SWR/React Query migrácia | SRE + Tech Leads | Michal |
| 26 | Sec Audit: anon RLS deep scan automated | Sec Auditor | Adam |
| 27 | Audit log retention cron (90d archive) | Operativa | Patrik |
| 28 | Telefón unique constraint per company | Klienti | Petra |
| 29 | Verzionovanie náberákov (revisions table) | Náberáky | Lenka |
| 30 | PDF cache layer | Náberáky + SRE | Lenka + Michal |
| 31 | Portal-specific validation pre publish (Bazos/Reality/...) | Nehnuteľnosti | Andrej |
| 32 | Drive link rot periodic audit | Nehnuteľnosti + Google | Andrej + Roman |
| 33 | Email dedup window pre invites | Obhliadky | Jozef |
| 34 | Year-aware daňový threshold | Financie | Mária |
| 35 | Storybook setup pre design system | UX | Šimon |
| 36 | Push delivery rate tracking | Operativa | Patrik |
| 37 | Email open/bounce stats z Resend webhook | Operativa | Patrik |
| 38 | parse-doc fallback chain explicit (Anthropic→Gemini→OpenAI) | AI | Eva |
| 39 | Property Stories test suite | AI + QA | Eva + Daniela |
| 40 | Drive API rate limiter | Google | Roman |

---

## 🔵 P3 — Nice-to-have (long-term)

| # | Issue | Owner |
|---|---|---|
| 41 | RLS sprísnenie z USING(true) na ozajstné policies | Lukáš + Adam |
| 42 | Read replica pre /manazer (Supabase Pro upgrade) | Michal + Jaroslav |
| 43 | Inline style → CSS modules refaktor | Šimon |
| 44 | Volni-klienti cron race condition fix | Petra |
| 45 | Slovak spell-check v CI | Veronika |
| 46 | OKR template pre 2026 | Peter |
| 47 | Mobile viewport tests v Playwright | Šimon + Daniela |
| 48 | Klasifikátor confidence metric v UI (Monitor) | Martin |
| 49 | Refresh token rotation policy (Google) | Roman |
| 50 | Faktúra archive after 10y | Mária |

---

## 📊 Metriky

| Status | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Open | 5 | 18 | 17 | 10 | 50 |
| In progress | 0 | 0 | 0 | 0 | 0 |
| Closed (last 30d) | 0 | 0 | 0 | 0 | 0 |

**Closure rate target**: ≥ 50% mesačne (Inspector General tracks).

---

## 🗓 Sprint workflow

**Piatok 16:00** — Sprint review + planning:
1. Inspector General (Mária E023) prezentuje weekly internal audit
2. PM (Peter) priori­tizuje
3. Tech Leads získajú 1-2 tickety na nasledujúci týždeň
4. Acceptance criteria sa defínujú
5. CEO sign-off ak P0/epic

**Pondelok 09:00** — Async standup:
- Každý Tech Lead pridá entry do `memory/standup.md`: čo robil, čo bude robiť, čo blokuje

---

## 🎯 Q-OKR placeholder

Pre Q2 2026 (TBD by CEO + PM):
- **Objective 1**: ___
  - KR 1.1: ___
  - KR 1.2: ___
- **Objective 2**: ___
  - KR 2.1: ___
  - KR 2.2: ___

---

## 📌 Žiadosti od užívateľov (od Customer Success Zuzana)

> *(aggregated týždenne)*

- ...
- ...

---

## 🔄 Historické closed tickety

> *(presunie sa sem po close — týždenne aktualizuje Peter)*

- ...
