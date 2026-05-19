# Rola: Vendor & Partnership Management

> **Vedie**: Mgr. Pavol Bardoš (E026) — ex-procurement enterprise.
> Reportuje COO.

## Misia

VIANEMA závisí na ~10 vendoroch (Supabase, Anthropic, Vercel, Resend, Google, atď.). **Vendor outage = VIANEMA outage**. Treba contracts, SLA, escalation paths.

## Vendor register (top 10)

| # | Vendor | Kategória | Mesačný náklad | Critical? | DPA podpísané? | SLA | Escalation |
|---|---|---|---|---|---|---|---|
| 1 | Supabase | DB + Auth | TBD ($25 Pro) | ÁNO | ?  treba check | 99.9% | support@supabase.com |
| 2 | Vercel | Hosting | TBD ($20 Pro) | ÁNO | ? | 99.99% | support@vercel.com |
| 3 | Anthropic | AI Writer | TBD ($X) | Stredne | ? | best-effort | enterprise@anthropic.com |
| 4 | Google Workspace | OAuth + Drive/Gmail/Calendar | $0 | Vysoko | nie (povolenie users) | best-effort | Workspace Support |
| 5 | Resend | Email | $0 free tier | Vysoko | ? | best-effort | support@resend.com |
| 6 | GitHub | Code repo + Actions | $0 | Vysoko | ? | 99.9% | enterprise sales |
| 7 | OpenAI | AI fallback | TBD | Nízko | ? | best-effort | support@openai.com |
| 8 | Gemini (Google AI) | AI fallback | TBD | Nízko | ? | best-effort | Google AI Studio |
| 9 | bcrypt npm | Crypto lib | $0 OSS | Vysoko | n/a | n/a | community |
| 10 | web-push npm | Push lib | $0 OSS | Stredne | n/a | n/a | community |

---

## Zodpovedný za

### Kontrakty & DPA (Data Processing Agreement)
- Pre KAŽDÝ vendor čo touchne PII → DPA podpísané
- Compliance check (Katarína sign-off)
- Renewal trecking (auto-renew dates)

### Vendor monitoring
- Status pages denne (cez `/api/cron/api-status`)
- Cost tracking (monthly invoice review)
- Performance review kvartálne (uptime SLA met?)

### Vendor risk
- Single-point-of-failure (čo ak Supabase padne?) → escalation playbook
- Cost runaway alerts (Anthropic spike)
- Vendor lock-in assessment (môžeme prejsť ku konkurencii?)

### Negociácia
- Pri scale: ročné kontrakty s discount
- Volume tiers (Anthropic enterprise pricing)
- Multi-year DPAs

---

## ⚠ GAPS (potreba audit)

- [ ] DPAs neoverené pre 5 z 10 vendorov
- [ ] Žiadny cost dashboard agregát
- [ ] Žiadne disaster recovery drill (Supabase backup restore — overené?)
- [ ] Žiadne vendor SLA breach playbook
- [ ] Renewals trecking — kedy expiruje Supabase Pro?

## TODO

- [ ] P1: DPA checklist pre 5 missing vendors
- [ ] P1: Cost dashboard (per vendor monthly)
- [ ] P2: Disaster recovery drill kvartálne
- [ ] P2: SLA breach playbook
- [ ] P3: Vendor consolidation review (môžeme niečo zlúčiť?)

## Slovensky. Bullet points.
