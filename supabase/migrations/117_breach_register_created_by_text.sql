-- 117_breach_register_created_by_text.sql
-- G33 trieda / Pravo systémový nález: legacy-text-ID problém naprieč accountability
-- tabuľkami. public.users.id je TEXT (legacy účty ako 'ales'), konvencia = referencie
-- na usera sú TEXT (viď audit_log migr 012). breach_register.created_by (migr 108) bol
-- uuid → admin s legacy text id (Aleš) by pri zápise prvého reálneho breachu zlyhal
-- ROVNAKO ako erasure (invalid input syntax for type uuid) → tichý/tvrdý fail na
-- ZÁKONNEJ evidencii porušení (GDPR čl. 33 ods. 5 — povinný register VŠETKÝCH porušení).
--
-- Fix: created_by uuid → text (zladiť s public.users.id). company_id ostáva uuid
-- (companies.id je uuid — správne).
--
-- 🔴 PROD: breach_register na vianeme musí mať created_by TEXT (rovnako ako gdpr_requests
-- user_id/handled_by v migr 116) — inak breach evidencia zlyhá pre legacy adminov.

ALTER TABLE public.breach_register ALTER COLUMN created_by TYPE text USING created_by::text;
