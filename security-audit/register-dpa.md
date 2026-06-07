# Register zmlúv o spracúvaní (DPA) a subprocesorov
### podľa čl. 28 GDPR — Vianema s. r. o. (prevádzkovateľ) / Machovic s. r. o. (sprostredkovateľ)

| | |
|---|---|
| **Verzia** | 1.0 |
| **Dátum** | 7. jún 2026 |
| **Zostavil** | Katarína Bartošová (Compliance Officer, E018) |
| **Zodpovedná osoba za DPA agendu** | Aleš Machovič (konateľ) · privacy@vianema.sk |

---

## 1. Hlavná sprostredkovateľská zmluva: Vianema ↔ Machovic (čl. 28)

| Položka | Stav / popis |
|---|---|
| **Prevádzkovateľ** | Vianema s. r. o., IČO 47395095, Karpatské námestie 10A, 831 06 Bratislava |
| **Sprostredkovateľ** | Machovic s. r. o. — prevádzkovateľ a poskytovateľ CRM systému „os-machovic" (SaaS, hosting, údržba, AI integrácie) |
| **Predmet** | Spracúvanie osobných údajov klientov Vianema v mene prevádzkovateľa v rozsahu prevádzky CRM (evidencia klientov, nehnuteľností, obchodov, obhliadok, faktúr, AML dokumentácie, marketingu) |
| **Povinné náležitosti čl. 28 ods. 3** | predmet a doba spracúvania; povaha a účel; typ údajov a kategórie dotknutých osôb; pokyny prevádzkovateľa; mlčanlivosť; bezpečnosť (čl. 32); súhlas s subprocesormi (čl. 28 ods. 2/4); pomoc s právami dotknutých osôb (čl. 12–22) a s čl. 32–36; výmaz/vrátenie údajov po skončení; audit/kontrola |
| **Subprocesori — povolenie** | Vianema udelila všeobecný písomný súhlas so subprocesormi uvedenými v tabuľke nižšie (čl. 28 ods. 2); Machovic informuje o zmenách |
| **Stav DPA** | ⚠️ **NA UZAVRETIE / DOLOŽENIE** — pripraviť písomnú sprostredkovateľskú zmluvu Vianema↔Machovic so všetkými náležitosťami čl. 28; uložiť do repo (`legal/dpa/`) a evidovať podpis oboch strán |
| **Kde získať / vzor** | Vlastný vzor čl. 28 (SK) — vypracovať s právnikom; uložiť podpísaný originál |
| **Zodpovedná osoba** | Aleš Machovič (za oba subjekty — konateľ) + Compliance (K. Bartošová) review |

---

## 2. Register subprocesorov (čl. 28 ods. 4)

Stĺpec „Stav DPA" = či máme doloženú zmluvu/DPA a či je subprocesor uvedený v privacy policy (sekcia 9).

| # | Subprocesor | Účel spracúvania | Krajina / lokalita | Právny základ prenosu | Stav DPA / kde získať | V privacy policy? | Zodpovedná osoba |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase Inc.** | Hosting databázy a úložiska (Storage) — primárne úložisko PII | EÚ — Frankfurt | EHP, prenos mimo EÚ nevzniká | DPA: supabase.com/legal/dpa — **akceptovať/uložiť odkaz** | ✅ áno | Aleš Machovič |
| 2 | **Vercel Inc.** | Aplikačný/serverless hosting (edge + USA), generovanie PDF | EÚ edge + USA (materská) | EU-US DPF + SCC | DPA: vercel.com/legal/dpa — **akceptovať/uložiť** | ✅ áno | Aleš Machovič |
| 3 | **Resend Inc.** | Odosielanie transakčných a marketingových e-mailov (faktúry, PDF, OTP, kampane, notifikácie, pozvánky, kolízie) | USA | EU-US Data Privacy Framework | DPA: resend.com/legal/dpa — **akceptovať/uložiť** | ✅ áno | Aleš Machovič |
| 4 | **Google LLC** | Drive (dokumenty klientov), Gmail (komunikácia), Calendar (termíny), geocoding, Gemini (neosobné analýzy), push (FCM) | USA | EU-US DPF + SCC | Google Cloud/Workspace DPA + Ads Data Processing Terms — **uložiť odkaz** | ✅ áno | Aleš Machovič |
| 5 | **Anthropic PBC** | AI extrakcia z **klientskych/identifikačných dokumentov** (LV, posudky, OP/AML, URL analýza) — Claude | USA | Štandardné zmluvné doložky (SCC) | Anthropic Commercial Terms + DPA (zero-/krátka retencia, no-training) — **doložiť DPA a potvrdiť retenčný režim API** | ✅ áno | Aleš Machovič + Compliance |
| 6 | **OpenAI (OpenAI, L.L.C.)** | AI fallback **len na NEosobné údaje** (copywriting, trhová/cenová analýza, parse fallback) — GPT-4o | USA | EU-US DPF (Data Processing Addendum) | DPA: openai.com/policies/data-processing-addendum — **doplniť do privacy policy + uložiť DPA** | ❌ **NIE — medzera** | Aleš Machovič + Compliance |
| 7 | **Stripe Inc.** | Spracovanie platieb predplatného CRM (billing SaaS — vzťah Machovic↔RK) | USA (EÚ entita Stripe Payments Europe pre EU zákazníkov) | EU-US DPF / SCC | Stripe DPA: stripe.com/legal/dpa — **doplniť do privacy policy + uložiť DPA** | ❌ **NIE — medzera** | Aleš Machovič |
| 8 | **Twilio Inc.** (default SMS) / **Smslogic s. r. o.** (alternatíva) | Doručenie OTP/SMS pri elektronickom podpise (telefónne číslo príjemcu) | Twilio — USA / Smslogic — SR (EÚ) | Twilio: EU-US DPF + SCC / Smslogic: EHP (bez prenosu) | Twilio DPA: twilio.com/legal/data-protection-addendum — **doplniť do privacy policy + uložiť DPA**; pri Smslogic uzavrieť čl. 28 zmluvu (SK) | ❌ **NIE — medzera (Twilio)** | Aleš Machovič |
| 9 | **ScrapingBee SAS** | SaaS scraping konkurenčných inzerátov (obsah stránok vrátane PII predajcu prechádza v prenose, neukladá sa) | Francúzsko/EÚ (over reálnu lokalitu spracovania) | EHP, príp. SCC ak spracovanie mimo EÚ — **OVERIŤ** | DPA ScrapingBee — **doplniť do privacy policy + uložiť DPA + overiť lokalitu** | ❌ **NIE — medzera** | Aleš Machovič + Compliance |
| 10 | **OpenStreetMap / Nominatim** | Geokódovanie adresy nehnuteľnosti pri ukladaní (adresný reťazec) | EÚ (over poskytovateľa/režim) | Over zmluvný režim/DPF — **OVERIŤ** (verejná služba bez DPA) | **Posúdiť** — buď self-host Nominatim, alebo doložiť poskytovateľa s DPA | ❌ nie | Nehnuteľnosti tech lead + Compliance |

> **Push služby prehliadača** (Mozilla autopush, Apple APNs popri Google FCM) sprostredkúvajú doručenie push notifikácií. Voči nim nemáme priamy DPA vzťah (sú súčasťou prehliadača/OS dotknutého makléra); FCM je pokrytý cez Google DPA. Evidované pre úplnosť, nie samostatný subprocesor na uzavretie DPA.

---

## 3. Privacy policy sekcia 9 — synchronizácia s realitou

Aktuálna privacy policy (`src/app/gdpr/page.tsx`, v2.1) v sekcii 9 „Prenosy mimo EÚ/EHP" uvádza **len 5 subprocesorov:** Supabase, Vercel, Resend, Google, Anthropic.

**FINÁLNE ROZHODNUTIE (2026-06-07, po potvrdení CEO):**
- ✅ **DO sekcie 9 doplniť: OpenAI** (fallback AI na neosobné údaje, USA/DPF) + **Nominatim/OSM**
  (geokódovanie adries nehnuteľností).
- ❌ **Stripe — NEPRIDÁVAŤ:** CEO potvrdil, že platby predplatného zatiaľ NEBEŽIA (mimo platby). Pridať
  až keď sa billing zapne.
- ❌ **Twilio — NEPRIDÁVAŤ:** CEO rieši OTP **emailom** (= Resend, už v sekcii 9 nepriamo cez Resend),
  SMS cez Twilio sa nepoužíva. (Fast-follow: odstrániť závislosť na sendSms path — vlastník Náberáky.)
- 🟡 **ScrapingBee — NIE do sekcie 9** (sekcia 9 je o údajoch NAŠICH klientov; ScrapingBee spracúva
  VEREJNÉ konkurenčné inzeráty, nie klientske OÚ). Ostáva v tomto registri + v RoPA Č.16; potenciálne
  PII tretích osôb (predajcovia) z inzerátov rieši samostatná **informačná povinnosť čl. 14 (G26)**,
  navyše sa po migr. 106 NEUKLADÁ. Či je kľúč na prode nastavený overí Bezpecnost (Vercel env).

> Doplnenie sekcie 9 (OpenAI + Nominatim) = zmena právneho textu → **červený protokol**: čaká na
> výslovný súhlas CEO (cez MD), potom Compliance upraví text a ukáže finálne znenie pred commitom.

---

## 4. Akčný zoznam DPA (priority)

| Priorita | Úloha | Vlastník |
|---|---|---|
| P0 | Uzavrieť/doložiť hlavnú sprostredkovateľskú zmluvu Vianema↔Machovic (čl. 28) | Aleš Machovič + Compliance |
| P0 | Potvrdiť Anthropic DPA + zero-/krátka retencia a no-training pre API (klientske dokumenty) | Aleš Machovič + Compliance |
| P1 | Doplniť OpenAI, Stripe, Twilio do privacy policy sekcia 9 + uložiť ich DPA | Compliance (text) + Aleš (súhlas) |
| P1 | Overiť ScrapingBee — lokalitu spracovania, DPA, doplniť do privacy policy | Compliance + Monitor tech lead |
| P2 | Akceptovať/uložiť odkazy na DPA: Supabase, Vercel, Resend, Google | Aleš Machovič |
| P2 | Posúdiť Nominatim (self-host vs poskytovateľ s DPA) | Nehnuteľnosti tech lead |
| P2 | Založiť `legal/dpa/` v repo s evidenciou podpisov a odkazov | Compliance |
