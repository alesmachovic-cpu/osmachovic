# Doména: Operativa & Manažér

> **Owner**: Bc. Patrik Vlk (E013) — Tech Lead. Backup: Ing. Peter Halás (E021) — Product Manager.
> Po zmene spusti `scripts/audit-operativa.sh`.

## Účel
Pohľad pre **manažéra** (vyťaženosť tímu, konverzia, produkcia per maklér), **notifikácie** (push, email, in-app), **upozornenia** (alerts), **system log** (audit history pre admina). Plus widgety pre dashboard.

Bez tejto domény: manažér nemá insights → nedokáže riadiť tím. Notifikácie tiché → maklér nevie o novom klientovi.

---

## ✓ INVARIANTS

### Manažérsky prehľad
- `/manazer` zobrazuje:
  - **Konverzný pomer** (nabraný → predaný) per maklér + tímový priemer
  - **Vyťaženosť** (aktívne klienti / max kapacita)
  - **Produkcia** (provízie tento mesiac)
  - **Top performers / bottom performers**
- Iba pre `role IN ('manazer', 'majitel', 'super_admin')`.
- Materializované views (TODO) — aktuálne computed at request time (pomalé pri 100 maklérov).

### Push notifikácie
- Web Push API + VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
- Subscription endpoint: `/api/push/subscribe`.
- Send: `/api/push/send` (admin) alebo automaticky pri eventoch (nový klient, dohodnutý náber, atď.).
- **Idempotency**: žiadny duplicit push (key = `{user_id}:{event_id}`).
- Opt-in only — user musí súhlasiť v prehliadači.

### Email notifs
- Cez Resend (`RESEND_API_KEY`).
- Šablóny v `src/lib/email/templates/`.
- Tracking delivery (open rate cez Resend webhook → TODO).

### Upozornenia (in-app banner)
- Tabuľka `upozornenia` per user.
- UI banner v dashboard.
- Auto-dismiss alebo manuálne.

### System log
- `/log` (admin-only) zobrazuje `audit_log` tabuľku.
- Filterable per user, akcia, dátum.
- Retention 90 dní (TODO enforce).

### Alerts (kritické)
- Cron `/api/cron/api-status` o 06:00 UTC = healthcheck Anthropic/Gemini/Google/Resend.
- Ak ktorékoľvek fail → push admin + email Aleš.
- Failed scrape cron (Monitor) → alert (KRITICKÉ, viď. incident 8d mŕtve scraping).

---

## ⚠ GAPS

### 1. Manažér dashboard performance ⚠ kritický pre 100 maklerov
Aktuálne computed at request time. Pri 100 maklerov × historical dáta → 30+ sekúnd. Treba materialized views alebo cron-snapshot tabuľka.

### 2. Cron health monitoring chýba ❌ KRITICKÉ
Žiaden alert keď cron padne. **Monitor scrape bol 8 dní mŕtvy bez upozornenia** (incident 2026-05-19). Treba tabuľka `cron_runs` + banner.

### 3. Push delivery rate tracking ⚠
Neexistuje. Vieme či push dorazil? Neviem.

### 4. Email delivery tracking ⚠
Resend posiela webhook s open/bounce stats. Aktuálne ignorujeme.

### 5. Alerts cez Slack/Telegram ⚠
Email + push fungujú ale Aleš ich vždy nepozrie. Slack/Telegram channel pre critical alerts by bol lepší.

### 6. System log retention ⚠
90-dňová policy v memory ale žiadny cleanup cron.

---

## 🔥 HOT FILES

| Súbor | Prečo |
|---|---|
| `src/app/manazer/page.tsx` | Hlavný dashboard pre vedenie |
| `src/app/api/push/route.ts` | Push subscribe + send |
| `src/lib/push/notifications.ts` | Push abstraction |
| `src/app/notifikacie/page.tsx` | In-app notifs UI |
| `src/app/upozornenia/page.tsx` | Alerts UI |
| `src/app/log/page.tsx` | Audit log viewer (admin) |
| `src/app/api/cron/api-status/route.ts` | Healthcheck cron |

---

## 🧪 Audit

```bash
./scripts/audit-operativa.sh
```

1. VAPID keys v env (push funguje)
2. Cron `api-status` registered
3. Push subscription endpoint reachable
4. `/manazer` page renderuje (TS clean)
5. **Cron health check** — všetkých 8 cronov posledný úspešný beh < 36h

---

## 📌 TODO

- [ ] **Cron health monitoring tabuľka + banner** (P1, kritické — Monitor scrape bug)
- [ ] Manažér dashboard materialized views (P1, perf pre 100 maklerov)
- [ ] Push delivery rate tracking (P2)
- [ ] Email open/bounce stats z Resend webhook (P3)
- [ ] Slack/Telegram alerts pre critical (P3)
- [ ] System log retention cron (P3)

---

## História incidentov

- **2026-05-19** Audit Monitor doménu zistil že **scrape cron neebehol 8 dní na vianeme produkcii** bez akéhokoľvek alertu. Nikto si nevšimol. KRITICKÝ gap → P1 ticket "Cron health monitoring".
