-- 086_geo_coords.sql
-- GPS súradnice pre matching algoritmus podľa skutočnej vzdialenosti.
-- Aleš (2026-05-22): "Petržalka-Háje kupujúci → Dvory 1km lepšie ako
-- Dúbravka 7km lepšie ako Senec 20km — musíme to rozlišovať podľa mapy".
--
-- Nepoužívame PostGIS (overkill). Stačí lat/lng + haversine vo frontend kóde.

BEGIN;

ALTER TABLE public.nehnutelnosti
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

ALTER TABLE public.objednavky
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

ALTER TABLE public.monitor_inzeraty
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

-- Index pre rýchle bounding-box queries (matching: "v okruhu 15km od X,Y")
CREATE INDEX IF NOT EXISTS idx_nehnutelnosti_geo ON public.nehnutelnosti(lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objednavky_geo ON public.objednavky(lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_geo ON public.monitor_inzeraty(lat, lng) WHERE lat IS NOT NULL;

COMMENT ON COLUMN public.nehnutelnosti.lat IS 'WGS84 latitude, geokódované cez Nominatim z lokalita+kraj+okres pri save';
COMMENT ON COLUMN public.nehnutelnosti.lng IS 'WGS84 longitude';

COMMIT;
