-- 034_rls_write_service_only.sql
--
-- Etapa D z security refactoru: po prepise UI na /api/klienti, /api/nabery,
-- /api/inzerat/save, /api/obhliadky (etapa C) môžeme zatvoriť write priamy
-- prístup z anon key. Predtým: ktokoľvek s anon key (viditeľný v každom
-- DevTools network requeste) mohol INSERT/UPDATE/DELETE čokoľvek na
-- klienti, naberove_listy, obhliadky.
--
-- Po tejto migrácii:
--   - SELECT (čítanie) zostáva otvorené pre anon — CRM je interný
--     nástroj a všetci makléri vidia spoločné portfólio + klientov.
--   - INSERT/UPDATE/DELETE iba service_role (= len API endpointy z
--     /api/* ktoré používajú getSupabaseAdmin a robia ownership check
--     cez src/lib/scope.ts).
--
-- POZN.: Ak po deploy spadnú niektoré write operácie zo starej UI ktoré
-- som ešte neprepísal v etape C, znamená to že tam beží direct supabase
-- call. Riešenie: prepísať ich na fetch("/api/...") helper alebo dočasne
-- pridať insert/update policy späť.

BEGIN;

-- klienti — bola otvorená cez "write_klienti" ALL public USING (true)
DROP POLICY IF EXISTS write_klienti ON klienti;
DROP POLICY IF EXISTS read_all_klienti ON klienti;  -- duplicitná s anon_read_klienti
-- anon_read_klienti zostáva (SELECT)
-- service_role_all_klienti zostáva (full access)

-- naberove_listy — analogicky
DROP POLICY IF EXISTS write_nabery ON naberove_listy;
DROP POLICY IF EXISTS read_nabery ON naberove_listy;
-- anon_read_naberove_listy zostáva
-- service_role_all_naberove_listy zostáva

-- obhliadky — anon_write_obhliadky (INSERT) + anon_update_obhliadky (UPDATE)
DROP POLICY IF EXISTS anon_write_obhliadky ON obhliadky;
DROP POLICY IF EXISTS anon_update_obhliadky ON obhliadky;
-- anon_read_obhliadky zostáva
-- service_role_all_obhliadky zostáva

-- nehnutelnosti, faktury, odberatelia — už mali len service_role write,
-- nemenia sa.

COMMIT;
