-- Záväzné objednávky nehnuteľností (kupujúci)
CREATE TABLE IF NOT EXISTS objednavky (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  klient_id UUID REFERENCES klienti(id) ON DELETE SET NULL,
  druh TEXT NOT NULL, -- byt, rodinny_dom, pozemok, komercne, ine
  poziadavky JSONB DEFAULT '{}', -- rok_vystavby_od, konstrukcia, vykurovanie, pocet_podlazi, pocet_izieb, vymera, plocha_pozemku, druh_pozemku, stav
  lokalita JSONB DEFAULT '{}', -- kraj, okres, obec, poznamka
  cena_do NUMERIC,
  termin_do DATE,
  zaloha NUMERIC,
  ine TEXT,
  podpis TEXT, -- base64 PNG
  makler TEXT,
  stav_objednavky TEXT DEFAULT 'aktivna', -- aktivna, splnena, zrusena
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE objednavky ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for anon" ON objednavky FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_objednavky_klient ON objednavky(klient_id);
CREATE INDEX IF NOT EXISTS idx_objednavky_druh ON objednavky(druh);
