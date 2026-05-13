-- ============================================================
-- 066: GDPR requests table + anonymizačný cron
-- ============================================================

-- 1) Tabuľka pre GDPR žiadosti (prístup, export, vymazanie, oprava, námietka)
CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,
  klient_id   uuid,
  type        text NOT NULL CHECK (type IN ('access','export','erasure','rectification','objection','restriction')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  details     jsonb,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  handled_by    uuid
);

CREATE INDEX IF NOT EXISTS gdpr_requests_user_idx ON public.gdpr_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS gdpr_requests_status_idx ON public.gdpr_requests(status, requested_at DESC);

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_gdpr_requests" ON public.gdpr_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.gdpr_requests IS 'Evidencia GDPR žiadostí od používateľov (čl. 15–22 GDPR). SLA: 30 dní.';

-- 2) Stĺpec anonymizovany na klienti (ak ešte neexistuje)
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS anonymizovany BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS posledna_aktivita TIMESTAMPTZ;

-- 3) Anonymizačné funkcie (spúšťané adminmi alebo pg_cron)

-- Anonymizácia starých obhliadok (> 2 roky)
CREATE OR REPLACE FUNCTION public.anonymize_old_obhliadky()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.obhliadky
  SET
    klient_meno    = 'ANONYMIZED',
    klient_email   = NULL,
    klient_tel     = NULL,
    podpis_blob    = NULL,
    podpis_meta    = NULL
  WHERE created_at < now() - interval '2 years'
    AND klient_meno != 'ANONYMIZED';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Anonymizácia neaktívnych klientov (> 3 roky bez aktivity)
CREATE OR REPLACE FUNCTION public.anonymize_inactive_klienti()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.klienti
  SET
    email         = NULL,
    telefon       = NULL,
    adresa        = NULL,
    poznamka      = NULL,
    anonymizovany = true
  WHERE (posledna_aktivita IS NULL AND created_at < now() - interval '3 years')
     OR (posledna_aktivita < now() - interval '3 years')
     AND anonymizovany = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 4) pg_cron schedule (len ak je pg_cron extension dostupná)
-- Spustite manuálne v Supabase SQL editore ak chcete aktivovať:
--
-- SELECT cron.schedule('anonymize-old-obhliadky', '0 3 * * *',
--   'SELECT public.anonymize_old_obhliadky()');
--
-- SELECT cron.schedule('anonymize-inactive-clients', '0 4 1 * *',
--   'SELECT public.anonymize_inactive_klienti()');
