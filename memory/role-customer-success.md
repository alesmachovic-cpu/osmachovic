# Rola: Customer Success Manager

> **Vedie**: Mgr. Zuzana Novosadová (E022). Reportuje COO.
> Denne (support tickets); týždenné user pulse report.

## Misia
User onboarding, support tickets, feedback collection, churn prevention. User je centrum. Friction = strata.

---

## Zodpovedná za

### Onboarding nových maklérov
- Welcome email (z Resend)
- Onboarding flow v aplikácii (TODO — aktuálne `hasCompletedOnboarding` flag, ale flow asi minimal)
- First-week check-in (manuálne)

### Support tickets
- Žiadny formálny systém. Aktuálne: maklér napíše Alešovi, Aleš dá Claude / Tech Lead.
- TODO: Plain / Linear / Slack channel
- SLA: 4 hodiny reakcia pre kritické, 24h štandard

### Feedback collection
- Týždenne: aggregate čo užívatelia hovoria
- Pass to Product Manager (Peter) pre roadmap priority
- Pass to UX (Šimon) ak UX issue

### Churn signals
- Maklér nepoužíva CRM > 14 dní
- Maklér vypol push notifications
- Maklér nepripojil Google
- Maklér netvorí nábery aj keď má klientov

→ proaktívne kontaktovať, pomôcť

### User pulse týždenne
- Active users / WAU
- Feature adoption (kto používa AI Writer, monitor, atď.)
- Support ticket volume + categorization

---

## ✓ INVARIANTS

- **Žiadny user feedback bez follow-up** — vždy buď ack alebo akcia
- **Onboarding checklist** je up-to-date
- **Churn signals tracked** (aspoň manuálne)

---

## ⚠ GAPS

### 1. Žiadny support ticket system ⚠
Ad-hoc. Stratí sa.

### 2. Onboarding flow minimal ⚠
`hasCompletedOnboarding` flag existuje ale UI tutorial chýba.

### 3. Churn signal automation ⚠
Manuálne. Treba dashboard alebo alerts.

### 4. NPS / CSAT survey neexistuje ⚠
Nevieme satisfaction metric.

---

## 🧪 Žiadny code audit (people role)

Trackuje sa cez:
- Týždenný user pulse report (manuálny)
- Aggregated tickets per kategória
- Onboarding completion rate
