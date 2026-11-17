-- 115: sumy na faktúrach s centami (17.11.2026, schválil Aleš Machovič).
-- Dôvod: stĺpce boli integer, takže sa nedala uložiť suma ako 589,50 €
-- ("invalid input syntax for type integer"). Zmena na numeric(12,2) je
-- bezstratová — doterajšie celé sumy ostanú rovnaké. Idempotentné: mení len
-- stĺpce, ktoré sú ešte integer. Spúšťa sa ručne v SQL editore Supabase.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'integer'
      AND (table_name, column_name) IN (
        ('faktury', 'suma_bez_dph'),
        ('faktury', 'dph'),
        ('faktury', 'suma_celkom'),
        ('faktura_polozky', 'cena_jednotka'),
        ('faktura_polozky', 'spolu')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE numeric(12,2)', r.table_name, r.column_name);
  END LOOP;
END $$;

-- Kontrola po spustení: všetkých 5 riadkov musí mať numeric.
-- SELECT table_name, column_name, data_type, numeric_scale
-- FROM information_schema.columns
-- WHERE table_schema='public' AND (table_name, column_name) IN
--  (('faktury','suma_bez_dph'),('faktury','dph'),('faktury','suma_celkom'),
--   ('faktura_polozky','cena_jednotka'),('faktura_polozky','spolu'));
