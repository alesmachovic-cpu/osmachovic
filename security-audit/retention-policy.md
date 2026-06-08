# Politika uchovávania osobných údajov (Retention Policy) — Vianema s.r.o.

**Verzia:** 1.0 (2026-06-03) · **Zodpovedná osoba:** Aleš Machovič (CEO) · **Kontakt:** security@vianema.sk
**Účel:** Definovať, ako dlho a na akom právnom základe uchovávame osobné údaje, a kedy ich mažeme/anonymizujeme. Plní zásadu **minimalizácie uchovávania** (GDPR čl. 5 ods. 1 písm. e).

> Tento dokument je interná politika + odôvodnenie pre prípad kontroly ÚOOÚ. Pri zmene zákonných lehôt aktualizovať.

---

## Prehľad lehôt

| Kategória údajov | Lehota | Právny základ | Po lehote |
|---|---|---|---|
| **Kontakt klienta** (meno, tel., e-mail, lokalita) — bývalí/neaktívni | **7 rokov nečinnosti** | Oprávnený záujem (čl. 6 ods. 1 f) | Anonymizácia (cron F11) |
| **Klienti s marketingovým súhlasom** | Kým trvá súhlas | Súhlas (čl. 6 ods. 1 a) | Po odvolaní → späť na oprávnený záujem, potom 7 r. |
| **Obhliadkové listy** (kontakt kupujúceho, podpis) | **7 rokov** od vytvorenia | Oprávnený záujem (čl. 6 ods. 1 f) | Anonymizácia free-text PII (cron F11) |
| **Dokumenty k nehnuteľnosti** (list vlastníctva, výpis z katastra) | **7 rokov** od poslednej aktivity klienta, resp. po dobu trvania obchodu | Plnenie zmluvy (čl. 6 ods. 1 b) + oprávnený záujem (čl. 6 ods. 1 f) | Zmazanie/anonymizácia (cron F11); `aml_retention=false` |
| **AML dokumentácia** (kópia OP, identifikácia, overenie) | **5 rokov** po skončení vzťahu | Zákonná povinnosť (čl. 6 ods. 1 c) — § 20 zák. 297/2008 | Zmazanie (cron F11) |
| **Faktúry + účtovné doklady** | **10 rokov** | Zákonná povinnosť — § 76 zák. 222/2004 (DPH), § 35 zák. 431/2002 | Anonymizované zostávajú, po 10 r. možno zmazať |
| **Zmluvy (ÚZ/RZ/KZ)** | Po dobu premlčacích lehôt (spravidla do 10 r.) | Plnenie zmluvy + oprávnený záujem (uplatnenie/obhajoba nárokov) | Posúdiť individuálne |
| **Audit log** (prístupy, zmeny) | Append-only (po dobu existencie firmy) | Oprávnený záujem + zákonná povinnosť (forenzná integrita) | Nemaže sa |
| **Anonymizované štatistiky** (história nehnuteľností, ceny) | Neobmedzene | Nie sú osobné údaje | — |

---

## Odôvodnenie 7-ročnej lehoty pre kontakt klienta (oprávnený záujem)

Realitný trh má **dlhý zákaznícky cyklus**: osoba, ktorá dnes predáva nehnuteľnosť, je typicky o niekoľko rokov kupujúcim (a naopak). Priemerný interval medzi realitnými transakciami jednej domácnosti sa pohybuje rádovo v **7–10 rokoch**. Uchovanie kontaktu bývalého klienta po dobu **7 rokov od poslednej aktivity** je preto **primerané a nevyhnutné** na účel opakovaného obchodu — čo je legitímny oprávnený záujem prevádzkovateľa, ktorý neprevažuje nad záujmami dotknutej osoby (klient má vždy právo namietať a žiadať výmaz).

## Čo znamená „nečinnosť" a čo ju resetuje

**Nečinnosť = žiadny živý signál vzťahu** počas lehoty. Hodiny sa **resetujú** pri reálnej interakcii:
- klient **zareaguje** (klik v e-maile „chcem zostať", odpoveď, telefonát),
- **nová obhliadka / obchod / dopyt**,
- udelenie/obnovenie marketingového súhlasu.

⚠️ **Samotné jednostranné odoslanie e-mailu z našej strany NIE je reset** — to nie je dôkaz živého vzťahu. Reset vyžaduje signál od klienta alebo reálny obchodný úkon.

## Mechanizmus mazania (technicky)

- **F11 cron** (`/api/cron/retention-anonymize`): nájde klientov neaktívnych > 7 r., ktorí nie sú v žiadnom obchode (tí majú zákonnú retenciu), a **anonymizuje** ich PII. Vylučuje už anonymizovaných a klientov so zákonnou retenciou.
- **AML doklady**: pri výmaze klienta sa NEmažú (5 r. retencia, `retention_do`); po vypršaní ich F11 zmaže.
- **Default = DRY-RUN** (len report kandidátov); reálne mazanie len pri `RETENTION_ANONYMIZE_ENABLED=true`.

## Práva dotknutej osoby (vždy platia, bez ohľadu na lehoty)
- Právo na **výmaz** (čl. 17) — okrem dát so zákonnou retenciou (AML, dane).
- Právo **namietať** proti oprávnenému záujmu (čl. 21) → na žiadosť skrátime/zmažeme.
- Právo na **prístup** a **prenositeľnosť** (čl. 15, 20) — export cez `/api/gdpr/export?klient_id=`.
- **Odvolanie súhlasu** (čl. 7 ods. 3) kedykoľvek.

---

**Pozn.:** Lehoty over u daňového poradcu / právnika pri väčšej zmene legislatívy (najmä AML retencia 5 vs 10 r. — viď F6/F14).
