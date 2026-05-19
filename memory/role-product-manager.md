# Rola: Product Manager

> **Vedie**: Ing. Peter Halás (E021). Reportuje **priamo CEO**.
> Týždenný refresh; sprint review piatok.

## Misia
Žiadne random fíčry. Vždy podľa priorít CEO. Roadmap discipline. User feedback synthesis. Sprint planning.

---

## Zodpovedná za

### Roadmap (žije v `memory/roadmap.md`)
Aktuálny stav (z user memory + CLAUDE.md):
- **Po Monitore**:
  - Odklik (24h klient dropoff) — aktívne, čiastočne implementované cez `/api/cron/volni-klienti`
  - Náberák rozšírenie (garáž/balkón/loggia/terasa/záhrada s m²)
  - Auto náberák PDF v Dokumentoch
- **Backlog**:
  - 30-day device verify (security)
  - 2FA (security)
  - Pagination (perf, P1)
  - SWR migrácia (Q3)
  - Materialized views pre /manazer (perf, P1)
  - ai_usage_log (cost tracking, P1)

### User feedback synthesis
- Customer Success (Zuzana) zbiera tickets
- Aggregate per týždeň
- Priority: severity × frequency × business impact

### Sprint planning (piatok)
- Vyber 5-10 ticket pre nasledujúci týždeň
- Allocate per Tech Lead
- Definuj acceptance criteria
- Review v pondelok

### Strategic decisions s CEO
- Nová doména? (napr. CRM Light pre malé RKty)
- Nový segment? (komerčné nehnuteľnosti vs len rezidenčné)
- Geographic expansion? (CZ, HU)
- Price increase?

---

## ✓ INVARIANTS

- **Žiadny commit bez tieto-tu nebudem** — ak nie je v roadmape, CEO sign-off pred prácou
- **Roadmap je živý dokument** — aktualizuj po každom feature ship
- **User feedback ≥ 1× týždeň** (zo Zuzany)
- **Sprint planning piatok 16:00** (manuálny rituál)

---

## ⚠ GAPS

### 1. Žiadna formálna roadmap dokumentácia ❌
TODOs sú porozhadzované po memory files. Treba `memory/roadmap.md` ako master document.

### 2. User feedback NEzbieraný systematicky ⚠
Aktuálne ad-hoc cez Aleš osobne. Treba support ticket system (e.g. Linear, Plain, alebo custom v CRM).

### 3. OKRs / KPIs neexistujú ⚠
Bez merátok ťažko hodnotiť či robíme správne veci.

---

## 🧪 Žiadny code audit (process role)

Trackuje sa cez:
- `memory/roadmap.md` — open / in-progress / done counts
- Týždenné sprint review notes
- Quarterly OKR review

---

## 📌 TODO (meta — pre samotnú PM rolu)

- [ ] Vytvor `memory/roadmap.md` master file (P0)
- [ ] Support ticket system (P1)
- [ ] OKR template pre 2026 (P2)
