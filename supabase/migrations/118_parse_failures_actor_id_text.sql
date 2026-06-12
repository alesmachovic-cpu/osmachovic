-- 118_parse_failures_actor_id_text.sql
-- G33 trieda (4. člen) / proaktívny uuid sken: parse_failures.actor_id (migr 102) bol
-- uuid, ale logParseFailure (parse-doc/parse-pdf) doň zapisuje actor_id=auth.user.id =
-- public.users.id = TEXT (legacy účty ako 'ales'). → insert actor_id='ales' do uuid by
-- zlyhal → parse failure legacy usera sa NEzaloguje (tichý fail v review fronte).
--
-- Fix: actor_id uuid → text (zladiť s public.users.id). klient_id/company_id ostávajú
-- uuid (klienti/companies.id sú uuid). Súčasť triedy s 116 (gdpr_requests) + 117
-- (breach_register).
--
-- 🔴 PROD: parse_failures.actor_id musí byť text aj na vianeme (parse_failures je v
-- reconcile ako nová tabuľka — oprav tam actor_id na text).

ALTER TABLE public.parse_failures ALTER COLUMN actor_id TYPE text USING actor_id::text;
