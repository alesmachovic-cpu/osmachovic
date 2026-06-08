-- 099_drop_klienti_telefon_uniq.sql
-- Per Aleš (2026-05-25): unique constraint na normalizovanom telefóne
-- (`klienti_telefon_uniq`, viď 032) blokoval pôvodný dupe-UX flow:
--   - warning (telefón rovnaký, iné meno/email/lokalita) → môže vzniknúť nový klient
--   - critical (úplne rovnaké) → vzniká s status=caka_na_schvalenie, manager schvaľuje
-- DB constraint zablokoval OBOJE. App-level dupe logika v NewKlientModal je
-- dostatočná — UI ukazuje warning/critical, manager flow pre exact match
-- ide cez status=caka_na_schvalenie.

BEGIN;

DROP INDEX IF EXISTS public.klienti_telefon_uniq;

COMMIT;
