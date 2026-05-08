import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/property-story
 * Body:
 *   { nehnutelnost_id?, user_id?,
 *     property?: { typ, lokalita, plocha, izby, stav, features, year_built, popis, ulica },
 *     owner_target_price? }
 *
 * 3-layer AI pipeline (Claude Sonnet 4.5):
 *   Layer 1 — Generator (kreatívny): pricing analýza + property story
 *   Layer 2 — Validator (disciplinovaný): kontrola clichés, rule of three,
 *             feature vs feeling, length discipline, tone
 *   Layer 3 — Auditor (JSON): quality scores, status
 *
 * Cena: ~3 Claude volania, typicky 0.03-0.08 € per popis.
 */

interface PropertyInput {
  typ?: string;
  lokalita?: string;
  plocha?: number;
  izby?: number;
  stav?: string;
  year_built?: number;
  features?: Record<string, boolean | string>;
  popis?: string;
  ulica?: string;
  cena?: number;
}

interface CmaContext {
  active_count: number;
  sold_count: number;
  asking_median_per_m2: number;
  realized_median_per_m2: number;
  asking_to_realized_gap_pct: number | null;
  median_dom: number | null;
  rarity_score: number;
}

interface SentimentContext {
  demand_index: number | null;
  median_dom: number | null;
  active_count: number;
}

async function callClaude(
  system: string,
  user: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<{ text: string; tokens: number } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("[property-story] ANTHROPIC_API_KEY missing"); return null; }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: options?.maxTokens ?? 1500,
        temperature: options?.temperature ?? 0.7,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.error("[property-story] Claude HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    return {
      text: data?.content?.[0]?.text?.trim() || "",
      tokens: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
    };
  } catch (e) {
    console.error("[property-story] Claude error:", e);
    return null;
  }
}

async function buildContext(p: PropertyInput) {
  const sb = getSupabaseAdmin();
  const lokFilter = (p.lokalita || "").split(" ")[0];

  let cma: CmaContext = {
    active_count: 0, sold_count: 0,
    asking_median_per_m2: 0, realized_median_per_m2: 0,
    asking_to_realized_gap_pct: null, median_dom: null, rarity_score: 5,
  };
  let sentiment: SentimentContext = { demand_index: null, median_dom: null, active_count: 0 };

  if (p.typ && p.lokalita && p.plocha) {
    const sizeMin = p.plocha * 0.8, sizeMax = p.plocha * 1.2;
    let activeQ = sb.from("monitor_inzeraty")
      .select("cena, plocha")
      .eq("is_active", true)
      .ilike("lokalita", `%${lokFilter}%`)
      .ilike("typ", `%${p.typ}%`)
      .gte("plocha", sizeMin)
      .lte("plocha", sizeMax)
      .gt("cena", 0);
    if (p.izby != null) activeQ = activeQ.eq("izby", p.izby);
    const { data: active } = await activeQ.limit(50);

    const askingPerM2 = (active || [])
      .map(r => Number(r.cena) / Number(r.plocha))
      .filter(v => Number.isFinite(v) && v > 100 && v < 30000)
      .sort((a, b) => a - b);

    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let soldQ = sb.from("monitor_inzeraty_disappearances")
      .select("estimated_sale_price, last_known_eur_per_m2, total_days_on_market, estimated_discount_pct, monitor_inzeraty!inner(lokalita, typ, plocha, izby)")
      .eq("classification", "likely_sold")
      .gte("confidence_score", 0.6)
      .gte("disappeared_on", yearAgo)
      .ilike("monitor_inzeraty.lokalita", `%${lokFilter}%`)
      .ilike("monitor_inzeraty.typ", `%${p.typ}%`)
      .gte("monitor_inzeraty.plocha", sizeMin)
      .lte("monitor_inzeraty.plocha", sizeMax);
    if (p.izby != null) soldQ = soldQ.eq("monitor_inzeraty.izby", p.izby);
    const { data: sold } = await soldQ.limit(50);

    type SoldRow = { estimated_sale_price: number; last_known_eur_per_m2: number | null; total_days_on_market: number; estimated_discount_pct: number | null };
    const soldRows = (sold || []) as unknown as SoldRow[];
    const realizedPerM2 = soldRows
      .map(s => {
        const a = s.last_known_eur_per_m2 ? Number(s.last_known_eur_per_m2) : null;
        const d = s.estimated_discount_pct != null ? Number(s.estimated_discount_pct) : 0;
        return a && a > 100 && a < 30000 ? a * (1 - d / 100) : 0;
      })
      .filter(v => v > 100 && v < 30000)
      .sort((a, b) => a - b);
    const doms = soldRows.map(s => Number(s.total_days_on_market)).filter(v => v >= 0).sort((a, b) => a - b);

    const med = (a: number[]) => a.length ? a[Math.floor(a.length / 2)] : 0;
    const askingMed = Math.round(med(askingPerM2));
    const realizedMed = Math.round(med(realizedPerM2));
    const totalCmps = askingPerM2.length + realizedPerM2.length;

    cma = {
      active_count: askingPerM2.length,
      sold_count: realizedPerM2.length,
      asking_median_per_m2: askingMed,
      realized_median_per_m2: realizedMed,
      asking_to_realized_gap_pct: askingMed > 0 && realizedMed > 0
        ? Math.round(((askingMed - realizedMed) / askingMed) * 100 * 10) / 10
        : null,
      median_dom: doms.length ? Math.round(med(doms)) : null,
      rarity_score: totalCmps <= 3 ? 9 : totalCmps <= 6 ? 7 : totalCmps <= 10 ? 5 : totalCmps <= 20 ? 3 : 1,
    };

    let sQ = sb.from("market_sentiments")
      .select("demand_index, median_dom, active_count")
      .ilike("lokalita", `%${lokFilter}%`)
      .ilike("typ", `%${p.typ}%`)
      .order("sentiment_date", { ascending: false })
      .limit(1);
    if (p.izby != null) sQ = sQ.eq("izby", p.izby);
    const { data: sentRows } = await sQ;
    if (sentRows?.[0]) {
      sentiment = {
        demand_index: sentRows[0].demand_index ? Number(sentRows[0].demand_index) : null,
        median_dom: sentRows[0].median_dom ? Number(sentRows[0].median_dom) : null,
        active_count: sentRows[0].active_count ? Number(sentRows[0].active_count) : 0,
      };
    }
  }

  return { cma, sentiment };
}

const LAYER1_SYSTEM = `Si Lead Pricing Strategist & Copywriter pre slovenskú realitnú kanceláriu Vianema.
Kombinuješ analytickú prísnosť (CMA, market sentiment) s Apple-style copywritingom:
minimalistický, vysokej intenzity, emotívne ukotvený.

KRITICKÉ — máme TRI cenové referenčné body z nášho monitora:
1. asking_per_m2 — koľko predajcovia pýtajú (často nadhodnotené)
2. realized_per_m2 — odhadovaná skutočná predajná cena (z disappearance detector-a)
3. sentiment trends — kam sa trh hýbe

Použi VŠETKY TRI. Realizačné ceny z nášho monitora sú presnejšie než asking ceny
ktoré používa konkurencia. Spomeň ich explicitne v Investment Logic.

VRÁŤ presne v tomto formáte (Markdown, bez prefixu, slovenčina):

## ČASŤ 1 — CENOVÁ ANALÝZA

### Pozícia na trhu
Max 4 vety. Spomenutie:
- median asking vs median realized per m² (gap)
- comparable_count + days_on_market (likvidita)
- demand_index (horúcosť)
- rarity_label

### Rarity score: X/10
Použi rarity_score zo vstupu. Zdôvodni v 1 vete.

### Odporúčaná stratégia
Vyber JEDNU:
- Agresívna (-3 až -5 %) — keď supply rastie alebo demand_index < 5
- Trhová (CMA median) — keď demand_index 5-7
- Aspirational (+5 až +10 %) — keď rarity ≥ 7 A demand_index ≥ 7

### Finálna odporúčaná cena
Jediné číslo v EUR, zaokrúhlené na psychologické pásmo.

### Risk flags
1-3 konkrétne riziká s číslami zo vstupu.

---

## ČASŤ 2 — PROPERTY STORY

PRÍSNE pravidlá:
- ŽIADNE klišé: "exkluzívna príležitosť", "vysnívaný domov", "musíte vidieť",
  "úchvatný", "dychberúci", "luxusné bývanie", "skrytý klenot", "perfektný",
  "štýlový", "priestranný"
- Pravidlo Troch: presne 3 USPs
- Invisible Tech: feeling, nie features
- Data-Driven: Investment Logic MUSÍ obsahovať konkrétne číslo z dát

### Hook
1 veta, max 18 slov.

### Životný štýl
3 odseky (2-3 vety každý). Každý = 1 USP ako prežitý zážitok.

### Investičná logika
1 veta, max 25 slov. MUSÍ spomenúť aspoň 1 konkrétne číslo z:
- median_days_on_market
- price_change
- demand_index
- rarity_score
- comparable_count

### Sociálny snippet
Presne 2 vety pre Instagram/WhatsApp.

TON: Sophisticated. Sebavedomý. Priamy. Ako Apple píše o produktoch.`;

const LAYER2_SYSTEM = `Si Quality Control editor pre luxusný realitný copy v slovenčine.
Vynucuj prísne pravidlá. Nepridávaj kreativitu — odstráň porušenia.

CHECKLIST (postupne):

1. Cliché Scan — flag a prepíš ak nájdeš:
   exkluzívna príležitosť, vysnívaný domov, dom snov, musíte vidieť,
   úchvatný, ohromujúci, dychberúci, luxusné bývanie, skrytý klenot,
   zasadený, pýši sa, perfektný (popisujúc nehnuteľnosť), štýlový, priestranný

2. Pravidlo troch — [Životný štýl] musí mať presne 3 odseky.

3. Feature vs Feeling — prepíš feature-vety na feeling-vety.
   Zlé: "Okná od podlahy po strop sú orientované na juh."
   Dobré: "Svetlo prichádza skôr ako ty."

4. Data Anchor — [Investičná logika] musí obsahovať aspoň 1 číslo z dát.

5. Length Discipline:
   - Hook: 1 veta, max 18 slov
   - Životný štýl odsek: max 3 vety
   - Investičná logika: 1 veta, max 25 slov
   - Sociálny snippet: presne 2 vety

6. Tone Check — žiadne výkričníky, žiadna predajná dekorácia.

VÝSTUP:

Ak všetky checks prejdú:
Vráť pôvodný text doslovne, prefix: ✅ APPROVED

Ak nejaké zlyhajú:
### Porušenia
- [zoznam s pravidlami a citátmi]

### Opravená verzia
[plný prepísaný Property Story]

Bez komentárov.`;

const LAYER3_SYSTEM = `Si AI Quality Auditor produkujúci štruktúrované audit logy pre náš CRM.

Vstup: 3 bloky — ORIGINAL_INPUT, GENERATOR_OUTPUT, VALIDATOR_OUTPUT.

Vráť IBA validný JSON (žiadny markdown, žiadny preamble) v tomto formáte:

{
  "passed_first_attempt": boolean,
  "violations_count": int,
  "violations_by_category": {
    "cliche": int, "rule_of_three": int, "feature_vs_feeling": int,
    "data_anchor": int, "length": int, "tone": int
  },
  "quality_scores": {
    "hook_strength": int 1-10,
    "lifestyle_authenticity": int 1-10,
    "data_integration": int 1-10,
    "social_snippet_punch": int 1-10,
    "overall_quality": int 1-10
  },
  "final_status": "approved_first_pass" | "approved_after_revision" | "requires_human_review"
}

PRAVIDLÁ:
- overall_quality: cap na 6 ak existujú porušenia
- final_status = "requires_human_review" ak violations_count >= 3 ALEBO overall_quality < 5

Vráť IBA parseable JSON. Náš CRM ho parsuje priamo.`;

function extractFinalCopy(generator: string, validator: string): string {
  if (validator.trim().startsWith("✅ APPROVED")) {
    return generator;
  }
  const marker = "### Opravená verzia";
  if (validator.includes(marker)) {
    return validator.split(marker)[1].trim();
  }
  return generator;
}

export async function POST(req: NextRequest) {
  let body: { nehnutelnost_id?: string; user_id?: string; property?: PropertyInput; owner_target_price?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  // Načítaj property — buď z DB cez nehnutelnost_id alebo priamo z body
  let p: PropertyInput;
  if (body.nehnutelnost_id) {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("nehnutelnosti").select("*").eq("id", body.nehnutelnost_id).single();
    if (error || !data) return NextResponse.json({ error: "Nehnuteľnosť nenájdená" }, { status: 404 });
    p = {
      typ: String(data.typ_nehnutelnosti || "byt"),
      lokalita: String(data.lokalita || ""),
      plocha: Number(data.plocha) || 0,
      izby: data.izby ? Number(data.izby) : undefined,
      stav: data.stav ? String(data.stav) : undefined,
      ulica: data.ulica ? String(data.ulica) : undefined,
      features: {
        balkon: !!data.balkon,
        garaz: !!data.garaz,
        vytah: !!data.vytah,
      },
      popis: data.text_k_cene ? String(data.text_k_cene) : undefined,
      cena: data.cena ? Number(data.cena) : undefined,
    };
  } else if (body.property) {
    p = body.property;
  } else {
    return NextResponse.json({ error: "Treba nehnutelnost_id alebo property" }, { status: 400 });
  }

  if (!p.typ || !p.lokalita || !p.plocha) {
    return NextResponse.json({ error: "Chýba typ, lokalita alebo plocha" }, { status: 400 });
  }

  const t0 = Date.now();

  // 1) Kontext z monitora
  const { cma, sentiment } = await buildContext(p);

  const inputData = {
    property: p,
    cma,
    sentiment,
    owner_target_price_eur: body.owner_target_price ?? null,
    rarity_label: cma.rarity_score >= 7 ? "rare" : cma.rarity_score >= 4 ? "differentiated" : "commodity",
  };

  // 2) LAYER 1 — Generator (kreatívny, opus by bol lepší ale Sonnet stačí)
  const layer1 = await callClaude(
    LAYER1_SYSTEM,
    JSON.stringify(inputData, null, 2),
    { maxTokens: 1800, temperature: 0.7 },
  );
  if (!layer1) return NextResponse.json({ error: "Layer 1 (Generator) zlyhal" }, { status: 500 });

  // 3) LAYER 2 — Validator (disciplinovaný)
  const layer2 = await callClaude(
    LAYER2_SYSTEM,
    layer1.text,
    { maxTokens: 1800, temperature: 0.2 },
  );
  if (!layer2) return NextResponse.json({ error: "Layer 2 (Validator) zlyhal" }, { status: 500 });

  // 4) Final copy — z validatora alebo z generatora ak APPROVED
  const finalCopy = extractFinalCopy(layer1.text, layer2.text);
  const passedFirst = layer2.text.trim().startsWith("✅ APPROVED");

  // 5) LAYER 3 — Auditor (štruktúrovaný JSON)
  const layer3 = await callClaude(
    LAYER3_SYSTEM,
    `ORIGINAL_INPUT:\n${JSON.stringify(inputData)}\n\nGENERATOR_OUTPUT:\n${layer1.text}\n\nVALIDATOR_OUTPUT:\n${layer2.text}`,
    { maxTokens: 800, temperature: 0.1 },
  );
  let audit: Record<string, unknown> = {};
  if (layer3) {
    const m = layer3.text.match(/\{[\s\S]*\}/);
    if (m) {
      try { audit = JSON.parse(m[0]); } catch { /* fallback */ }
    }
  }

  const quality = (audit.quality_scores as Record<string, number> | undefined) || {};
  const overall = quality.overall_quality || (passedFirst ? 8 : 6);
  const violations = (audit.violations_count as number) || (passedFirst ? 0 : 1);
  const violationsBreakdown = audit.violations_by_category || {};
  const finalStatus = (audit.final_status as string) || (passedFirst ? "approved_first_pass" : violations >= 3 ? "requires_human_review" : "approved_after_revision");

  // Cena: ~3 Claude volania, jednoduché odhad
  const totalTokens = (layer1.tokens || 0) + (layer2.tokens || 0) + (layer3?.tokens || 0);

  // 6) Persist log
  const sb = getSupabaseAdmin();
  let storyId: string | null = null;
  try {
    const { data: inserted } = await sb.from("property_stories").insert({
      user_id: body.user_id || null,
      nehnutelnost_id: body.nehnutelnost_id || null,
      input_data: inputData,
      generator_output: layer1.text,
      generator_tokens: layer1.tokens,
      validator_output: layer2.text,
      passed_first_attempt: passedFirst,
      violations_count: violations,
      violations_breakdown: violationsBreakdown,
      final_copy: finalCopy,
      quality_scores: quality,
      overall_quality: overall,
      rarity_score: cma.rarity_score,
      final_status: finalStatus,
    }).select("id").single();
    storyId = inserted?.id || null;
  } catch (e) {
    console.warn("[property-story] log failed:", (e as Error).message);
  }

  return NextResponse.json({
    id: storyId,
    final_copy: finalCopy,
    passed_first_attempt: passedFirst,
    violations_count: violations,
    quality: { ...quality, overall_quality: overall },
    final_status: finalStatus,
    rarity_score: cma.rarity_score,
    cma: {
      active_count: cma.active_count,
      sold_count: cma.sold_count,
      asking_median_per_m2: cma.asking_median_per_m2,
      realized_median_per_m2: cma.realized_median_per_m2,
      asking_to_realized_gap_pct: cma.asking_to_realized_gap_pct,
      median_dom: cma.median_dom,
    },
    sentiment,
    debug: {
      generator_tokens: layer1.tokens,
      validator_tokens: layer2.tokens,
      auditor_tokens: layer3?.tokens || 0,
      total_tokens: totalTokens,
      took_ms: Date.now() - t0,
    },
  });
}
