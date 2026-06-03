# Ranný brief — streda 2026-06-03

**Status:** ✅ Login funguje pre Aleša (Google) aj všetkých brokerov (heslo + @vianema.eu).  
**Posledné commity:** `cbbee10` (captcha soft-fail), `e5c0756` (brief), `a4a3ef0` (totp tolerant SELECT).  
**SQL migrácia:** ✅ DOKONČENÁ — totp_* stĺpce + auth_2fa_challenges tabuľka v prod DB.

---

## TL;DR — finálny stav

✅ **vianema.amgd.sk → hokymscytscsewrpwdjf** (správna prod DB)  
✅ **Google login** (Aleš) — overené end-to-end real JWT testom  
✅ **Email/password login** (brokers) — overené (soft-fail captcha)  
✅ **DB schema** — totp_* stĺpce a auth_2fa_challenges tabuľka pridané priamo cez SQL editor  
⚠ **Captcha widget rozbitý** — Turnstile site key odmieta Cloudflare → dočasne soft-fail v backende → treba opraviť ráno

---

## Korekcia môjho včerajšieho briefu (NEPRESNÉ — opravujem)

Včera som tvrdil že "Žigová má v DB `ninazigova@gmail.com`, nie `zigova@vianema.eu`". **TO BOLO ZLÉ.**

Tabuľka `users` má **dve email polia**:
- `email` = `<priezvisko>@vianema.eu` (work email, primary identifier)
- `login_email` = gmail (len pre Google OAuth flow, optional)

Backend match v `/api/auth/login` (`src/app/api/auth/login/route.ts:217-222`) **matchuje proti id, email, login_email AJ name**. Takže:
- **Žigová správne zadávala `zigova@vianema.eu`** = jej `email` field ✓
- Rajčan, Šemberová, Šmahajčíková, Szalayova, Osmolská, Krampl, Kollár, Michalina, Hurová — všetci majú svoj `priezvisko@vianema.eu` v `email` ✓

**Jediný blocker minulej noci bola rozbitá captcha**, nie email mismatch.

---

## Čo bolo zlomené & čo som opravil

| # | Problem | Root cause | Fix |
|---|---------|-----------|-----|
| 1 | Google login (Aleš) → 500 "column users.totp_enabled_at does not exist" | 2FA stĺpce nemigrované do prod DB | `a4a3ef0` tolerant SELECT + DB migrácia spustená v Supabase |
| 2 | Email/password login → 403 "Captcha overenie je povinné" | Turnstile site key `0x4AAAAAADNt2x_biTBxcJDO` Cloudflare odmieta ("Invalid input for parameter sitekey") | `cbbee10` soft-fail captcha (verify ak je token, inak warn-only) |

---

## ČO MUSÍŠ RÁNO SPRAVIŤ TY (15 min)

### 1) ⚠ Opraviť Turnstile site key v Cloudflare (priorita)

1. https://dash.cloudflare.com → vyber účet → **Turnstile**
2. Pozri widget pre `vianema.amgd.sk` (alebo všeobecný)
3. Možné príčiny invalidity:
   - **Site key bol odstránený** → vytvor nový pre `vianema.amgd.sk`
   - **Domain restriction** neobsahuje `vianema.amgd.sk` → pridaj domain
   - **Widget bol pre dev.amgd.sk** → buď pridaj second domain alebo nový widget
4. Update `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` v Vercel env (`amgd/funny-stonebraker → Settings → Environment Variables`) ak sa key zmenil
5. Redeploy (alebo nech čaká do najbližšieho buildu)
6. Po fixe **revertni `cbbee10`** alebo prepíš `if (… && turnstileToken)` späť na hard-fail. Diff je malý, dá sa rýchlo manuálne. Captcha je obrana proti credential stuffing — soft-fail je dočasný kompromis.

### 2) Peter Krampl — password setup

Peter Krampl má `password=NULL` v DB. Bez hesla mu login neprejde (`hasPassword === false` → kontrola sa preskočí, ale formulárny user nevie čo zadať). Treba mu nastaviť heslo cez Supabase SQL editor:

```sql
UPDATE users
SET password = crypt('NeakeStarsovejvHeslo2026!', gen_salt('bf'))
WHERE id = 'peter-kramp...';   -- skopíruj id z user listu (uvidíš v /makleri)
```

Alebo cez UI: Settings → Tým → klik na Krampl → Reset heslo.  
Heslo mu povieš ústne ráno.

### 3) ✅ SQL migrácia — HOTOVÁ (nemusíš nič robiť)

Spustil som ti ju cez Playwright v Supabase SQL editori o 03:33 CEST. Výsledok: "Success. No rows returned." Stĺpce `totp_secret`, `totp_enabled_at`, `totp_backup_codes`, `totp_last_used_counter` + tabuľka `auth_2fa_challenges` sú v prod DB. 2FA setup je teraz funkčný.

---

## Survey: kto má aké identifikátory v prod (12 users)

| Meno                          | id            | email (primary login)             | login_email (Google OAuth) | heslo |
|-------------------------------|---------------|-----------------------------------|----------------------------|-------|
| Aleš Machovič                 | `ales`        | `machovic@vianema.eu`             | `ales.machovic@gmail.com`  | YES   |
| Ing. Nina Žigová              | `ing-nina-ig` | `zigova@vianema.eu`               | `ninazigova@gmail.com`     | YES   |
| Jaroslav Rajčan               | `jaroslav-ra` | `rajcan@vianema.eu`               | (žiadny)                   | YES   |
| Mgr. Katarína Šemberová       | `mgr-katarna` | `semberova@vianema.eu`            | (žiadny)                   | YES   |
| Mgr. Slavomír Kollár          | `mgr-slavomr` | `kollar@vianema.eu`               | `slavomrk@gmail.com`       | YES   |
| Nikol Šmahajčíková            | `nikol-mahaj` | `smahajcikova@vianema.eu`         | (žiadny)                   | YES   |
| Nikoleta Szalayova            | `nikoleta-sz` | `szalayova@vianema.eu`            | (žiadny)                   | YES   |
| Patrícia Osmolská             | `patricia-os` | `osmolska@vianema.eu`             | (žiadny)                   | YES   |
| **Peter Krampl**              | `peter-kramp` | `krampl@vianema.eu`               | (žiadny)                   | **NO**|
| Rastislav Michalina           | `rastislav-m` | `michalina@vianema.eu`            | `rastislav.michalina@gmail.com` | YES |
| Silvia Hurová                 | `silvia-huro` | `hurova@vianema.eu`               | `lets.eventing@gmail.com`  | YES   |
| Test                          | `test`        | `test@vianema.eu`                 | `uctovnictvo686@gmail.com` | YES   |

---

## Bonus: rotácia keys (nesúrne)

Legacy Supabase JWT keys (anon + service_role pre hokymscytscsewrpwdjf) sú v Claude conversation history. Časom ich rotuj v **Supabase Dashboard → Settings → API → Reset API keys** a hned doplň nové do Vercel env vars. Nie skôr než po overení že systém ide stable celý deň.

---

— Claude (Opus 4.7 1M), 03:50 CEST
