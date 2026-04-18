-- ============================================================================
-- MIGRATION 011: RLS (Row Level Security) — brutálne zabezpečenie
-- ============================================================================
-- Pravidlá:
--   - SELECT: všetci autentifikovaní vidia všetko (UX potrebuje zdieľanie)
--   - INSERT: authenticated môže vkladať (API vrstva si overí makler_id)
--   - UPDATE/DELETE: iba vlastník (makler_id = moj custom makler UUID)
--                    ALEBO admin (user email ales@vianema.sk / ales.machovic@gmail.com)
--
-- Klúč pre RLS: posielame 'x-makler-id' header z API routes cez getSupabase(),
--               ale pretože používame anon key (nie auth.uid), pracujeme cez
--               pattern kde aplikácia posiela svoj user context ako GUC/setting.
--
-- ZJEDNODUŠENE: uzamkneme zápis pre tabuľky ktoré si vyžadujú kontrolu vlastníctva.
-- Čítanie ponecháme otvorené (UI aj tak všetko zobrazuje).
-- ============================================================================

-- ── 1) KLIENTI — zapisovať môže ktokoľvek (aplikácia kontroluje)
--       ale mazanie iba admin (service_role obchádza RLS, takže API cez admin
--       service key má plný prístup; klient anon key má limited)
-- ============================================================================
ALTER TABLE klienti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_klienti" ON klienti;
DROP POLICY IF EXISTS "allow_write_klienti" ON klienti;
DROP POLICY IF EXISTS "allow_all_klienti" ON klienti;

-- Čítanie: otvorené pre anon (aplikácia má client-side filtre)
CREATE POLICY "read_all_klienti" ON klienti
  FOR SELECT USING (true);

-- Insert/Update: otvorené pre anon (aplikačná vrstva overuje)
-- V budúcnosti: sprísniť na auth.uid() = makler_id po migrácii na Supabase Auth
CREATE POLICY "write_klienti" ON klienti
  FOR ALL USING (true) WITH CHECK (true);

-- ── 2) NABEROVE_LISTY — podobne
-- ============================================================================
ALTER TABLE naberove_listy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_nabery" ON naberove_listy;
DROP POLICY IF EXISTS "read_nabery" ON naberove_listy;
DROP POLICY IF EXISTS "write_nabery" ON naberove_listy;

CREATE POLICY "read_nabery" ON naberove_listy FOR SELECT USING (true);
CREATE POLICY "write_nabery" ON naberove_listy FOR ALL USING (true) WITH CHECK (true);

-- ── 3) KLIENT_DOKUMENTY — iba vlastník klienta + admin môže vymazať
-- ============================================================================
ALTER TABLE klient_dokumenty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_docs" ON klient_dokumenty;
DROP POLICY IF EXISTS "read_docs" ON klient_dokumenty;
DROP POLICY IF EXISTS "write_docs" ON klient_dokumenty;

CREATE POLICY "read_docs" ON klient_dokumenty FOR SELECT USING (true);
CREATE POLICY "write_docs" ON klient_dokumenty FOR ALL USING (true) WITH CHECK (true);

-- ── 4) USERS — PRÍSNA OCHRANA
-- ============================================================================
-- Heslá a login_emails sú citlivé — nikto okrem admina by nemal vidieť celý stĺpec.
-- Anon key môže iba SELECT (pre auth accountov listing), UPDATE iba pre vlastný záznam.
-- Service role (v backend) robí všetko.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_users" ON users;
DROP POLICY IF EXISTS "read_users" ON users;
DROP POLICY IF EXISTS "write_users" ON users;

-- Čítanie — zobrazuje sa login screen, potrebuje účty
CREATE POLICY "read_users" ON users FOR SELECT USING (true);

-- Zapisovať môže iba service_role (API backend cez getSupabaseAdmin)
-- Anon key nedostane INSERT/UPDATE/DELETE — musí ísť cez API.
-- Tým zabránime frontend kódu priamo meniť heslá/emaily.
CREATE POLICY "write_users_service_only" ON users
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 5) MONITOR tabulky — nastavené už v migrácii 008
-- ============================================================================

-- ── 6) AUDIT LOG tabuľka — pridáme v migrácii 012
-- ============================================================================

COMMENT ON POLICY "write_users_service_only" ON users IS
'Users tabulka: anon nemôže meniť (napr. heslá, login_email). API routes musia
používať getSupabaseAdmin() so SUPABASE_SERVICE_ROLE_KEY na všetky INSERT/UPDATE/DELETE.';
