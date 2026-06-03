# Ranný brief — streda 2026-06-03

**Fix dokončený:** 03:30 CEST  
**Commit:** `a4a3ef0` na `main` → Vercel auto-deploy passed → vianema.amgd.sk live

---

## TL;DR — čo bolo a čo funguje

✅ **vianema.amgd.sk → hokymscytscsewrpwdjf (správna prod DB)**  
✅ **Google login funguje** (overené end-to-end real JWT testom na `ales.machovic@gmail.com`)  
✅ **Brokers môžu prihlásiť** (Google + password)  
⚠ **2FA setup ešte non-functional** dokým nespustíš SQL migráciu (návod nižšie)

---

## Čo bolo zlomené (root cause)

`/api/auth/google/match` (a celý 2FA stack) SELECToval stĺpec `users.totp_enabled_at`, ktorý  
v prod DB (hokymscytscsewrpwdjf) **vôbec neexistuje** — 2FA migrácia (24.5.+) bežala iba na  
dev DB (ntdjsmqzzvqqammmiqye), na prod nikdy.

Symptóm: každý Google login → backend 500 → frontend ukáže  
"Google účet X nie je povolený, požiadaj admina o prístup". User v DB pritom JE.

## Diagnóza (chain)
1. Aleš v hokymscytscsewrpwdjf.**auth.users** → existuje, `last_sign_in_at=2026-06-03` (Google OAuth flow fungoval, JWT sa vydal)
2. Aleš v hokymscytscsewrpwdjf.**public.users** → existuje, `login_email=ales.machovic@gmail.com`, role=super_admin
3. `/api/auth/google/match` real JWT test → **500 "column users.totp_enabled_at does not exist"**
4. Schema dump public.users → totp_* stĺpce CHÝBAJÚ

## Fix (commit a4a3ef0)
**Code-side:** `src/app/api/auth/google/match/route.ts` — tolerant SELECT. Skús full
SELECT (s `totp_enabled_at`); pri schema mismatch fallback na legacy SELECT bez totp.
Žiadna regresia v dev (full path tam stále funguje).

**Verifikácia po deploye:**
```
POST /api/auth/google/match { supabase_jwt: <real_jwt> }
→ 200 {"user":{"id":"ales","name":"Aleš Machovič","initials":"AM",
       "role":"super_admin","company_id":"a0000000-..."}}
```

---

## ČO MUSÍŠ RÁNO SPRAVIŤ TY (5 min)

### 1) Spusti SQL migráciu v Supabase Dashboard

Pridá totp_* stĺpce do public.users + auth_2fa_challenges tabuľku.  
Bez toho **2FA setup neviete použiť** (nastavenia/security stránka). Login funguje aj bez toho.

**Postup:**
1. https://supabase.com/dashboard → projekt **hokymscytscsewrpwdjf** (PROD!)
2. SQL Editor → New query
3. Skopíruj obsah súboru `sql/migrations/2026-06-03-add-totp-columns.sql` (v repe)
4. Run
5. Mali by si vidieť: "Success. No rows returned."

Migrácia je **idempotentná** (`IF NOT EXISTS`) — bezpečná spustiť aj viackrát.

### 2) Otestuj broker login

Vyskúšaj v incognito (Cmd+Shift+N) https://vianema.amgd.sk :
- **Tvoj Google login** (`ales.machovic@gmail.com`) — má prejsť priamo na dashboard
- **Patrícia Osmolská password** — `osmolska@vianema.eu` + heslo + captcha → má prejsť

### 3) Daj vedieť Žigovej že má login `ninazigova@gmail.com`

V screenshote včera Žigová zadala `zigova@vianema.eu` ale jej **login_email v DB je `ninazigova@gmail.com`**.  
Buď jej daj vedieť správny email, alebo jej v DB zmeň login_email na `zigova@vianema.eu`.

---

## Bonus zistenia (rotácia keys)

⚠ **Legacy Supabase JWT keys (anon + service_role) sú teraz v Claude conversation history** ako aj  
v zhrnutí. Treba ich časom rotovať v Supabase Dashboard → Settings → API → "Reset API keys"  
a nahodiť nové do Vercel env vars. Ale **NIE skôr než po raňajšom testovaní** — keď to teraz ide,  
necháme to tak. Rotácia = další ~10 min downtime.

---

## Survey: kto má aké login_email v prod (12 users)

| Meno                          | login_email                       | role        | heslo |
|-------------------------------|-----------------------------------|-------------|-------|
| Aleš Machovič                 | ales.machovic@gmail.com           | super_admin | YES   |
| Ing. Nina Žigová              | ninazigova@gmail.com              | makler      | YES   |
| Jaroslav Rajčan               | rajcan@vianema.eu                 | makler      | YES   |
| Mgr. Katarína Šemberová       | semberova@vianema.eu              | makler      | YES   |
| Mgr. Slavomír Kollár          | slavomrk@gmail.com                | makler      | YES   |
| Nikol Šmahajčíková            | smahajcikova@vianema.eu           | makler      | YES   |
| Nikoleta Szalayova            | szalayova@vianema.eu              | makler      | YES   |
| Patrícia Osmolská             | osmolska@vianema.eu               | makler      | YES   |
| Peter Krampl                  | krampl@vianema.eu                 | makler      | **NO**|
| Rastislav Michalina           | rastislav.michalina@gmail.com     | makler      | YES   |
| Silvia Hurová                 | lets.eventing@gmail.com           | makler      | YES   |
| Test                          | uctovnictvo686@gmail.com          | majitel     | YES   |

⚠ **Peter Krampl nemá heslo** — môže prihlásiť iba ak by mal Google Workspace `krampl@vianema.eu`.  
Ak nie, treba mu cez Aleša nastaviť heslo (alebo dohodnúť že použije iný email).

---

— Claude (Opus 4.7 1M), 03:30 CEST
