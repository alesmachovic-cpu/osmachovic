-- ============================================================
-- 030: Analýzy nehnuteľností — týždenné aj detailné AI odhady
-- ============================================================
-- Účel:
--   - Týždenná auto-analýza všetkých aktívnych nehnuteľností v portfóliu
--     (rýchla = odhadovaná cena + odporučený čas topovania)
--   - Manuálna detailná AI analýza konkrétnej nehnuteľnosti
--   - Analýza z URL inzerátu (paste linku)
--   - Analýza z údajov (manuálny formulár — kupujúci hľadá byt)
-- ============================================================

CREATE TABLE IF NOT EXISTS analyzy_nehnutelnosti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Prepojenie na konkrétnu nehnuteľnosť (NULL ak je analýza len z linku/údajov)
  nehnutelnost_id UUID REFERENCES nehnutelnosti(id) ON DELETE CASCADE,

  -- Typ analýzy
  typ TEXT NOT NULL CHECK (typ IN ('quick_weekly', 'detailed', 'from_link', 'from_data')),

  -- Vstupné dáta — pri from_link/from_data tu sú parametre
  vstup JSONB,                                           -- napr. { url: "...", typ: "byt", plocha: 75, ... }

  -- Výstup AI analýzy
  odhadovana_cena_eur INTEGER,                           -- odhad trhovej ceny
  odporucany_cas_topovania_dni INTEGER,                  -- po koľkých dňoch refreshnúť inzerát
  analyza_text TEXT,                                     -- markdown / plain text z AI
  konkurencia JSONB,                                     -- pole podobných ponúk { url, cena, plocha, ... }
  meta JSONB,                                            -- voľné dodatočné polia (model, tokens, atď.)

  makler_id UUID REFERENCES makleri(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analyzy_nehn_idx ON analyzy_nehnutelnosti(nehnutelnost_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analyzy_typ_idx ON analyzy_nehnutelnosti(typ, created_at DESC);

-- RLS
ALTER TABLE analyzy_nehnutelnosti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_analyzy ON analyzy_nehnutelnosti;
CREATE POLICY service_role_all_analyzy ON analyzy_nehnutelnosti
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_read_analyzy ON analyzy_nehnutelnosti;
CREATE POLICY anon_read_analyzy ON analyzy_nehnutelnosti
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS anon_write_analyzy ON analyzy_nehnutelnosti;
CREATE POLICY anon_write_analyzy ON analyzy_nehnutelnosti
  FOR INSERT TO anon WITH CHECK (true);
