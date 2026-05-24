# Rola: DevOps & Infrastructure

> **Vedie**: Bc. Jaroslav Šebo (E017). Reportuje CTO.
> Pri každom deploy + týždenne env audit.

## Misia
Žiadne broken deploys. Predictable releases. Fast rollback. Žiadne secret leaky. CI/CD healthy.

---

## Zodpovedná za

### Vercel deployments
- 2 projekty: `funny-stonebraker` (vianema.amgd.sk PROD) + `vianema-dev` (dev.amgd.sk)
- Main branch → prod auto-deploy
- Dev branch → dev auto-deploy
- Queue management (občas stuck, riešenie: `vercel redeploy` ako workaround)

### Environment variables
- 3 env súbory: `.env.local`, `.env.local.prod`, `.env.local.dev`
- Vercel env vars per projekt (sync s .env súbormi)
- **Sensitive**: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, GOOGLE_CLIENT_SECRET, RESEND_API_KEY, SESSION_SECRET, VAPID_PRIVATE_KEY
- **Public**: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID, VAPID_PUBLIC_KEY

### Cron schedules (vercel.json)
8 cronov:
- `/api/cron/cleanup` o 03:00 UTC
- `/api/cron/pravidelne-naklady` o 01:00 UTC
- `/api/cron/scrape` o 08:00 UTC
- `/api/cron/api-status` o 06:00 UTC
- `/api/cron/lv-reminder` o 07:00 UTC
- `/api/cron/volni-klienti` o 05:00 UTC
- `/api/cron/foto-rotation` o 04:00 UTC
- `/api/cron/monitor-daily` o 09:00 UTC

### Secret rotation (kvartálne)
- SUPABASE_SERVICE_ROLE_KEY — rotate v Supabase + Vercel
- ANTHROPIC_API_KEY — rotate v Anthropic console + Vercel
- SESSION_SECRET — pozor, rotation = invalidates všetky sessions (force re-login)
- VAPID keys — rotation = invalidates push subscriptions

### Rollback playbook
1. Identify problem (Sentry, user report, audit fail)
2. Vercel Dashboard → projekt → Deployments → predchádzajúci Ready → "Promote to Production"
3. Verify on vianema.amgd.sk
4. Post-mortem report

### CI/CD (GitHub Actions)
TODO — aktuálne nemáme. Treba pridať:
- TS check
- Vitest run
- ESLint (po fix)
- Audit scripts run

---

## ✓ INVARIANTS

- **Sensitive env vars NIKDY v repe** (.gitignore .env.local*)
- **Vercel env sync** s lokálnymi .env súbormi (manuálne periodicky)
- **Cron schedule v vercel.json** = single source of truth
- **Build prejde TS check** pred Vercel deploy
- **Rollback < 30s** (Vercel Promote previous = okamžite)

---

## ⚠ GAPS

### 1. Žiadny CI/CD
GitHub Actions chýba. Bugy môžu prejsť do main.

### 2. Žiadna Sentry / error tracking
Vercel logs = surové, žiadny aggregated view. Treba Sentry alebo podobné.

### 3. Secret rotation kalendár chýba
Nikdy systematicky. Posledná rotation = nikdy?

### 4. Vercel deploy queue stuck recurring
Viackrát som pozoroval stuck queue na vianema-dev. Riešenie: `vercel redeploy`. Treba zistiť root cause.

### 5. Env drift dev vs prod ⚠
.env.local.dev a .env.local.prod môžu mať odlišné vars. Treba parity check.

---

## 🧪 Audit

```bash
./scripts/audit-deploy.sh
```

1. .env súbory nie sú git tracked (.gitignore)
2. Sensitive vars NIE sú v src/components, src/hooks (delegate cez security audit)
3. Vercel cron schedules valid (8 cronov v vercel.json)
4. Vercel projekty: 2 active (funny-stonebraker + vianema-dev)
5. Posledný úspešný deploy < 7 dní (nie je všetko stuck)

---

## 📌 TODO

- [ ] GitHub Actions: TS + test + lint + audit gate (P1)
- [ ] Sentry alebo error tracking (P1)
- [ ] Secret rotation kalendár + playbook (P2)
- [ ] Vercel queue stuck root cause investigation (P2)
- [ ] Env parity audit dev vs prod (P3)

---

## História incidentov

- **2026-05-18 multiple times** Vercel deploy queue stuck 5-30 min. Workaround: `vercel redeploy`. Root cause TBD.
