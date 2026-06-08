-- 112_drop_statistiky_views_anon_leak.sql
-- 🔴 SECURITY FIX: anonymný leak cez SECURITY DEFINER views.
--
-- Migrácia 043 vytvorila v_deals + v_makler_stats s `GRANT SELECT ... TO anon`.
-- Views sú SECURITY DEFINER (owner postgres) → obchádzajú RLS, a anon grant ich
-- robí čitateľnými cez PostgREST BEZ prihlásenia. Ktokoľvek s verejným anon kľúčom
-- vedel cez GET /rest/v1/v_deals stiahnuť všetky predané nehnuteľnosti vrátane cien,
-- provízií firmy a maklér mien+e-mailov (firemné financie + maklérske PII).
--
-- Supabase Security Advisor (prod) ich flagol ako CRITICAL (Security Definer View).
-- Appka tieto views NEPOUŽÍVA (0 výskytov v src/) — sú to mŕtve pozostatky.
-- Rozhodnutie CEO 2026-06-08: DROP oboje (najčistejšie). Ak sa štatistiky vrátia,
-- spravia sa nanovo s company_id scope a bez anon grantu.
--
-- DROP poradie: v_makler_stats závisí od v_deals → najprv stats.

DROP VIEW IF EXISTS public.v_makler_stats;
DROP VIEW IF EXISTS public.v_deals;

-- ============================================================================
-- DOWN MIGRATION (ak by bolo treba vrátiť — ale BEZ anon grantu!):
--   pozri 043_statistiky_views.sql pre pôvodné definície, ale granty len
--   service_role (NIE anon/authenticated) a zváž security_invoker=true.
-- ============================================================================
