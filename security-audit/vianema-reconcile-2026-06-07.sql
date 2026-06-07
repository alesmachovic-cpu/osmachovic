-- ════════════════════════════════════════════════════════════════════════════
-- VIANEMA PROD — KONSOLIDOVANÝ ZLADOVACÍ SKRIPT (dev → prod hokymscytscsewrpwdjf)
-- Vrstva 2 veľkého releasu. Vygenerované 2026-06-07 (okno Bezpečnosť).
-- Zdroj: dev migrácie + dev DB introspection (ntdjsmqzzvqqammmiqye) vs prod odfotka
--        security-audit/vianema-prod-schema-2026-06-07.txt (A stĺpce + B indexy + C RLS).
--
-- 🔴🔴🔴  NÁVRH NA REVIEW — NESPÚŠŤAŤ NA OSTREJ PROD DB.  🔴🔴🔴
--   1) Pred aplikáciou POVINNE: záloha prod DB (pg_dump / PITR snapshot).
--   2) PRVÉ spustenie na TEST kópii prod dát (postup dole), NIE na ostrej DB.
--   3) Skript je idempotentný (IF NOT EXISTS / DROP POLICY IF EXISTS) — bezpečný re-run.
--   4) BEZ rollback-anon migrácií (070/095) — tie sem zámerne nepatria.
--
-- OBSAH: 1) 7 chýbajúcich tabuliek (plné DDL + RLS z dev migrácií)
--        2) 36 chýbajúcich stĺpcov (vrát. backfill objednavky.company_id)
--        3) 23 chýbajúcich indexov
--        4) RLS zladenie existujúcich tabuliek (service_role doplnky)
--        5) 🔴 SAMOSTATNÝ release item: cross-tenant company_id RLS (NIE v tomto skripte)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════ 1) CHÝBAJÚCE TABUĽKY (7) — plné DDL vrátane PK/FK/CHECK/RLS ════════

-- ── 1.1 audit_runs (migr. 071) ──
CREATE TABLE IF NOT EXISTS audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT NOW(),
  source text NOT NULL DEFAULT 'daily-cron',
  counts jsonb NOT NULL,
  results jsonb NOT NULL,
  email_summary jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_runs_run_at ON audit_runs(run_at DESC);
ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
-- (migr. 071 nedefinuje policy → prístup len service_role; ponechané rovnako)

-- ── 1.2 breach_register (migr. 108) — GDPR čl. 33 ──
CREATE TABLE IF NOT EXISTS breach_register (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid,
  detected_at       timestamptz not null default now(),
  occurred_at       timestamptz,
  description       text not null,
  data_categories   text,
  affected_count    integer,
  risk_level        text not null default 'normal',
  reported_uoou     boolean not null default false,
  reported_uoou_at  timestamptz,
  subjects_notified boolean not null default false,
  measures          text,
  created_by        uuid,
  created_at        timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS breach_register_detected_idx ON breach_register (detected_at desc);
ALTER TABLE breach_register ENABLE ROW LEVEL SECURITY;
-- (len service_role; citlivý interný register)

-- ── 1.3 inzerent_klasifikacia (migr. 111) ──
CREATE TABLE IF NOT EXISTS inzerent_klasifikacia (
  inzerent_id    text PRIMARY KEY,
  typ            text NOT NULL CHECK (typ IN ('rk','sukromny')),
  pridal_user_id text REFERENCES users(id) ON DELETE SET NULL,
  poznamka       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inzerent_klasifikacia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inzerent_klasifikacia_select_auth" ON inzerent_klasifikacia;
CREATE POLICY "inzerent_klasifikacia_select_auth" ON inzerent_klasifikacia
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "inzerent_klasifikacia_all_service" ON inzerent_klasifikacia;
CREATE POLICY "inzerent_klasifikacia_all_service" ON inzerent_klasifikacia
  TO service_role USING (true) WITH CHECK (true);

-- ── 1.4 klient_preferencie (dev DB introspection — bez migr. súboru!) ──
-- ⚠️ REVIEW: táto tabuľka NEMÁ migračný súbor v repo, existuje len v dev DB (0 riadkov).
--    DDL nižšie je zrekonštruované z information_schema. Over PK/FK pred prod.
--    POZN: dev nemá FK na klienti(id) ani company_id (over či to tak má ostať).
CREATE TABLE IF NOT EXISTS klient_preferencie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id uuid NOT NULL,
  company_id uuid NOT NULL,
  druh text[] NOT NULL,
  pocet_izieb_min smallint, pocet_izieb_max smallint,
  vymera_min integer, vymera_max integer,
  typ_konstrukcie text[], poschodie text, vyzaduje_vytah boolean DEFAULT false,
  orientacia text[], stav text[], zariadenie text,
  kraj text, okres text, obec text, mestska_cast text, ulice text[],
  max_km_od_centra smallint, ma_balkon boolean, ma_pivnicu boolean,
  ma_parkovacie boolean, zahrada_min_m2 integer,
  cena_min integer, cena_max integer,
  predava_vlastnu boolean, vlastna_predaj_suma integer, vlastna_predaj_horizont text,
  hotovost_eur integer, hypoteka_eur integer, hypoteka_banka text, hypoteka_predschvalena text,
  casovy_horizont text, mhd_pristup boolean, mhd_max_metrov smallint,
  blizko_skoly boolean, blizko_obchodov boolean, ticha_lokalita boolean, domace_zvierata boolean,
  poznamka text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE klient_preferencie ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_read_klient_preferencie ON klient_preferencie;
CREATE POLICY anon_read_klient_preferencie ON klient_preferencie
  FOR SELECT TO anon USING (false);  -- anon zablokovaný (USING false)
DROP POLICY IF EXISTS service_role_all_klient_preferencie ON klient_preferencie;
CREATE POLICY service_role_all_klient_preferencie ON klient_preferencie
  TO service_role USING (true) WITH CHECK (true);

-- ── 1.5 parse_failures (migr. 102) ──
CREATE TABLE IF NOT EXISTS parse_failures (
  id uuid primary key default gen_random_uuid(),
  klient_id uuid references klienti(id) on delete set null,
  company_id uuid,
  actor_id uuid,
  filename text,
  doc_type text,
  source text,
  error text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS parse_failures_created_idx ON parse_failures (created_at desc);
CREATE INDEX IF NOT EXISTS parse_failures_unreviewed_idx ON parse_failures (reviewed) WHERE reviewed = false;
ALTER TABLE parse_failures ENABLE ROW LEVEL SECURITY;
-- (len service_role)

-- ── 1.6 qa_smoke_runs (migr. 076) ──
CREATE TABLE IF NOT EXISTS qa_smoke_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  status       text        NOT NULL CHECK (status IN ('ok','warn','failed','running')),
  duration_ms  integer     NULL,
  steps        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  failed_step  text        NULL,
  error        text        NULL,
  base_url     text        NULL,
  triggered_by text        NULL,
  cleanup_ok   boolean     NULL
);
CREATE INDEX IF NOT EXISTS idx_qa_smoke_runs_started ON qa_smoke_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_smoke_runs_status ON qa_smoke_runs (status, started_at DESC);
ALTER TABLE qa_smoke_runs ENABLE ROW LEVEL SECURITY;

-- ── 1.7 user_pobocky (migr. 087) — manažér N pobočiek ──
CREATE TABLE IF NOT EXISTS public.user_pobocky (
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pobocka_id text NOT NULL REFERENCES public.pobocky(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pobocka_id)
);
CREATE INDEX IF NOT EXISTS idx_user_pobocky_user ON public.user_pobocky(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pobocky_pobocka ON public.user_pobocky(pobocka_id);
INSERT INTO public.user_pobocky(user_id, pobocka_id)
SELECT id, pobocka_id FROM public.users WHERE pobocka_id IS NOT NULL
ON CONFLICT DO NOTHING;
ALTER TABLE public.user_pobocky ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_pobocky_read ON public.user_pobocky;
CREATE POLICY user_pobocky_read ON public.user_pobocky FOR SELECT
  USING (user_id = auth.uid()::text OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text
      AND u.role IN ('super_admin','majitel')));
DROP POLICY IF EXISTS user_pobocky_write ON public.user_pobocky;
CREATE POLICY user_pobocky_write ON public.user_pobocky FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text
      AND u.role IN ('super_admin','majitel')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text
      AND u.role IN ('super_admin','majitel')));


-- ════════ 2) CHÝBAJÚCE STĹPCE (36) ════════

-- 2a) Bežné nullable stĺpce:
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS zrusena_at timestamp with time zone;
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS zrusena_dovod text;
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS zrusena_by text;
ALTER TABLE public.faktury ADD COLUMN IF NOT EXISTS dodavatel_snapshot jsonb;
ALTER TABLE public.firma_info ADD COLUMN IF NOT EXISTS platca_dph_od date;
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
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS inzerent_id text;
ALTER TABLE public.nehnutelnosti ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.nehnutelnosti ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS provizia_percent numeric;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS provizia_eur integer;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS firma_iban text;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS variabilny_symbol text;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS lng numeric;

-- 2b) NOT NULL stĺpce s bezpečným dev DEFAULT (existujúce riadky sa vyplnia atomicky):
ALTER TABLE public.firma_info ADD COLUMN IF NOT EXISTS platca_dph boolean NOT NULL DEFAULT false;
ALTER TABLE public.klient_dokumenty ADD COLUMN IF NOT EXISTS aml_retention boolean NOT NULL DEFAULT false;
ALTER TABLE public.monitor_filtre ADD COLUMN IF NOT EXISTS ponuka_typ text NOT NULL DEFAULT 'predaj'::text;
ALTER TABLE public.monitor_inzeraty ADD COLUMN IF NOT EXISTS ponuka_typ text NOT NULL DEFAULT 'predaj'::text;

-- 2c) 🔴 objednavky.company_id — NOT NULL BEZ defaultu → potrebný BACKFILL z klienti.
--     Krok 1: pridaj ako nullable.
ALTER TABLE public.objednavky ADD COLUMN IF NOT EXISTS company_id uuid;
--     Krok 2: backfill z klienta objednávky.
UPDATE public.objednavky o
   SET company_id = k.company_id
  FROM public.klienti k
 WHERE o.klient_id = k.id AND o.company_id IS NULL;
--     Krok 3: over ČI NEOSTALI NULL (osirelé objednávky bez klienta):
--       SELECT count(*) FROM public.objednavky WHERE company_id IS NULL;
--     LEN AK je výsledok 0 → odkomentuj a spusti SET NOT NULL:
-- ALTER TABLE public.objednavky ALTER COLUMN company_id SET NOT NULL;
--     (Ak ostali NULL → najprv vyrieš osirelé objednávky s MD/Klienti oknom.)

-- ════════ 3) CHÝBAJÚCE INDEXY (23) — na existujúcich tabuľkách ════════

CREATE INDEX IF NOT EXISTS idx_2fa_challenges_challenge ON public.auth_2fa_challenges USING btree (challenge) WHERE (used_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_2fa_challenges_user_active ON public.auth_2fa_challenges USING btree (user_id, expires_at) WHERE (used_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_faktury_active ON public.faktury USING btree (user_id, datum_vystavenia DESC) WHERE (zrusena_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_faktury_company_cislo ON public.faktury USING btree (company_id, cislo_faktury) WHERE (cislo_faktury IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_faktury_company_vs ON public.faktury USING btree (company_id, variabilny_symbol) WHERE (variabilny_symbol IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS klient_dokumenty_klient_name_size_uniq ON public.klient_dokumenty USING btree (klient_id, name, COALESCE(size, 0));
CREATE INDEX IF NOT EXISTS klient_dokumenty_retention_do_idx ON public.klient_dokumenty USING btree (retention_do) WHERE (retention_do IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_klienti_company_makler ON public.klienti USING btree (company_id, makler_id);
CREATE INDEX IF NOT EXISTS idx_klienti_created_by ON public.klienti USING btree (created_by_makler_id) WHERE (created_by_makler_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS klienti_hypo_poradca_id_idx ON public.klienti USING btree (hypo_poradca_id) WHERE (hypo_poradca_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS klienti_last_engagement_idx ON public.klienti USING btree (last_engagement_at);
CREATE INDEX IF NOT EXISTS klienti_odporucil_idx ON public.klienti USING btree (odporucil_klient_id) WHERE (odporucil_klient_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS klienti_zaujem_nehnutelnost_id_idx ON public.klienti USING btree (zaujem_nehnutelnost_id) WHERE (zaujem_nehnutelnost_id IS NOT NULL);
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

-- ════════ 4) RLS ZLADENIE existujúcich tabuliek ════════
-- Diff dev vs prod (Query C): dev má pár service_role ALL policies navyše. Sú neškodné
-- (service_role aj tak obchádza RLS), pridané pre konzistenciu dev↔prod. CREATE POLICY
-- nepodporuje IF NOT EXISTS → DROP IF EXISTS + CREATE.
DROP POLICY IF EXISTS service_role_all_client_interactions ON public.client_interactions;
CREATE POLICY service_role_all_client_interactions ON public.client_interactions TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_obchod_ulohy ON public.obchod_ulohy;
CREATE POLICY service_role_all_obchod_ulohy ON public.obchod_ulohy TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_obchody ON public.obchody;
CREATE POLICY service_role_all_obchody ON public.obchody TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_ulohy ON public.ulohy;
CREATE POLICY service_role_all_ulohy ON public.ulohy TO service_role USING (true) WITH CHECK (true);

-- ════════ 5) 🔴 SAMOSTATNÝ RELEASE ITEM — NIE V TOMTO SKRIPTE ════════
-- CROSS-TENANT company_id RLS HARDENING (defense-in-depth):
--   Zistenie z diff: dev RLS == prod RLS. ANI dev nemá company_id-scoped policies na
--   PII tabuľkách (klienti, obchody, objednavky, obhliadky, naberove_listy, nehnutelnosti…).
--   Oba systémy spoliehajú na service_role API + app-level requireUser/getUserScope.
--   → Pridanie company_id RLS NIE JE "zladenie dev→prod" (nie je čo kopírovať z dev),
--     ale NOVÝ bezpečnostný hardening. Vyžaduje:
--       (a) auth.uid()→company_id mapovanie v policy (subquery na users),
--       (b) overenie že žiadny klient-side kód nečíta tieto tabuľky cez anon/authenticated
--           kľúč priamo (inak by sa rozbili reads),
--       (c) výslovný súhlas CEO (🔴 protokol) + dôkladný test.
--   → Rieš ako samostatný krok veľkého releasu, NIE v tomto reconcile skripte.
--
-- firma_info|firma_info_select_public|public|SELECT|true = ANON-čítateľné (IČO/DIČ/konateľ,
--   nie klientske PII). Rovnaké v dev aj prod. Pri release zváž zúženie na authenticated.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- TEST POSTUP PRED PROD (povinný — neprvospúšťať na ostrej DB):
--   A) Najbezpečnejší (test na REÁLNYCH dátach):
--      1. pg_dump prod (hokymscytscsewrpwdjf) — plná záloha (aj poistka pred aplikáciou).
--      2. Vytvor dočasný scratch Supabase projekt; restore dump doň.
--      3. Spusti TENTO skript na scratch projekte. Over: prejde bez chýb,
--         SELECT count(*) FROM objednavky WHERE company_id IS NULL = 0 (inak rieš osirelé),
--         appka (point dev build na scratch) prejde smoke testom.
--      4. Až po úspechu → ZÁLOHA prod → aplikuj na prod → smoke test.
--   B) Alternatíva ak je projekt na Supabase Pro: Branching (preview branch) — pozor,
--      branch klonuje schému, NIE nutne plné dáta → slabšie pokrytie objednavky backfillu.
--   Odporúčam A (scratch s reálnym dumpom) — jediný čo otestuje backfill a NOT NULL na ostrých dátach.
-- ════════════════════════════════════════════════════════════════════════════
