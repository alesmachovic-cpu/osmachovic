# Doména: Google Integrácia

> **Owner**: Ing. Roman Krištof (E011) — Tech Lead. Backup: Mgr. Tomáš Hrabovský (E003) — CTO.
> Po zmene spusti `scripts/audit-google.sh`.

## Účel
OAuth integrácia s Google: **Drive** (dokumenty klientov), **Gmail** (komunikácia), **Calendar** (termíny obhliadok). Každý maklér si pripojí svoj vlastný Google účet, scoped tokens v DB.

Bez funkčného Google: dokumenty sa neukladajú, kalendár nesynced, emaily neposielajú.

---

## ✓ INVARIANTS

### OAuth flow
- `/api/auth/google/route.ts` = redirect na Google s nonce + scope.
- `/api/auth/google/callback/route.ts` = handle exchange code → tokens, save encrypted.
- **Tokens encrypted v DB** (`encryptToken()` v `src/lib/google.ts`). NIKDY plain.
- Scopes: `https://www.googleapis.com/auth/calendar` + `gmail.send + gmail.readonly` + `drive.file` (minimum potrebný).
- OAuth state validation (CSRF protection) — random token v session.

### Token refresh
- `getValidAccessToken(userId)` v `src/lib/google.ts` overí `expires_at`. Ak < 5 min do expiry → refresh.
- Refresh fail → token uložiť ako revoked, vrátiť null, UI ukáže "pripojiť znova".
- Refresh logic má try/catch (graceful).

### Status checking
- `/api/auth/google/status` = vracia `{connected: boolean, email: string?}`.
- Frontend hook `useGoogleConnected` = **module-level cache + inflight dedup** (FIXED 2026-05-18).
- TTL 60s, manual invalidate cez `invalidateGoogleConnected()`.

### Disconnect flow
- `/api/auth/google/disconnect` = mažú `google_access_token`, `google_refresh_token`, `google_email`, `google_token_expires_at`.
- Audit log entry.

### Frontend gating
- Komponenty čo volajú Google endpointy MUSIA gating cez `useGoogleConnected` (fix 2026-05-18, predtým 401 spam).
- Affected: `/app/page.tsx` (ObhliadkyKandidatiBanner), `/app/kalendar/page.tsx`.

---

## ⚠ GAPS

### 1. Reconnect UX ⚠ základné
Ak token expired, UI ukáže "Pripojiť Google" banner ale nie auto-reconnect. Maklér musí klikať.

### 2. Token rotation pravidelne ⚠ nie
Google odporúča refresh token rotation. Aktuálne nikdy.

### 3. Per-API rate limiting ⚠
Drive API má quotu 1000 req/100s/user. Pri masovom upload chýba throttling.

### 4. Drive folder cleanup ⚠
Po GDPR erasure klienta sa Drive priečinok NEmaže (zámerné, audit). Treba ale dlhodobý archív policy.

### 5. Gmail send rate limit ⚠
Gmail API limit 250 emails/day/user. Pri masovom mail-out (e.g. invitations) crash.

---

## 🔥 HOT FILES

| Súbor | Prečo |
|---|---|
| `src/lib/google.ts` | OAuth core, encrypt/decrypt, refresh logic |
| `src/app/api/auth/google/callback/route.ts` | Token exchange, save |
| `src/app/api/auth/google/disconnect/route.ts` | Cleanup |
| `src/app/api/auth/google/status/route.ts` | Status endpoint |
| `src/lib/useGoogleConnected.ts` | FIXED 2026-05-18 (module-level cache) |
| `src/app/api/google/calendar/route.ts` | Calendar API |
| `src/app/api/obhliadky/auto-detect/route.ts` | Calendar scan |

---

## 🧪 Audit

```bash
./scripts/audit-google.sh
```

1. Tokens v DB sú encrypted (sample row test má prefix `gAAAAAB` alebo iný encryption marker)
2. OAuth callback validuje `state`
3. `useGoogleConnected` má module-level cache (fix invariant)
4. Žiadny user s `expires_at` v minulosti bez warning v UI
5. Frontend Google volania majú gating

---

## 📌 TODO

- [ ] Auto-reconnect UX (vyber callback URL po expiry) — P2
- [ ] Refresh token rotation policy — P3
- [ ] Drive API rate limiter (throttle 1000/100s) — P2
- [ ] Gmail send queue (batch + delay) — P2

---

## História incidentov

- **2026-05-18** `useGoogleConnected` hook fetoval per komponent = duplicate `/api/auth/google/status` calls. Fix: module-level cache + inflight dedup. Commit `345d832`.
- **2026-05-18** Dashboard a kalendar spamovali 401 keď user Google nemá pripojený. Fix: gating cez `useGoogleConnected`. Commit `345d832`.
- **(starší)** Token expiry: 3/12 maklerov má expired refresh tokeny (Google security revoke). User musí re-OAuth.
