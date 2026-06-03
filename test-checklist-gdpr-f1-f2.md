# Testovací checklist — F1 (dokumenty) + F2 (parsovanie cez Claude)

Testuj na **dev.amgd.sk**. Cieľ: overiť že (1) parsovanie dokumentov funguje rovnako dobre alebo lepšie ako predtým, (2) prístup ku klientskym dokumentom je nezlomený.

---

## 🅰️ F2 — Parsovanie dokumentov (HLAVNÉ — toto sa najviac zmenilo)

Po novom všetky dokumenty číta **Claude** (predtým Gemini/OpenAI). Treba overiť presnosť na rôznych typoch a kvalitách.

### Kde testovať
1. **Vytváranie inzerátu / nehnuteľnosti** (`InzeratForm`) — nahraj dokument → má autovyplniť polia nehnuteľnosti.
2. **Pridanie klienta z LV** (zoznam Klienti) — nahraj LV → má vytvoriť predávajúcich klientov.
3. **Detail klienta** — parsovanie LV.

### Aké dokumenty nahrať (každý zvlášť)
- [ ] **Reálny LV — digitálny** (stiahnutý z katastra, textové PDF)
- [ ] **Reálny LV — SKEN** (odfotený/naskenovaný, obrázkové PDF) ⭐ najdôležitejší — toto je OCR
- [ ] **Znalecký posudok** (PDF)
- [ ] **Kúpna alebo rezervačná zmluva** (PDF)
- [ ] **Word dokument** (.docx)
- [ ] **Viacstranový dokument** (5+ strán)
- [ ] **LV s viacerými spoluvlastníkmi**
- [ ] **Zámerne zlý vstup** — prázdne / rozmazané / nečitateľné PDF → má dať **zrozumiteľnú chybu**, nie spadnúť ani točiť donekonečna

### Na čo pri každom pozerať
- [ ] Vyplnia sa polia? (plocha, izby, poschodie, rok výstavby, materiál, cena, obec/okres/k.ú.)
- [ ] **Vlastníci správne?** (mená, podiely 1/2, dátumy narodenia)
- [ ] Ťarchy / právne vady (záložné práva, vecné bremená)?
- [ ] Rýchlosť rozumná? (do ~30–50 s; obrázkové skeny dlhšie než textové)
- [ ] Žiadne červené hlásenie / „AI nedokázalo spracovať"
- [ ] Čísla bez jednotiek a logické (nie „65 m²" v poli, nie izby=8 pri garsónke)

> 💡 Ak niektorý typ vyjde slabšie (hlavne skeny), pošli mi aký dokument to bol — viem buď doladiť prompt, alebo prepnúť ten flow na presnejší model (Sonnet).

---

## 🅱️ F1 — Klientske dokumenty (overiť že legitímny prístup nezlomený)

Zmenil som kontrolu prístupu k dokumentom klienta (OP, LV, AML scany). Treba overiť, že bežná práca funguje.

### Kde testovať — Detail klienta
- [ ] Otvor klienta → **načítajú sa jeho dokumenty?** (zoznam OP/LV scanov sa zobrazí)
- [ ] **Nahraj nový dokument** ku klientovi → uloží sa a objaví v zozname?
- [ ] **Otvor/stiahni** existujúci dokument → otvorí sa správny obsah?
- [ ] **Zmaž dokument** (ako majiteľ/admin) → zmaže sa?
- [ ] Priraď dokument k nehnuteľnosti (ak to flow umožňuje) → uloží sa?

### Bezpečnostný test (ak máš dvoch maklérov / dve firmy)
- [ ] Prihlás sa ako maklér firmy A → **nesmieš** vidieť dokumenty klienta firmy B
- [ ] (toto je presne tá diera, ktorú sme zalepili — cudzie OP/LV scany už nesmú byť dostupné)

---

## Ako mi nahlásiť výsledok
Pri každom probléme stačí: **čo si nahral** (typ dokumentu) + **čo vyšlo zle** (prázdne pole / chyba / zlé číslo). Podľa toho doladím. Ak všetko prejde → F1 + F2 uzavreté, ideme na F3.
