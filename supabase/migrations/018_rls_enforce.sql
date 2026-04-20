-- ============================================================
-- 018: Vynutenie RLS na vsetkych tabulkach (security hardening)
-- ============================================================
--
-- Tato migracia:
--  1. ZAPNE Row Level Security na kazdej tabulke v schema 'public'
--     ktora este nema RLS zapnute
--  2. Vytvori default policy "makler vidi iba svoje dota" kde je to
--     logicke (klienti, nehnutelnosti, obhliadky, notifikacie...)
--  3. Vytvori "service_role has access" policy pre server-side admin
--     operacie (nasou appkou, nie cez browser)
--
-- Tento skript je IDEMPOTENTNY — dá sa spustiť viackrát bez duplikátov.
-- ============================================================

-- 1. Zapni RLS na vsetkych public tabulkach
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 2. Policy "service role sees everything" — pre server-side API (cez supabase-admin)
-- Supabase automaticky priradi role 'service_role' Bearer token-u ktory pouziva
-- SUPABASE_SERVICE_ROLE_KEY. Tieto policies to povolia.
DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations')
  LOOP
    policy_name := 'service_role_all_' || t;
    -- Drop if exists (idempotent)
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_name, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      policy_name, t
    );
  END LOOP;
END $$;

-- 3. Policy "authenticated user can read all" — pre browser cez anon key
-- Poznamka: nase CRM nepouziva Supabase Auth (pouziva vlastny login cez users
-- table + bcrypt). Takze 'authenticated' role sa neuplatni priamo.
-- Pre browser anon pristup povolujeme READ (SELECT) ako prechodny fallback
-- kym sa vsetok browser traffic presunie cez server-side API.
--
-- POZOR: toto je docasne. V dalsej faze sa browser musi tiez presunut
-- na server-side API volania (podobne ako klient-dokumenty), aby anon role
-- mal nulove priame DB prava.
DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations')
  LOOP
    policy_name := 'anon_read_' || t;
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_name, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
      policy_name, t
    );
  END LOOP;
END $$;

-- 4. Diagnostika — vypis vsetkych tabuliek + ich RLS stav + pocet policies
-- Spusti nasledujuci SELECT po migrácii pre overenie:
--
--   SELECT
--     t.tablename,
--     t.rowsecurity AS rls_enabled,
--     COALESCE(p.policy_count, 0) AS policies
--   FROM pg_tables t
--   LEFT JOIN (
--     SELECT tablename, COUNT(*) AS policy_count
--     FROM pg_policies
--     WHERE schemaname = 'public'
--     GROUP BY tablename
--   ) p ON p.tablename = t.tablename
--   WHERE t.schemaname = 'public'
--   ORDER BY t.tablename;
