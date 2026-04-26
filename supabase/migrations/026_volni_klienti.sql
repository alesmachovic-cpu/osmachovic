-- ============================================================
-- 026: Voľní klienti — premenovanie z "Odklik" + SLA rozšírenia
-- ============================================================
-- Účel:
--   Prepísanie konceptu "Odklik" → "Voľní klienti" s novými SLA pravidlami:
--     - novy / novy_kontakt: 24h od updated_at → uvoľní
--     - volat_neskor: 24h od datum_naberu → uvoľní
--     - dohodnuty_naber: 48h od datum_naberu bez inzerátu → warning maklerovi
--                       72h od datum_naberu bez inzerátu → notifikácia manažérovi
--     - nechce_rk: okamžite uvoľní
--   Manažér môže klienta v 72h+ stave: presunúť na iného maklera ALEBO
--   napomenúť (audit log + notifikácia).
--   Akýkoľvek maklér si môže voľného klienta prebrať (claim).
-- ============================================================

-- 1) Premenovanie stĺpcov (idempotentné)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='klienti' AND column_name='je_v_odkliku') THEN
    ALTER TABLE klienti RENAME COLUMN je_v_odkliku TO je_volny;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='klienti' AND column_name='odklik_at') THEN
    ALTER TABLE klienti RENAME COLUMN odklik_at TO volny_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='klienti' AND column_name='odklik_from_status') THEN
    ALTER TABLE klienti RENAME COLUMN odklik_from_status TO volny_dovod;
  END IF;
END $$;

-- 2) Nové SLA stĺpce
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS sla_warning_at TIMESTAMPTZ;            -- kedy bol poslaný warning maklerovi (48h)
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS sla_critical_at TIMESTAMPTZ;            -- kedy manažér prvý raz upozornený (72h)
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS sla_last_chance_at TIMESTAMPTZ;         -- "1h pred vypršaním" alert
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS napomenutia_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS posledne_napomenutie_at TIMESTAMPTZ;
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS posledne_napomenutie_dovod TEXT;

CREATE INDEX IF NOT EXISTS klienti_je_volny_idx ON klienti(je_volny);
CREATE INDEX IF NOT EXISTS klienti_sla_critical_idx ON klienti(sla_critical_at) WHERE sla_critical_at IS NOT NULL;

-- 3) Audit tabuľka — história prevzatí, uvoľnení, manažérskych akcií
CREATE TABLE IF NOT EXISTS klienti_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id UUID NOT NULL REFERENCES klienti(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'uvolneny',          -- klient bol uvoľnený (presun do voľného poolu)
    'prebraty',          -- voľného klienta si prevzal maklér
    'sla_warning',       -- 48h warning maklerovi
    'sla_last_chance',   -- 1h pred vypršaním
    'sla_critical',      -- 72h notifikácia manažérovi
    'manager_presun',    -- manažér presunul klienta na iného makléra
    'napomenuty',        -- manažér napomenul makléra
    'vrateny_novy'       -- maklér vrátil voľného klienta späť ako "novy"
  )),
  dovod TEXT,                                          -- voľný text (z akého statusu, akým makléron, ...)
  from_makler_id UUID REFERENCES makleri(id) ON DELETE SET NULL,
  to_makler_id UUID REFERENCES makleri(id) ON DELETE SET NULL,
  by_user_id UUID,                                     -- kto akciu vykonal (UI maklér, manažér, alebo NULL = cron)
  meta JSONB,                                          -- voľná metadata (od_statusu, hodiny SLA, ...)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS klienti_history_klient_idx ON klienti_history(klient_id);
CREATE INDEX IF NOT EXISTS klienti_history_action_idx ON klienti_history(action);
CREATE INDEX IF NOT EXISTS klienti_history_created_idx ON klienti_history(created_at DESC);

-- RLS
ALTER TABLE klienti_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_klienti_history ON klienti_history;
CREATE POLICY service_role_all_klienti_history ON klienti_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS anon_read_klienti_history ON klienti_history;
CREATE POLICY anon_read_klienti_history ON klienti_history
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS anon_write_klienti_history ON klienti_history;
CREATE POLICY anon_write_klienti_history ON klienti_history
  FOR INSERT TO anon WITH CHECK (true);

-- 4) users.role — uistime sa že stĺpec existuje (pre manažérske akcie)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'makler';
-- Hodnoty: 'admin', 'manager', 'makler' (default)
