-- ============================================================
-- 060: Companies — základ pre multi-tenant SaaS
-- ============================================================
-- Každá realitná kancelária (tenant) má jeden záznam tu.
-- Vianema sa vloží ako prvý tenant.
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,            -- URL-friendly identifikátor (napr. "vianema")
  plan        text NOT NULL DEFAULT 'starter', -- 'starter' | 'pro' | 'enterprise'
  plan_valid_until timestamptz,               -- null = neobmedzené (manuálne spravované)
  stripe_customer_id text,                    -- Stripe customer ID pre billing
  stripe_subscription_id text,               -- aktívna Stripe subscription
  logo_url    text,
  email       text,                           -- kontaktný email kancelárie
  phone       text,
  address     text,
  city        text,
  country     text NOT NULL DEFAULT 'SK',
  is_active   boolean NOT NULL DEFAULT true,
  settings    jsonb NOT NULL DEFAULT '{}',    -- company-level nastavenia (farby, jazyk, ...)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION companies_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS companies_updated_at ON companies;
CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION companies_set_updated_at();

-- Index pre rýchle lookup cez slug (login/routing)
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

-- RLS: service_role má plný prístup, anon nemá nič
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_service_only" ON companies;
CREATE POLICY "companies_service_only" ON companies
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Seed: Vianema ako prvý tenant ────────────────────────────
-- Používame fixné UUID aby 061 mohol naň referencovať
INSERT INTO companies (id, name, slug, plan, email, city, country)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Vianema',
  'vianema',
  'pro',
  'info@vianema.sk',
  'Bratislava',
  'SK'
)
ON CONFLICT (slug) DO NOTHING;
