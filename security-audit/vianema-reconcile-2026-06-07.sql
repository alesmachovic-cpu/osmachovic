-- ════════════════════════════════════════════════════════════════
-- VIANEMA PROD SCHEMA RECONCILIATION (dev → prod hokymscytscsewrpwdjf)
-- Vygenerované 2026-06-07 (Bezpecnost) z diff dev(951 col)/prod dump.
-- 🔴 NÁVRH NA REVIEW — NESPÚŠŤAŤ. Pred aplikáciou ZÁLOHA prod DB (podmienka).
-- Idempotentné (IF NOT EXISTS). BEZ rollback-anon (070/095).
-- OBMEDZENIA: CREATE TABLE = skeleton (chýba PK/FK/DEFAULT/constraints —
--   doplniť z dev migrácií). RLS policies = TODO. NOT NULL stĺpce pridané
--   ako NULLABLE (prod má dáta) → manuálne DEFAULT/backfill, potom SET NOT NULL.
-- ════════════════════════════════════════════════════════════════

-- ─── 1) CHÝBAJÚCE TABUĽKY (7) — skeleton, doplň PK/RLS z dev ───

CREATE TABLE IF NOT EXISTS public.audit_runs (
  id uuid,
  run_at timestamp with time zone,
  source text,
  counts jsonb,
  results jsonb,
  email_summary jsonb
);
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
-- NOT NULL v dev: id, run_at, source, counts, results (doplň po backfille)
-- TODO: PK, FK, DEFAULT, RLS policy (authenticated, company_id scope) z dev migrácie

CREATE TABLE IF NOT EXISTS public.breach_register (
  id uuid,
  company_id uuid,
  detected_at timestamp with time zone,
  occurred_at timestamp with time zone,
  description text,
  data_categories text,
  affected_count integer,
  risk_level text,
  reported_uoou boolean,
  reported_uoou_at timestamp with time zone,
  subjects_notified boolean,
  measures text,
  created_by uuid,
  created_at timestamp with time zone
);
ALTER TABLE public.breach_register ENABLE ROW LEVEL SECURITY;
-- NOT NULL v dev: id, detected_at, description, risk_level, reported_uoou, subjects_notified, created_at (doplň po backfille)
-- TODO: PK, FK, DEFAULT, RLS policy (authenticated, company_id scope) z dev migrácie

CREATE TABLE IF NOT EXISTS public.inzerent_klasifikacia (
  inzerent_id text,
  typ text,
  pridal_user_id text,
  poznamka text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
ALTER TABLE public.inzerent_klasifikacia ENABLE ROW LEVEL SECURITY;
-- NOT NULL v dev: inzerent_id, typ, created_at, updated_at (doplň po backfille)
-- TODO: PK, FK, DEFAULT, RLS policy (authenticated, company_id scope) z dev migrácie

CREATE TABLE IF NOT EXISTS public.klient_preferencie (
  id uuid,
  klient_id uuid,
  company_id uuid,
  druh ARRAY,
  pocet_izieb_min smallint,
  pocet_izieb_max smallint,
  vymera_min integer,
  vymera_max integer,
  typ_konstrukcie ARRAY,
  poschodie text,
  vyzaduje_vytah boolean,
  orientacia ARRAY,
  stav ARRAY,
  zariadenie text,
  kraj text,
  okres text,
  obec text,
  mestska_cast text,
  ulice ARRAY,
  max_km_od_centra smallint,
  ma_balkon boolean,
  ma_pivnicu boolean,
  ma_parkovacie boolean,
  zahrada_min_m2 integer,
  cena_min integer,
  cena_max integer,
  predava_vlastnu boolean,
  vlastna_predaj_suma integer,
  vlastna_predaj_horizont text,
  hotovost_eur integer,
  hypoteka_eur integer,
  hypoteka_banka text,
  hypoteka_predschvalena text,
  casovy_horizont text,
  mhd_pristup boolean,
  mhd_max_metrov smallint,
  blizko_skoly boolean,
  blizko_obchodov boolean,
  ticha_lokalita boolean,
  domace_zvierata boolean,
  poznamka text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
ALTER TABLE public.klient_preferencie ENABLE ROW LEVEL SECURITY;
-- NOT NULL v dev: id, klient_id, company_id, druh, created_at, updated_at (doplň po backfille)
-- TODO: PK, FK, DEFAULT, RLS policy (authenticated, company_id scope) z dev migrácie

CREATE TABLE IF NOT EXISTS public.parse_failures (
  id uuid,
  klient_id uuid,
  company_id uuid,
  actor_id uuid,
  filename text,
  doc_type text,
  source text,
  error text,
  reviewed boolean,
  created_at timestamp with time zone
);
ALTER TABLE public.parse_failures ENABLE ROW LEVEL SECURITY;
-- NOT NULL v dev: id, reviewed, created_at (doplň po backfille)
-- TODO: PK, FK, DEFAULT, RLS policy (authenticated, company_id scope) z dev migrácie

CREATE TABLE IF NOT EXISTS public.qa_smoke_runs (
  id uuid,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  status text,
  duration_ms integer,
  steps jsonb,
  failed_step text,
  error text,
  base_url text,
  triggered_by text,
  cleanup_ok boolean
);
ALTER TABLE public.qa_smoke_runs ENABLE ROW LEVEL SECURITY;
-- NOT NULL v dev: id, started_at, status, steps (doplň po backfille)
-- TODO: PK, FK, DEFAULT, RLS policy (authenticated, company_id scope) z dev migrácie

CREATE TABLE IF NOT EXISTS public.user_pobocky (
  user_id text,
  pobocka_id text,
  created_at timestamp with time zone
);
ALTER TABLE public.user_pobocky ENABLE ROW LEVEL SECURITY;
-- NOT NULL v dev: user_id, pobocka_id, created_at (doplň po backfille)
-- TODO: PK, FK, DEFAULT, RLS policy (authenticated, company_id scope) z dev migrácie

-- ─── 2) CHÝBAJÚCE STĹPCE (36) ───
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS zrusena_at timestamp with time zone;
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS zrusena_dovod text;
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS zrusena_by text;
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS dodavatel_snapshot jsonb;
ALTER TABLE public.firma_info ADD COLUMN IF NOT EXISTS platca_dph boolean;  -- ⚠️ v dev NOT NULL → DEFAULT/backfill, potom SET NOT NULL
ALTER TABLE public.firma_info ADD COLUMN IF NOT EXISTS platca_dph_od date;
ALTER TABLE public.klient_dokumenty ADD COLUMN IF NOT EXISTS aml_retention boolean;  -- ⚠️ v dev NOT NULL → DEFAULT/backfill, potom SET NOT NULL
ALTER TABLE public.klient_dokumenty ADD COLUMN IF NOT EXISTS retention_do date;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS created_by_makler_id uuid;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS zaujem_nehnutelnost_id uuid;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS zaujem_ina_rk text;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS hypo_typ text;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS hypo_meno text;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS hypo_firma text;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS hypo_poradca_id text;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS odlozene_do date;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS rk_nazov text;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS status_kupujuci text;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS last_engagement_at timestamp with time zone;
ALTER TABLE public.klienti ADD COLUMN IF NOT EXISTS odporucil_klient_id uuid;
ALTER TABLE public.makler_provizie_pct ADD COLUMN IF NOT EXISTS makler_id text;
ALTER TABLE public.makleri ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.monitor_filtre ADD COLUMN IF NOT EXISTS ponuka_typ text;  -- ⚠️ v dev NOT NULL → DEFAULT/backfill, potom SET NOT NULL
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS ponuka_typ text;  -- ⚠️ v dev NOT NULL → DEFAULT/backfill, potom SET NOT NULL
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS inzerent_id text;
ALTER TABLE public.nehnutelnosti ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.nehnutelnosti ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS provizia_percent numeric;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS provizia_eur integer;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS firma_iban text;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS variabilny_symbol text;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS company_id uuid;  -- ⚠️ v dev NOT NULL → DEFAULT/backfill, potom SET NOT NULL

-- ─── 3) CHÝBAJÚCE INDEXY (41) ───
CREATE UNIQUE INDEX IF NOT EXISTS audit_runs_pkey ON public.audit_runs USING btree (id);
CREATE INDEX IF NOT EXISTS breach_register_detected_idx ON public.breach_register USING btree (detected_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS breach_register_pkey ON public.breach_register USING btree (id);
CREATE INDEX IF NOT EXISTS idx_2fa_challenges_challenge ON public.auth_2fa_challenges USING btree (challenge) WHERE (used_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_2fa_challenges_user_active ON public.auth_2fa_challenges USING btree (user_id, expires_at) WHERE (used_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_audit_runs_run_at ON public.audit_runs USING btree (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_faktury_active ON public.faktury USING btree (user_id, datum_vystavenia DESC) WHERE (zrusena_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_klient_preferencie_company_id ON public.klient_preferencie USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_klient_preferencie_druh ON public.klient_preferencie USING gin (druh);
CREATE INDEX IF NOT EXISTS idx_klient_preferencie_klient_id ON public.klient_preferencie USING btree (klient_id);
CREATE INDEX IF NOT EXISTS idx_klienti_company_makler ON public.klienti USING btree (company_id, makler_id);
CREATE INDEX IF NOT EXISTS idx_klienti_created_by ON public.klienti USING btree (created_by_makler_id) WHERE (created_by_makler_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_makleri_company ON public.makleri USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_geo ON public.monitor_inzeraty USING btree (lat, lng) WHERE (lat IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_inzerent ON public.monitor_inzeraty USING btree (inzerent_id) WHERE (inzerent_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_ponuka_typ ON public.monitor_inzeraty USING btree (ponuka_typ);
CREATE INDEX IF NOT EXISTS idx_naberove_listy_company_klient ON public.naberove_listy USING btree (company_id, klient_id);
CREATE INDEX IF NOT EXISTS idx_naberove_listy_company_makler_created ON public.naberove_listy USING btree (company_id, makler_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nehnutelnosti_geo ON public.nehnutelnosti USING btree (lat, lng) WHERE (lat IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_obhliadky_company_datum ON public.obhliadky USING btree (company_id, datum DESC);
CREATE INDEX IF NOT EXISTS idx_objednavky_company_id ON public.objednavky USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_objednavky_geo ON public.objednavky USING btree (lat, lng) WHERE (lat IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_qa_smoke_runs_started ON public.qa_smoke_runs USING btree (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_smoke_runs_status ON public.qa_smoke_runs USING btree (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_pobocky_pobocka ON public.user_pobocky USING btree (pobocka_id);
CREATE INDEX IF NOT EXISTS idx_user_pobocky_user ON public.user_pobocky USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS inzerent_klasifikacia_pkey ON public.inzerent_klasifikacia USING btree (inzerent_id);
CREATE UNIQUE INDEX IF NOT EXISTS klient_dokumenty_klient_name_size_uniq ON public.klient_dokumenty USING btree (klient_id, name, COALESCE(size, 0));
CREATE INDEX IF NOT EXISTS klient_dokumenty_retention_do_idx ON public.klient_dokumenty USING btree (retention_do) WHERE (retention_do IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS klient_preferencie_pkey ON public.klient_preferencie USING btree (id);
CREATE INDEX IF NOT EXISTS klienti_hypo_poradca_id_idx ON public.klienti USING btree (hypo_poradca_id) WHERE (hypo_poradca_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS klienti_last_engagement_idx ON public.klienti USING btree (last_engagement_at);
CREATE INDEX IF NOT EXISTS klienti_odporucil_idx ON public.klienti USING btree (odporucil_klient_id) WHERE (odporucil_klient_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS klienti_zaujem_nehnutelnost_id_idx ON public.klienti USING btree (zaujem_nehnutelnost_id) WHERE (zaujem_nehnutelnost_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS parse_failures_created_idx ON public.parse_failures USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS parse_failures_pkey ON public.parse_failures USING btree (id);
CREATE INDEX IF NOT EXISTS parse_failures_unreviewed_idx ON public.parse_failures USING btree (reviewed) WHERE (reviewed = false);
CREATE UNIQUE INDEX IF NOT EXISTS qa_smoke_runs_pkey ON public.qa_smoke_runs USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_faktury_company_cislo ON public.faktury USING btree (company_id, cislo_faktury) WHERE (cislo_faktury IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_faktury_company_vs ON public.faktury USING btree (company_id, variabilny_symbol) WHERE (variabilny_symbol IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS user_pobocky_pkey ON public.user_pobocky USING btree (user_id, pobocka_id);

-- SÚHRN: 7 tabuliek, 36 stĺpcov (5 NOT NULL), 41 indexov.