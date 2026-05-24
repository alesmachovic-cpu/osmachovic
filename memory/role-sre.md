# Rola: SRE / Performance Engineer

> **Vedie**: Ing. Michal Babinský (E015). Reportuje COO.
> Denne (hourly checks), týždenne deep audit.

## Misia
Systém vždy beží, vždy rýchlo, aj pri 100 maklerov × 15 ponúk × tisíce klientov. Detekcia bottlenecks pred tým než užívateľ zacíti.

---

## SLO targets

| Endpoint / akcia | p50 | p95 | p99 |
|---|---|---|---|
| Dashboard load (TTFB) | < 500ms | < 1s | < 2s |
| List endpoint (/api/X) | < 200ms | < 500ms | < 1s |
| Search autocomplete | < 100ms | < 200ms | < 500ms |
| Detail page | < 300ms | < 800ms | < 1.5s |
| PDF generation | < 2s | < 5s | < 10s |
| Save form (POST) | < 200ms | < 500ms | < 1s |

---

## Zodpovedná za

### Daily monitoring
- Sleduje Vercel Analytics: response time per endpoint
- Cron healthcheck: ak posledný úspešný beh > 36h → ALERT
- Bandwidth tracking: žiaden endpoint > 500KB pri normálnom load

### PR review (performance lens)
- Hľadaj nové slow query (full table scan, missing index)
- Hľadaj N+1 patterns (loop volania API)
- Hľadaj pagination chýbajúce na list endpointoch (>50 rows risk)
- Hľadaj SELECT * bez audit (môže zhoršiť bandwidth)

### Scale planning
- Pri 100 maklerov × 15 ponúk = ~5K nehnuteľností + 30-150K obhliadok
- Materialized views pre /manazer dashboard (computed = 30s+ pri scale)
- Read replicas pre reporty (Supabase Pro)
- CDN pre static assets (Vercel Edge auto-cache)

### Index management
Drží zoznam composite indexes v každej tabuľke:
- `naberove_listy(company_id, makler_id, created_at DESC)` ✓ (z migrácie 070)
- `obhliadky(company_id, datum DESC)` ✓
- `klienti(company_id, makler_id)` ✓
- TODO: `monitor_inzeraty(company_id, predajca_typ, created_at)` pri scale

---

## ✓ INVARIANTS

- **/api/nabery** < 100 KB payload (po SELECT * cleanup commit c389469)
- **/api/obhliadky** < 50 KB payload (po cleanup)
- **No N+1** v žiadnom hot path endpointu
- **Pagination povinná** pri akémkoľvek list endpointe pri 100+ rows
- **Vercel function timeout** = 60s default. Výnimka parse-doc = 300s (zachovať!)

---

## ⚠ GAPS

### 1. Žiadne load testy
Nevieme aký load aktuálne zvládneme. Treba k6 alebo Artillery script s realistickým profilom.

### 2. Cron health monitoring chýba ❌ KRITICKÉ
Monitor scrape mŕtve 8 dní bez upozornenia. P1 (TODO v Operativa).

### 3. Vercel Analytics nie pripojené?
Treba overiť že máme prístup k response time metrics.

### 4. Materialized views chýbajú
/manazer pri 100 maklerov bude pomalý. Treba pripraviť.

### 5. Bundle size unaudit
Frontend JS bundle môže byť 3MB+. Treba `next build` analyzu.

---

## 🧪 Audit

```bash
./scripts/audit-perf.sh
```

1. Ping kritických endpointov, response time < SLO
2. Bandwidth check: /api/nabery, /api/obhliadky < limits
3. Vercel cron schedules valid v vercel.json
4. Last successful cron < 36h (delegate na cron health)
5. Bundle size porovnanie s baseline

---

## 📌 TODO

- [ ] Load test script (k6) s 100 paralelnými useri (P1)
- [ ] Materialized views pre /manazer (P1)
- [ ] Bundle audit + tree-shake nepotrebné deps (P2)
- [ ] Vercel Analytics integration (P2)
- [ ] Read replica setup pre reporty (P3, Supabase Pro upgrade)
