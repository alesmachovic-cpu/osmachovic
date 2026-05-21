# Prompt pre Claude — doplniť chýbajúce security hardening

**Kontext:** Po pen-test audite (Opus 4.7, 2026-05-21) dev.amgd.sk dosiahol 8/10 (B+). Tri konkrétne nedostatky chýbajú na 9/10 (A). Tento prompt obsahuje všetko potrebné na ich opravu — file paths, konkrétny kód, verifikačné kroky.

**Cieľ:** Dotiahnuť dev.amgd.sk z 8/10 na 9/10 bez zlomenia produkcie.

---

## Úloha — vykonaj v poradí

### 1. Pridať HSTS header (P1 — kritické, 5 minút)

**Súbor:** `src/middleware.ts` (worktree: `/Users/alesmachovic/Desktop/os-machovic-test/`)

Aktuálne middleware nastavuje CSP, ale nepridáva `Strict-Transport-Security`. Pridaj:

```ts
response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
```

Insert hneď pod existujúci `response.headers.set("Content-Security-Policy", csp);` riadok.

**Verifikácia:**
```bash
curl -sSI https://dev.amgd.sk | grep -i strict-transport
# Očakávaný output: strict-transport-security: max-age=63072000; includeSubDomains; preload
```

**Riziko:** Žiadne — HSTS sa aplikuje len po prvom HTTPS pripojení. preload má 1-year+ commitment ale subdomena `.amgd.sk` už pravdepodobne HSTS má z parent domény.

---

### 2. Vercel Password Protection na dev.amgd.sk (P2, 2 minúty)

Dev prostredie je verejne dostupné. Útočník môže skúšať zraniteľnosti tam bez pozornosti. Riešenie: Vercel Password Protection.

**Akcia (cez Vercel CLI alebo dashboard):**
```bash
# Vercel CLI:
vercel project ls
# nájdi projekt `vianema-dev`
# Zapni cez dashboard: Settings → Deployment Protection → Vercel Authentication (alebo Password)
```

**Pozn.:** Toto vyžaduje Vercel **Pro plan** ($20/mes) pre Password Protection. Free tier má len Vercel Authentication (vyžaduje Vercel account na prístup). Ak nechceš platiť Pro, použiť Vercel Authentication je tiež OK — limituje prístup na Vercel team members.

**Alternatíva bez Pro plánu:** Pridať Basic Auth middleware:
```ts
// src/middleware.ts — pred isAllowedHost check:
if (request.headers.get("host")?.includes("dev.amgd.sk")) {
  const auth = request.headers.get("authorization");
  const expected = `Basic ${Buffer.from(`dev:${process.env.DEV_BASIC_AUTH_PW}`).toString("base64")}`;
  if (auth !== expected) {
    return new NextResponse("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="dev"' },
    });
  }
}
```
+ nastav `DEV_BASIC_AUTH_PW` v Vercel env vars projektu `vianema-dev` (NIE v `funny-stonebraker` ktorý je vianema.amgd.sk PROD).

**Verifikácia:**
```bash
curl -sI https://dev.amgd.sk
# Očakávané: HTTP/2 401 + WWW-Authenticate: Basic
```

---

### 3. Externé overenie (5 minút, žiadne kódovanie)

Po deploye spusti tieto skeny a ulož screenshoty/výstupy do `security-audit/`:

1. **Security headers grade:**
   - https://securityheaders.com/?q=dev.amgd.sk&followRedirects=on
   - Očakávané po HSTS fixe: **A** (predtým A- bez HSTS)

2. **SSL/TLS audit:**
   - https://www.ssllabs.com/ssltest/analyze.html?d=dev.amgd.sk
   - Očakávané: **A+** (Vercel default)

3. **Mozilla Observatory:**
   - https://developer.mozilla.org/en-US/observatory/analyze?host=dev.amgd.sk
   - Tento odhalí aj missing CSP nonces (= úloha 4).

Výstupy zapíš do `security-audit/external-scan-2026-05-21.md`.

---

### 4. (Nepovinné, naplánovať na separate session) Nonce-based CSP

**TL;DR:** Toto je netriviálne refactor (2–4h), môže zlomiť hydration. Neimplementuj v rovnakej PR ako úlohy 1–3.

Súčasná CSP má `'unsafe-inline'` v `script-src`, čo oslabuje XSS ochranu. Next.js bootstrap potrebuje inline scripty.

**Riešenie:** Server-side generated nonce + injektnúť do `next.config.ts` + middleware. Sleduj oficiálnu Next.js dokumentáciu:
https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

**Riziko:** Ak nonce nie je správne propagovaný, React sa nehydratuje. Existujúci comment v `middleware.ts` o tom hovorí:
> "Nonce-based CSP je zámerne vynechané — keď je nonce prítomný, prehliadač ignoruje 'unsafe-inline', čo blokuje Next.js bootstrap inline scripty a React sa nehydratuje."

Predtým to bolo skúšané a nefungovalo. Pred ďalším pokusom over že Next.js 16.1.7 už podporuje nonce flow správne.

---

## Workflow

1. Vytvor feature branch z `dev`:
   ```bash
   cd /Users/alesmachovic/Desktop/os-machovic-test && git checkout dev && git pull && git checkout -b security/hsts-and-dev-protect
   ```

2. Aplikuj úlohu 1 (HSTS) — `src/middleware.ts`.
3. Aplikuj úlohu 2 (basic auth alebo Vercel Pass Protection) — ak basic auth, edituj `src/middleware.ts` + pridaj env var dokumentáciu.
4. Commit:
   ```bash
   git add src/middleware.ts && git commit -m "$(cat <<'EOF'
   feat(security): HSTS header + dev.amgd.sk basic auth ochrana

   - Pridaný Strict-Transport-Security header (max-age=2y, includeSubDomains, preload)
   - dev.amgd.sk teraz vyžaduje basic auth — vianema.amgd.sk PROD ostáva verejne dostupný
   - Posúva nás z 8/10 na 9/10 podľa security-audit/security-comparison-2026-05-21.jpg

   Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
   EOF
   )"
   ```
5. Push + PR proti `dev`:
   ```bash
   git push -u origin security/hsts-and-dev-protect
   gh pr create --base dev --title "feat(security): HSTS + dev basic auth" --body "Closes 2/3 missing items from security audit 2026-05-21."
   ```
6. Po merge do `dev` → Vercel auto-deploy → spusti externé skeny (úloha 3).
7. Pošli mi výsledky.

---

## Constraints (DÔLEŽITÉ — neporušiť)

- ❌ **NEMODIFIKUJ** `vianema.amgd.sk` PROD priamo (CLAUDE.md pravidlo). PROD-only fixy idú cez vlastnú PR po overení na dev.
- ❌ **NEMENI** existujúce CSP `'unsafe-inline'` v tomto PR — to je separate session (úloha 4).
- ❌ Žiadny breaking change na auth flow — pred commitom over že login/logout funguje na dev.
- ✅ Po každej zmene `src/middleware.ts` over že `dev.amgd.sk/api/health` (alebo akýkoľvek API) odpovedá normálne s novými hlavičkami.

---

**Po dokončení úloh 1–3:** dev.amgd.sk by mal dosiahnuť **9/10 (A)** v Opus security re-audite. Úloha 4 (nonce CSP) je samostatný projekt — naplánuj ju do `tasks/lessons.md` alebo `plan.md`.
