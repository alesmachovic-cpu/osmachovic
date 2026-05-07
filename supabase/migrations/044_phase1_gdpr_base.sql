-- Migration 044 — Phase 1 + GDPR base
-- Fáza 1: client_interactions, klienti rozšírenie
-- Fáza 7-základ: consents, dsr_requests, DPO fields, ulohy rozšírenie

-- === DPO kontakt na users ===
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dpo_name  TEXT,
  ADD COLUMN IF NOT EXISTS dpo_email TEXT;

-- === Rozšírenie klienti o CRM polia ===
ALTER TABLE klienti
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT,   -- odporucanie/portal/olx/web/socialne_siete/priamy_kontakt
  ADD COLUMN IF NOT EXISTS segment            TEXT,   -- investor/prvykupujuci/vymenajuci/developer/prenajimatel
  ADD COLUMN IF NOT EXISTS legal_basis        TEXT    DEFAULT 'legitimate_interest',
  ADD COLUMN IF NOT EXISTS lifetime_value     NUMERIC,
  ADD COLUMN IF NOT EXISTS tags               TEXT[]  DEFAULT '{}';

-- Validácia legal_basis
ALTER TABLE klienti
  ADD CONSTRAINT klienti_legal_basis_check
    CHECK (legal_basis IN ('contract','legitimate_interest','consent','legal_obligation'));

-- === Interakcie s klientom ===
CREATE TABLE IF NOT EXISTS client_interactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id    UUID        NOT NULL REFERENCES klienti(id) ON DELETE CASCADE,
  typ          TEXT        NOT NULL CHECK (typ IN ('call','email','meeting','note','whatsapp','other')),
  subject      TEXT,
  body         TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   TEXT        NOT NULL,  -- users.id slug
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_interactions_klient ON client_interactions(klient_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_created ON client_interactions(created_at DESC);

-- RLS
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_interactions"   ON client_interactions FOR SELECT TO anon        USING (true);
CREATE POLICY "anon_write_interactions"  ON client_interactions FOR INSERT TO anon        WITH CHECK (true);
CREATE POLICY "anon_update_interactions" ON client_interactions FOR UPDATE TO anon        USING (true);
CREATE POLICY "anon_delete_interactions" ON client_interactions FOR DELETE TO anon        USING (true);
CREATE POLICY "auth_read_interactions"   ON client_interactions FOR SELECT TO authenticated USING (true);

-- === Súhlasy (Consent management) ===
CREATE TABLE IF NOT EXISTS consents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id       UUID        REFERENCES klienti(id) ON DELETE SET NULL,
  data_subject_id TEXT,                          -- email alebo iný identifikátor
  purpose         TEXT        NOT NULL,          -- marketing/profiling/newsletter/gdpr_contact/...
  text_version    TEXT,                          -- znenie textu súhlasu
  text_hash       TEXT,                          -- SHA-256 znenia (pre audit)
  granted         BOOLEAN     NOT NULL,
  granted_at      TIMESTAMPTZ,
  withdrawn_at    TIMESTAMPTZ,
  proof_ip        TEXT,
  proof_user_agent TEXT,
  source          TEXT,                          -- web_form/phone/email/inperson
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consents_klient     ON consents(klient_id);
CREATE INDEX IF NOT EXISTS idx_consents_subject    ON consents(data_subject_id);
CREATE INDEX IF NOT EXISTS idx_consents_purpose    ON consents(purpose);

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_consents"     ON consents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_consents"       ON consents FOR SELECT TO authenticated USING (true);
CREATE POLICY "anon_insert_consents"     ON consents FOR INSERT TO anon        WITH CHECK (true);

-- === Data Subject Rights žiadosti ===
CREATE TABLE IF NOT EXISTS dsr_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id       UUID        REFERENCES klienti(id) ON DELETE SET NULL,
  data_subject    TEXT        NOT NULL,   -- meno / email žiadateľa
  request_type    TEXT        NOT NULL CHECK (request_type IN (
                                'access','rectification','erasure',
                                'restriction','portability','objection')),
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
                                'pending','in_progress','completed','rejected')),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  completed_at    TIMESTAMPTZ,
  assigned_to     TEXT,                  -- users.id slug DPO/admin
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsr_status    ON dsr_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsr_deadline  ON dsr_requests(deadline_at);

ALTER TABLE dsr_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all_dsr"   ON dsr_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_dsr"     ON dsr_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_dsr"   ON dsr_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_dsr"   ON dsr_requests FOR UPDATE TO authenticated USING (true);

-- === Tabuľka úloh (vytvor ak neexistuje, inak rozšír) ===
CREATE TABLE IF NOT EXISTS ulohy (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nazov            TEXT        NOT NULL,
  hotovo           BOOLEAN     NOT NULL DEFAULT FALSE,
  priorita         TEXT        NOT NULL DEFAULT 'stredna'
                                 CHECK (priorita IN ('vysoka','stredna','nizka')),
  deadline         DATE,
  klient_id        UUID        REFERENCES klienti(id) ON DELETE SET NULL,
  nehnutelnost_id  UUID        REFERENCES nehnutelnosti(id) ON DELETE SET NULL,
  assigned_to      TEXT,
  kanban_status    TEXT        NOT NULL DEFAULT 'todo'
                                 CHECK (kanban_status IN ('todo','in_progress','done')),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pridaj nové stĺpce ak tabuľka už existovala (idempotentné)
ALTER TABLE ulohy
  ADD COLUMN IF NOT EXISTS klient_id       UUID        REFERENCES klienti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nehnutelnost_id UUID        REFERENCES nehnutelnosti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to     TEXT,
  ADD COLUMN IF NOT EXISTS kanban_status   TEXT        NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ulohy_klient   ON ulohy(klient_id);
CREATE INDEX IF NOT EXISTS idx_ulohy_assigned ON ulohy(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ulohy_kanban   ON ulohy(kanban_status);

ALTER TABLE ulohy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_ulohy" ON ulohy FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ulohy" ON ulohy FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger pre ulohy
CREATE OR REPLACE TRIGGER ulohy_updated_at
  BEFORE UPDATE ON ulohy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
