-- 116_gdpr_requests_user_id_text.sql
-- G33 / e2e bug: gdpr_requests.user_id + handled_by boli uuid (066), ale public.users.id
-- je TEXT (legacy účty ako 'ales' nie sú uuid). erasure insert user_id=auth.user.id='ales'
-- do uuid stĺpca → "invalid input syntax for type uuid" → EVIDENCE_FAILED (fail-closed
-- správne abortoval, ale evidencia by nikdy neprešla pre legacy userov).
--
-- Fix: user_id + handled_by → text (zladiť s public.users.id). klient_id ostáva uuid
-- (klienti.id je uuid — správne).
--
-- 🔴 PROD: rovnaký fix MUSÍ byť na vianeme — gdpr_requests sa tam vytvára pri riadenom
-- deploy, user_id musí byť text od začiatku (prod public.users.id je tiež text pre legacy).

ALTER TABLE public.gdpr_requests ALTER COLUMN user_id   TYPE text USING user_id::text;
ALTER TABLE public.gdpr_requests ALTER COLUMN handled_by TYPE text USING handled_by::text;
