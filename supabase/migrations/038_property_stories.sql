-- 038_property_stories.sql
--
-- Etapa E: log AI-generovaných inzerátových popisov (Property Story).
-- 3-layer pipeline (Generator → Validator → Auditor) → každý beh logujeme
-- aby sme mohli sledovať: cenu prevádzky, kvalitu, čo sa najčastejšie
-- porušuje, a v budúcnosti to použiť na fine-tuning promptov.

BEGIN;

CREATE TABLE IF NOT EXISTS property_stories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text REFERENCES users(id) ON DELETE SET NULL,
  klient_id           uuid REFERENCES klienti(id) ON DELETE SET NULL,
  nehnutelnost_id     uuid REFERENCES nehnutelnosti(id) ON DELETE SET NULL,

  input_data          jsonb NOT NULL,    -- vlastnosti nehnuteľnosti + CMA + sentiment

  -- Layer 1: Generator (Claude, kreatívny)
  generator_output    text NOT NULL,
  generator_tokens    integer DEFAULT 0,

  -- Layer 2: Validator (Claude, disciplinovaný — clichés, rule of 3, feeling)
  validator_output    text NOT NULL,
  passed_first_attempt boolean DEFAULT false,
  violations_count    integer DEFAULT 0,
  violations_breakdown jsonb,

  -- Final approved copy (po validator korektúrach)
  final_copy          text NOT NULL,

  -- Layer 3: Auditor (JSON quality scores)
  quality_scores      jsonb,
  overall_quality     integer DEFAULT 0, -- 1-10

  -- Pricing context
  recommended_price   numeric,
  strategy_used       text,
  rarity_score        integer,

  -- Status
  final_status        text DEFAULT 'requires_human_review',
  -- approved_first_pass | approved_after_revision | requires_human_review
  used_in_listing     boolean DEFAULT false,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_stories_user ON property_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_property_stories_nehn ON property_stories(nehnutelnost_id);
CREATE INDEX IF NOT EXISTS idx_property_stories_status ON property_stories(final_status);
CREATE INDEX IF NOT EXISTS idx_property_stories_created ON property_stories(created_at DESC);

ALTER TABLE property_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_read_property_stories ON property_stories
  FOR SELECT TO anon USING (true);
CREATE POLICY service_role_all_property_stories ON property_stories
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
