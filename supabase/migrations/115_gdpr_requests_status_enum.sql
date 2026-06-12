-- 115_gdpr_requests_status_enum.sql
-- G33 / Pravo: rozšíriť status slovník gdpr_requests o evidenciu čiastočného a
-- zlyhaného vybavenia. Pôvodný CHECK (066) povoľoval len
-- ('pending','in_progress','completed','rejected') → erasure pri chybách potreboval
-- 'completed_with_errors' / 'failed', ktoré by CHECK ODMIETOL → update evidencie by
-- zlyhal → nevieme preukázať čiastočné/zlyhané vybavenie (čl. 5/2, čl. 30 RoPA).
--
-- Jednotný status slovník (kód + schéma):
--   pending              — žiadosť prijatá, nevybavená
--   in_progress          — vybavovanie beží
--   completed            — vybavené bez chýb
--   completed_with_errors— vybavené, ale niektoré sub-záznamy zlyhali (PII anonymizované,
--                          čiastková chyba zaevidovaná v details.errors)
--   failed               — výmaz sa NEVYKONAL (fail-closed: evidencia/audit zlyhali pred
--                          zmenou dát; žiadne dáta klienta sa nedotkli)
--   rejected             — žiadosť zamietnutá (právny dôvod / duplicita)

ALTER TABLE public.gdpr_requests DROP CONSTRAINT IF EXISTS gdpr_requests_status_check;
ALTER TABLE public.gdpr_requests ADD CONSTRAINT gdpr_requests_status_check
  CHECK (status IN ('pending','in_progress','completed','completed_with_errors','failed','rejected'));
