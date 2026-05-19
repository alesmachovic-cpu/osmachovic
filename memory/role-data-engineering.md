# Rola: Data Engineering / Analytics

> **Vedie**: Ing. Tomáš Klimek (E025) — ex-banková analytika, dátový architekt.
> Reportuje CTO.

## Misia

Surové dáta → insights. Miliardový business potrebuje **vedieť čo sa deje** — nie tipovať.

## Zodpovedný za

### Reporting & dashboards
- Manažérsky dashboard (/manazer) — vyťaženosť tímu, konverzia, produkcia
- Sales pipeline analytics
- Revenue forecast (faktúry pipeline)
- Maklér performance metrics (NPS, čas náber→podpis, win rate)

### Data quality
- Žiadne duplicity klientov (telefón hash + email dedup)
- Žiadne orphan záznamy (klient bez makléra, náber bez klienta)
- Štatistická anomália detection (drift v cenách, abnormálne kategórie)

### Materialized views & aggregation
- Pre Operativa dashboard scale (100 maklérov × 1500 ponúk)
- Cron-refreshed snapshots (každú hodinu)
- Pre Manažér KPI tracking
- Pre Risk Mgmt heatmap

### Data pipeline
- ETL z Supabase → reporting DB (ak treba)
- Export pre účtovníka (CSV)
- Backup pre BI (Metabase / Looker / Grafana future)

---

## ✓ Invariants

- **Žiadne PII v reporting layer** bez explicit GDPR consent
- **Aggregated metrics only** v sharable reports
- **Audit log immutable** (žiadny touch)
- **Materialized view refresh** najmenej každé 4h pre /manazer

---

## ⚠ Gaps

- Žiadne materialized views (Manažér dashboard pomalý pri scale)
- Žiaden ETL — všetko on-demand query
- Žiadna BI nástroj
- Žiadny data dictionary (každý hádza tabuľky bez popisu)

---

## TODO

- [ ] P1: Materialized view `mv_makler_kpi` (refresh 1h)
- [ ] P1: Data dictionary v `memory/data-dictionary.md`
- [ ] P2: Anomaly detection cron (revenue drop, klient churn signal)
- [ ] P2: Export pipeline pre účtovníka (mesačný CSV)
- [ ] P3: BI tool eval (Metabase open-source vs Looker)

## Slovensky. Bullet points.
