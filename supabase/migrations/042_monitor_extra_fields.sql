-- 042: monitor_inzeraty — extra polia pre analýzy cien
-- poschodie: "4/8", "prízemie", "podkrovie" atď.
-- stav: "novostavba", "po rekonštrukcii", "pôvodný stav" atď.
-- cena_za_m2: vypočítané pole (cena / plocha) pre rýchle porovnanie

ALTER TABLE monitor_inzeraty
  ADD COLUMN IF NOT EXISTS poschodie      TEXT,
  ADD COLUMN IF NOT EXISTS stav           TEXT,
  ADD COLUMN IF NOT EXISTS cena_za_m2     NUMERIC GENERATED ALWAYS AS (
    CASE WHEN plocha > 0 THEN ROUND(cena / plocha, 0) ELSE NULL END
  ) STORED;

-- Index pre cenové analýzy
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_cena_za_m2 ON monitor_inzeraty(cena_za_m2);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_stav ON monitor_inzeraty(stav);
