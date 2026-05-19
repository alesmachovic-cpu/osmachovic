# Doména: AI nástroje

> **Owner**: Mgr. Eva Šimonová (E012) — Tech Lead. Backup: Mgr. Veronika Kuchárová (E019) — Brand.
> Po zmene spusti `scripts/audit-ai.sh`. Brand voice = vždy review Veronikou.

## Účel
AI nástroje šetria maklerovi hodiny: **AI Writer** (Property Stories), **parse-doc** (LV/posudok auto-fill), **AI analýza okolia** (lokalita insights), **AI matching** (semantic match klient ↔ ponuka), **AI fill formulárov**.

Bez AI: maklér ručne píše, copy-paste z LV, manuálne počíta priemery → 10× pomalšie.

---

## ✓ INVARIANTS

### API kľúče
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` = **server-only**. NIKDY v klient bundle.
- Validácia v audit script (E004 Lukáš robí static analysis tiež).
- Rotation: kvartálne.

### Property Stories formát (z CLAUDE.md)
Striktný 4-časťový output:
- `[The Hook]` — 1 veta hlavička
- `[The Lifestyle]` — 3 krátke odstavce
- `[The Investment Logic]` — 1 veta o ekonomike
- `[Social Snippet]` — 2-vetová verzia pre IG/WhatsApp

Validácia regex pred save. Ak nezodpovedá → retry s explicit prompt fix.

### Brand voice (z CLAUDE.md)
**Zakázané frázy**: "vysnívaný domov", "jedinečná príležitosť", "exclusive opportunity", "dream home", "must see", atď.
- Post-generation scan. Ak match → regenerate.
- Žiadne emoji v Property Stories (okrem `[Social Snippet]`).

### Fallback chain (cost + reliability)
1. **Anthropic Claude** (primárny — kvalita)
2. **Google Gemini** (fallback — cheap)
3. **OpenAI GPT-4o** (poslední — drahý)

Pri quota exceed alebo timeout → ďalší v reťazi.

### parse-doc (max 300s timeout)
- Vercel maxDuration = 300 (špeciálna výnimka).
- Klient-side PDF rasterization povinná (>10MB by inak timeout-uvalo).
- Output JSON structured (LV: parcely, vlastníci, ťarchy; posudok: cena, plocha, stav).
- **NIKDY surový PDF do API** — vždy rasterized image.

### Cost tracking
- Každý AI call → `ai_usage_log` (TODO tabuľka): user_id, model, tokens_in, tokens_out, cost_usd, endpoint.
- Mesačný report Mária (Financie) — kto míňa, koľko.

---

## ⚠ GAPS

### 1. `ai_usage_log` tabuľka ❌ neexistuje
Žiadny cost tracking. Pri 100 maklerov × 30 inzerátov × Property Story = $$$ neidentifikovaných nákladov. Treba pridať tabuľku + middleware.

### 2. Brand voice blacklist scanner ⚠ čiastočný
Property Story validation existuje v UI ale nie systematicky. Treba pre-save + retry logic v API.

### 3. parse-doc retry s exp backoff ⚠ nie
Pri Anthropic timeout fail tichotne. Treba fallback chain runtime check.

### 4. AI cache pre rovnaké inputy ⚠
Ak parse-doc tej istej LV = 2× Anthropic call. Cache by ušetrila $$$.

### 5. Property Stories test suite ❌
Žiadne unit testy. Pri zmene promptu nevieme či brand voice ešte sedí.

---

## 🔥 HOT FILES

| Súbor | Prečo |
|---|---|
| `src/app/api/ai-writer/route.ts` | Property Stories gen, brand voice validation |
| `src/app/api/parse-doc/route.ts` | LV/posudok parse, 300s timeout |
| `src/app/api/parse-pdf/route.ts` | PDF general parse |
| `src/app/api/analyze/route.ts` | AI analýza okolia |
| `src/lib/ai/*` | Provider abstraction layer |
| `src/components/PropertyStoryModal.tsx` | UI pre Property Story flow |

---

## 🧪 Audit

```bash
./scripts/audit-ai.sh
```

1. API kľúče NIE sú v klient bundle
2. parse-doc maxDuration = 300
3. Property Story format regex test (sample input)
4. Brand voice blacklist scanner aktívny
5. Fallback chain configured (Anthropic → Gemini → OpenAI)

---

## 📌 TODO

- [ ] `ai_usage_log` tabuľka + middleware (P1) — vidí kto míňa
- [ ] Brand voice blacklist v API (pre-save validation + retry) (P1)
- [ ] parse-doc fallback chain explicit (P2)
- [ ] AI response cache pre idempotentné inputy (P2)
- [ ] Property Stories test suite (P3)

---

## História incidentov

- **2026-05-18** Monitor AI Analýza padla React #31 (objekt render). Príčina: backend ukladal `evidence` ako object, frontend type bol `string`. Fix: `formatEvidence()` helper. Commit `5ecc967`. (Aj v doméne Monitor.)
