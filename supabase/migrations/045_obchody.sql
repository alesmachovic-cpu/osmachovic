-- Migration 045 — Obchody (deal lifecycle tracking)
-- Sledovanie životného cyklu obchodu: od rezervácie po vklad do katastra.

-- ═══ Hlavná tabuľka obchodov ═══

CREATE TABLE IF NOT EXISTS obchody (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id        uuid        NOT NULL REFERENCES klienti(id) ON DELETE CASCADE,
  nehnutelnost_id  uuid        REFERENCES nehnutelnosti(id),
  status           text        NOT NULL DEFAULT 'v_procese',
  cena             numeric,
  provizia         numeric,
  kupujuci_meno    text,
  notar            text,
  banka            text,
  poznamky         text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE obchody
  ADD CONSTRAINT obchody_status_check
    CHECK (status IN ('v_procese','pred_podpisom_kz','podpisane','vklad','ukoncene','zruseny'));

CREATE INDEX IF NOT EXISTS idx_obchody_klient ON obchody(klient_id);

-- RLS
ALTER TABLE obchody ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_obchody_select" ON obchody FOR SELECT  TO authenticated USING (true);
CREATE POLICY "auth_obchody_insert" ON obchody FOR INSERT  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_obchody_update" ON obchody FOR UPDATE  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_obchody_delete" ON obchody FOR DELETE  TO authenticated USING (true);
CREATE POLICY "anon_obchody_select" ON obchody FOR SELECT  TO anon USING (true);
CREATE POLICY "anon_obchody_insert" ON obchody FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "anon_obchody_update" ON obchody FOR UPDATE  TO anon USING (true);
CREATE POLICY "anon_obchody_delete" ON obchody FOR DELETE  TO anon USING (true);

-- ═══ Úlohy obchodu ═══

CREATE TABLE IF NOT EXISTS obchod_ulohy (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  obchod_id         uuid        NOT NULL REFERENCES obchody(id) ON DELETE CASCADE,
  kategoria         text        NOT NULL DEFAULT 'akcia',
  nazov             text        NOT NULL,
  popis             text,
  done              boolean     NOT NULL DEFAULT false,
  done_at           timestamptz,
  priorita          text        NOT NULL DEFAULT 'normalna',
  deadline          date,
  drive_link        text,
  calendar_event_id text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE obchod_ulohy
  ADD CONSTRAINT obchod_ulohy_kategoria_check
    CHECK (kategoria IN ('dokument','aml','akcia','termin'));
ALTER TABLE obchod_ulohy
  ADD CONSTRAINT obchod_ulohy_priorita_check
    CHECK (priorita IN ('nizka','normalna','vysoka'));

CREATE INDEX IF NOT EXISTS idx_obchod_ulohy_obchod ON obchod_ulohy(obchod_id);

-- RLS
ALTER TABLE obchod_ulohy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_ulohy_select" ON obchod_ulohy FOR SELECT  TO authenticated USING (true);
CREATE POLICY "auth_ulohy_insert" ON obchod_ulohy FOR INSERT  TO authenticated WITH CHECK (true);
CREATE POLICY "auth_ulohy_update" ON obchod_ulohy FOR UPDATE  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_ulohy_delete" ON obchod_ulohy FOR DELETE  TO authenticated USING (true);
CREATE POLICY "anon_ulohy_select" ON obchod_ulohy FOR SELECT  TO anon USING (true);
CREATE POLICY "anon_ulohy_insert" ON obchod_ulohy FOR INSERT  TO anon WITH CHECK (true);
CREATE POLICY "anon_ulohy_update" ON obchod_ulohy FOR UPDATE  TO anon USING (true);
CREATE POLICY "anon_ulohy_delete" ON obchod_ulohy FOR DELETE  TO anon USING (true);
