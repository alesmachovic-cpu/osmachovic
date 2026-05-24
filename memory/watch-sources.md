# External Watch Sources — čo musí každá rola sledovať mimo nášho repa

> **Vlastní**: Inspector General (Mária E023) — sleduje že každý role-owner monitoruje svoje external sources.
> Týždenný sumarizujúci report — kto čo nové našiel, či to ovplyvňuje VIANEMA.

---

## 1. Compliance Officer (Katarína E018) — právne updates

**Zákony, ktoré platia (sledovať zmeny)**:
- ÚOOÚ slovenský regulátor: https://dataprotection.gov.sk/ (RSS / newsletter)
- EDPB (European Data Protection Board): https://edpb.europa.eu/news/ — nové guidelines, fines
- Zákon č. 18/2018 Z.z. — slovenská implementácia GDPR (zmeny v Zb.)
- Zákon č. 297/2008 Z.z. — AML (FIU SR aktualizácie)
- Zákon č. 222/2004 Z.z. — DPH (Finančná správa SR)
- Zákon č. 246/2015 Z.z. — realitná činnosť (Ministerstvo vnútra SR)

**Industry**:
- IAPP (Iternational Association of Privacy Professionals): https://iapp.org/
- Local Slovak data protection blogs (Allen & Overy, Eversheds, atď.)

**Frequency**: týždenne news scan, mesačne deep review veľkých zmien.

---

## 2. Security Tech Lead + Security Auditor (Lukáš E004, Adam E016)

**CVE feeds**:
- npm audit (`npm audit` weekly)
- GitHub Dependabot alerts (auto)
- Snyk advisor pre používané packages
- CVE database: https://cve.mitre.org/

**Sectoral**:
- OWASP Top 10 (annual update)
- Web security tracker: https://www.troyhunt.com/
- Krebs on Security: https://krebsonsecurity.com/
- Supabase changelog: https://supabase.com/changelog
- Next.js security updates: https://github.com/vercel/next.js/security

**Frequency**: denne (CVE feeds auto), týždenne deeper read.

---

## 3. Brand & Marketing (Veronika E019)

**Industry trends**:
- Apple HIG (Human Interface Guidelines) updates: https://developer.apple.com/design/
- Slovak realestate market reports (NBS, RealitaMaklerska, Trend)
- Competitor messaging (čo robia rivals: TopReality, Nehnuteľnosti.sk, atď.)

**Copy/style**:
- Apple Marketing Communications style guide
- Slovak language updates (JÚĽŠ SAV pre pravopis)

**Frequency**: mesačne competitor scan, kvartálne trend report.

---

## 4. AI Tech Lead (Eva E012)

**Model updates**:
- Anthropic Claude releases: https://www.anthropic.com/news
- OpenAI changelog: https://platform.openai.com/docs/changelog
- Google Gemini updates: https://ai.google.dev/gemini-api/docs/changelog
- Hugging Face top models trending

**Pricing changes** (cost tracking critical):
- Anthropic pricing: https://www.anthropic.com/pricing
- OpenAI pricing: https://openai.com/api/pricing
- Gemini pricing

**Best practices**:
- Prompt engineering newsletters (Lilian Weng blog, Anthropic Cookbook)
- LangChain/LlamaIndex changelogs

**Frequency**: týždenne news, mesačne prompt optimization review.

---

## 5. Google Integration (Roman E011)

**API changelogs**:
- Google Workspace API: https://developers.google.com/workspace/announcements
- Calendar API deprecations
- Gmail API quota changes
- Drive API rate limit changes
- OAuth scope deprecations

**Frequency**: mesačne deep check, immediate keď notify Google.

---

## 6. CTO (Tomáš E003)

**Framework updates**:
- Next.js releases: https://nextjs.org/blog
- React releases: https://react.dev/blog
- TypeScript releases: https://devblogs.microsoft.com/typescript/
- Vercel platform updates
- Supabase product updates

**Industry**:
- Hacker News trending (skim)
- thoughtworks Tech Radar (kvartálne)

**Frequency**: týždenne news scan, kvartálne deep technology review.

---

## 7. SRE (Michal E015)

**Vendor status**:
- Vercel status: https://www.vercel-status.com/
- Supabase status: https://status.supabase.com/
- Anthropic status: https://status.anthropic.com/
- Google Cloud status: https://status.cloud.google.com/
- Resend status

**Performance**:
- Web.dev Core Web Vitals updates
- Lighthouse scoring changes

**Frequency**: denne status check (cron `/api/cron/api-status`), týždenne perf trends.

---

## 8. DevOps (Jaroslav E017)

**Tooling**:
- Vercel CLI releases
- GitHub Actions changelog
- npm/yarn/pnpm updates
- Docker (ak používame) updates

**Security**:
- npm registry advisories
- pip / pypi security advisories

**Frequency**: mesačne tooling update sweep.

---

## 9. Compliance — daňové (Mária E010 + Katarína)

**Slovak tax law**:
- Finančná správa SR: https://www.financnasprava.sk/
- Daňová sadzba zmeny (DPH, daň z príjmu)
- Účtovné štandardy SR
- E-faktúra povinnosti (rapidly evolving)

**Frequency**: mesačne sweep, immediate pri rok prelomu (year-end zmena threshold).

---

## 10. Product Manager (Peter E021)

**Market intelligence**:
- Slovak real estate market trends (TopReality, Nehnuteľnosti.sk)
- Competitor product updates (čo robia iné CRMs)
- User research papers / studies o real estate workflow

**Frequency**: kvartálne market scan.

---

## 11. Customer Success (Zuzana E022)

**User behavior**:
- Aggregated support tickets
- User session recordings (ak máme — Hotjar?)
- NPS / CSAT surveys
- Industry user behavior reports

**Frequency**: týždenne pulse, mesačne trend.

---

## 🎯 Workflow

### Týždenne (piatok 17:00)
Každý role-owner:
1. Skontroluj svoje watch sources (max 30 min)
2. Identifikuj relevant updates pre VIANEMA
3. Zaznač do `memory/role-X.md` History sekcie + roadmap.md ak treba akciu

### Mesačne (1. v mesiaci)
Inspector General (Mária):
1. Aggregate čo role-owners hlásili
2. Identifikuj pattern (napr. "5 rolí hovorí o nových AI pricing zmenách")
3. Report CEO

### Kvartálne (1. deň kvartálu)
- Big news report pre CEO
- Roadmap priority refresh based on external trends
- Vendor renegotiation ak treba (cost zmeny)
