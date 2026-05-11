-- ============================================================
-- 048: Zruš všetky anon_read_* politiky (security hardening)
-- ============================================================
-- Dôvod: anon kľúč je verejný (v JS bundle). Ktokoľvek bez
-- prihlásenia mohol čítať celú databázu vrátane users, faktúr,
-- klientov, obhliadok, OAuth tokenov.
--
-- Po tejto migrácii: anon rola nemá žiadne SELECT práva.
-- Všetky browser requesty musia ísť cez Next.js API routes
-- (service_role key, server-only).
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'anon_read_%'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      pol.policyname, pol.tablename
    );
  END LOOP;
END $$;

-- Overenie: po spustení by mal tento SELECT vrátiť 0 riadkov:
-- SELECT policyname, tablename FROM pg_policies
-- WHERE schemaname = 'public' AND policyname LIKE 'anon_read_%';
