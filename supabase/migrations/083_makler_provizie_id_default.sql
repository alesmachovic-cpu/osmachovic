-- 083_makler_provizie_id_default.sql
-- makler_provizie_pct.id je NOT NULL ale bez DEFAULT → POST INSERT bez explicit
-- id padá s "null value in column id ... violates not-null constraint".
-- Pridáva DEFAULT gen_random_uuid() aby insertov nebolo treba mať id explicitne.

ALTER TABLE public.makler_provizie_pct
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
