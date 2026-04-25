-- ============================================================
-- 024: Obhliadky — evidencia, podpis, prepojenie na klientov+nehnuteľnosti
-- ============================================================
-- Účel:
--  - Maklér naplánuje obhliadku (z karty klienta-predávajúceho ALEBO kupujúceho)
--  - Eviduje sa kupujúci (existujúci klient ALEBO ad-hoc kontakt z poslednej chvíle)
--  - Generuje sa obhliadkový list (PDF) — legálne krytie makléra
--  - Klient kupujúci ho podpíše canvas signature
--  - Pošle sa mailom kupujúcemu
--  - Prepojené na Google Calendar event (calendar_event_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS obhliadky (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Predávajúci klient + jeho nehnuteľnosť (povinne)
  predavajuci_klient_id UUID REFERENCES klienti(id) ON DELETE SET NULL,
  nehnutelnost_id UUID REFERENCES nehnutelnosti(id) ON DELETE SET NULL,

  -- Kupujúci — buď existujúci klient v DB, alebo ad-hoc kontakt (meno/telefón/email)
  kupujuci_klient_id UUID REFERENCES klienti(id) ON DELETE SET NULL,
  kupujuci_meno TEXT,
  kupujuci_telefon TEXT,
  kupujuci_email TEXT,

  -- Maklér ktorý obhliadku vykonáva
  makler_id UUID REFERENCES makleri(id) ON DELETE SET NULL,

  -- Logistika
  datum TIMESTAMPTZ NOT NULL,
  miesto TEXT,                    -- voľný text (adresa, GPS, "stretnutie pred bytom" ap.)
  poznamka TEXT,
  status TEXT NOT NULL DEFAULT 'planovana'
    CHECK (status IN ('planovana','prebehla','zrusena','obhliadka_bez_zaujmu','obhliadka_zaujem')),

  -- Podpis kupujúceho — canvas data URL (base64 PNG)
  podpis_data TEXT,
  podpis_datum TIMESTAMPTZ,

  -- Generovaný PDF list (base64) + jeho odoslanie
  list_pdf_base64 TEXT,
  email_sent_at TIMESTAMPTZ,
  email_sent_to TEXT,

  -- Google Calendar prepojenie
  calendar_event_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obhliadky_predavajuci_idx ON obhliadky(predavajuci_klient_id);
CREATE INDEX IF NOT EXISTS obhliadky_kupujuci_idx ON obhliadky(kupujuci_klient_id);
CREATE INDEX IF NOT EXISTS obhliadky_nehnutelnost_idx ON obhliadky(nehnutelnost_id);
CREATE INDEX IF NOT EXISTS obhliadky_makler_idx ON obhliadky(makler_id);
CREATE INDEX IF NOT EXISTS obhliadky_datum_idx ON obhliadky(datum);

-- RLS — povolíme anon SELECT/INSERT/UPDATE rovnako ako pri ostatných tabuľkách
ALTER TABLE obhliadky ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_obhliadky ON obhliadky;
CREATE POLICY service_role_all_obhliadky ON obhliadky
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_read_obhliadky ON obhliadky;
CREATE POLICY anon_read_obhliadky ON obhliadky
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_write_obhliadky ON obhliadky;
CREATE POLICY anon_write_obhliadky ON obhliadky
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS anon_update_obhliadky ON obhliadky;
CREATE POLICY anon_update_obhliadky ON obhliadky
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
