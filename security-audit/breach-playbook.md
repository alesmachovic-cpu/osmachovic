# Breach Playbook — postup pri úniku osobných údajov (Vianema s.r.o.)

**Účel:** Čo presne robiť, keď dôjde (alebo môže dôjsť) k úniku osobných údajov klientov.
**Zákonný základ:** GDPR čl. 33 (ohlásenie ÚOOÚ do 72 h), čl. 34 (informovanie dotknutých osôb), zákon 18/2018 Z.z. § 40–41.
**Verzia:** 1.0 (2026-06-03) · **Zodpovedná osoba:** Aleš Machovič (CEO) · **Kontakt:** security@vianema.sk

> ⚠️ **72-hodinová lehota beží od momentu, keď sa o porušení DOZVIEME** — nie od momentu kedy nastalo. Preto: čím skôr začať, tým lepšie. Pri pochybnosti radšej ohlás.

---

## 0. Čo je „porušenie ochrany osobných údajov" (breach)
Akékoľvek narušenie bezpečnosti vedúce k **náhodnému alebo nezákonnému**:
- **zničeniu / strate** údajov (zmazaná DB, stratený notebook, ransomware), alebo
- **zmene** údajov, alebo
- **neoprávnenému prístupu / sprístupneniu** (hacker, omylom poslaný e-mail, zle nastavené práva, leak cez chybu v appke).

Týka sa to **osobných údajov** = mená, telefóny, e-maily, adresy, rodné čísla, OP/LV scany, AML dokumentácia klientov.

---

## 1. OKAMŽITÉ KROKY (prvá hodina) — zastaviť únik

1. **Zachovaj pokoj a nič nezahládzaj.** Neprepisuj logy, neviaž sa zmazať dôkazy.
2. **Zastav únik (containment):**
   - Únik cez appku/chybu → kontaktuj vývoj (Claude/dev), zhodnoť či treba **kill-switch** (napr. vypnúť dotknutý endpoint, `AI_PARSE_ENABLED=false`, dočasne stiahnuť deploy).
   - Kompromitovaný účet → **okamžite zmeň heslo, odhlás všetky session, zapni/over 2FA**.
   - Stratený/ukradnutý notebook/telefón → vzdialené vymazanie ak možné, zmena hesiel.
   - Omylom poslaný e-mail → požiadaj príjemcu o vymazanie (nezakladá to splnenie povinnosti, len mitigácia).
3. **Zapíš čas a okolnosti** — kedy si sa dozvedel, ako, čoho sa to týka. (Šablóna v sekcii 7.)

## 2. ESKALÁCIA (interný reporting)
- Každý zamestnanec, ktorý zistí možný únik, **bezodkladne** nahlási **zodpovednej osobe (CEO)** — e-mail security@vianema.sk + telefón.
- CEO koordinuje ďalší postup, prizve vývoj (technická analýza) a v prípade potreby právnika.

## 3. POSÚDENIE RIZIKA (do niekoľkých hodín)
Zhodnoť **rozsah a závažnosť**:
- **Aké údaje** unikli? (bežné kontakty vs. citlivé — rodné čísla, OP, AML, LV)
- **Koľko osôb** je dotknutých?
- **Komu** sa údaje dostali? (interný omyl / cudzí maklér / verejný internet / útočník)
- **Aký dopad** hrozí dotknutým? (krádež identity, podvod, ujma)

Z toho vyplýva, či a koho treba informovať:

| Situácia | Ohlásiť ÚOOÚ (čl.33)? | Informovať klientov (čl.34)? |
|---|---|---|
| Únik bez rizika pre osoby (napr. zašifrované dáta, interná chyba bez prístupu tretích) | Nie (ale **zdokumentuj prečo**) | Nie |
| Bežné riziko (kontakty, e-maily) | **Áno, do 72 h** | Nie (ak nie vysoké riziko) |
| Vysoké riziko (rodné čísla, OP/LV/AML scany, citlivé dáta, veľký rozsah) | **Áno, do 72 h** | **Áno, bezodkladne** |

> Pri pochybnosti o riziku → **ohlás ÚOOÚ**. Neohlásenie keď sa malo je horšie než ohlásenie navyše.

## 4. OHLÁSENIE ÚOOÚ (do 72 hodín) — čl. 33
- **Kam:** Úrad na ochranu osobných údajov SR — formulár na **dataprotection.gov.sk** (online ohlásenie) alebo dátová schránka / písomne.
- **Lehota:** do **72 hodín** od zistenia. Ak nestíhaš kompletné info, ohlás **čo vieš teraz** a doplň neskôr (čl. 33 ods. 4 — postupné ohlásenie je povolené).
- **Čo uviesť (čl. 33 ods. 3):**
  1. Povaha porušenia (čo sa stalo).
  2. Kategórie a **približný počet** dotknutých osôb.
  3. Kategórie a približný počet dotknutých záznamov.
  4. Kontakt na zodpovednú osobu (security@vianema.sk).
  5. Pravdepodobné **následky** porušenia.
  6. Prijaté / navrhované **opatrenia** na nápravu a zmiernenie.

## 5. INFORMOVANIE DOTKNUTÝCH OSÔB (pri vysokom riziku) — čl. 34
- **Kedy:** keď porušenie pravdepodobne vedie k **vysokému riziku** pre práva a slobody osôb.
- **Ako:** priamo (e-mail / telefón / list) — **bezodkladne**, jasným jazykom.
- **Čo uviesť:** čo sa stalo, aké údaje, aké následky hrozia, čo robíme, čo môže klient urobiť (napr. zmeniť heslá, dať pozor na podvodné e-maily), kontakt na nás.
- **Výnimka:** netreba informovať individuálne, ak boli dáta zašifrované/nečitateľné, alebo ak by to vyžadovalo neprimerané úsilie (vtedy verejné oznámenie).

## 6. DOKUMENTÁCIA (vždy, aj keď sa neohlasuje) — čl. 33 ods. 5
Veď **register porušení** — pre KAŽDÝ incident zaznamenaj:
- dátum/čas zistenia a vzniku, popis, dotknuté údaje a osoby, posúdenie rizika,
- rozhodnutie či sa ohlasovalo (a prečo áno/nie), prijaté opatrenia, poučenie do budúcna.

Tento register musí byť k dispozícii ÚOOÚ na kontrolu. (Aj „neohlásený" incident musí mať záznam s odôvodnením.)

## 7. ŠABLÓNA — interný záznam incidentu
```
INCIDENT #____
Dátum/čas zistenia:
Kto zistil / ako:
Čo sa stalo (popis):
Dotknuté údaje (typy):           [kontakty / rodné č. / OP / LV / AML / iné]
Počet dotknutých osôb (odhad):
Komu sa údaje dostali:
Posúdenie rizika:                [žiadne / bežné / vysoké]
Containment opatrenia + čas:
Rozhodnutie ÚOOÚ:                 [ohlásené dňa __ / neohlásené — dôvod __]
Rozhodnutie klienti (čl.34):     [informovaní dňa __ / nie — dôvod __]
Nápravné opatrenia:
Poučenie / prevencia do budúcna:
Zodpovedný:
```

## 8. ŠABLÓNA — oznámenie dotknutej osobe (čl. 34)
```
Predmet: Dôležité — bezpečnostné upozornenie k Vašim údajom

Vážený/á [meno],
informujeme Vás, že dňa [dátum] došlo k bezpečnostnému incidentu, pri ktorom
mohlo dôjsť k [popis: napr. neoprávnenému prístupu k Vašim kontaktným údajom].
Čoho sa to týka: [typy údajov].
Aké riziko hrozí: [napr. možné podvodné e-maily/telefonáty].
Čo sme urobili: [opatrenia].
Čo odporúčame Vám: [napr. buďte ostražití pri neznámych e-mailoch, nezdieľajte
heslá]. V prípade otázok nás kontaktujte: security@vianema.sk.
S pozdravom, Vianema s.r.o.
```

## 9. TYPICKÉ SCENÁRE PRE VIANEMU
| Scenár | Prvá reakcia |
|---|---|
| Chyba v appke sprístupnila cudzie dáta (IDOR/leak) | Kill-switch / hotfix endpointu, zisti z audit logu kto pristúpil, posúď rozsah |
| Kompromitovaný účet makléra | Reset hesla, odhlásenie session, 2FA, kontrola audit logu jeho akcií |
| Stratený notebook/telefón s prístupom | Zmena hesiel, vzdialené vymazanie, over čo bolo dostupné |
| Omylom poslaný e-mail s dátami klienta | Žiadosť o vymazanie, posúdenie rozsahu, dokumentácia |
| Únik cez AI/3rd-party (Drive, Supabase) | Kontakt s poskytovateľom, zisti rozsah, posúď DPA/notifikačné povinnosti subprocesora |
| Ransomware / zničenie DB | Obnova zo zálohy (Supabase PITR 7 dní), posúď či došlo aj k exfiltrácii |

## 10. PO INCIDENTE — prevencia
- **Root-cause analýza** (nie len záplata symptómu).
- Pridať **regression check / audit** aby sa daný typ úniku už nezopakoval (napr. `audit-all.sh`).
- Aktualizovať tento playbook ak sa ukázala medzera.
- Doplniť reálne dátumy na verejnú stránku `/bezpecnost`.

---

**Skratka pri panike:** 1) Zastav únik. 2) Zapíš čas. 3) Volaj CEO. 4) Posúď riziko. 5) Do 72 h ÚOOÚ ak je riziko. 6) Klientov ak je vysoké riziko. 7) Všetko zdokumentuj.
