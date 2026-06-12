-- ════════════════════════════════════════════════════════════════════════════
-- gdpr_requests — PROD DEPLOY SQL (konsolidované 066 + 115 + 116, G33)
-- Pre vianema prod (hokymscytscsewrpwdjf). NÁVRH NA REVIEW — riadený deploy cez MD,
-- Aleš spustí cez dashboard SQL editor keď je pri tom.
--
-- Prečo separátne (nie v reconcile): gdpr_requests chýbalo aj na dev → nebolo v dev
-- snapshot z ktorého reconcile vznikol. breach_register.created_by + parse_failures.
-- actor_id (tiež G33 trieda) SÚ v reconcile skripte (text).
--
-- Zmeny oproti pôvodnej migr 066:
--   • user_id + handled_by = TEXT (NIE uuid) — public.users.id je text pre legacy
--     adminov ('ales'); uuid by zhodilo erasure evidenciu (migr 116). KRITICKÉ.
--   • status CHECK rozšírený o 'completed_with_errors' + 'failed' (migr 115).
--   • BEZ SECURITY DEFINER cron funkcií z 066 (anonymize_old_*) — tie sú s default
--     EXECUTE grantmi anon-RPC volateľné = riziko. NEAPLIKOVAŤ bez REVOKE (samostatný item).
--   • klient_id ostáva uuid (klienti.id je uuid).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text,                    -- public.users.id (text, legacy)
  klient_id    uuid,
  type         text NOT NULL CHECK (type IN ('access','export','erasure','rectification','objection','restriction')),
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','in_progress','completed','completed_with_errors','failed','rejected')),
  details      jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  handled_by   text                     -- public.users.id (text, legacy)
);

CREATE INDEX IF NOT EXISTS gdpr_requests_user_idx   ON public.gdpr_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS gdpr_requests_status_idx ON public.gdpr_requests(status, requested_at DESC);

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_gdpr_requests" ON public.gdpr_requests;
CREATE POLICY "service_role_all_gdpr_requests" ON public.gdpr_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.gdpr_requests IS 'Evidencia GDPR žiadostí (čl. 15–22, čl. 30 RoPA). SLA 30 dní. G33.';
