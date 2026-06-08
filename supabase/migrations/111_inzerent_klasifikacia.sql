-- ============================================================
-- 111: Monitor — učenie klasifikácie cez inzerent_id (override loop)
-- ============================================================
-- Keď maklér ručne označí inzerát ako RK/súkromník, zapamätáme si to pre celý
-- účet predajcu (inzerent_id) → ďalšie inzeráty toho istého účtu sa auto-
-- klasifikujú s plnou istotou. Náhrada za rk_directory (ktorý bežal na telefóne/
-- mene) v GDPR-bezpečnej forme: inzerent_id je ANONYMNÉ ID účtu, NIE kontakt/meno.
-- Vedomé rozhodnutie CEO (2026-06-04), v duchu migr. 110.
-- ============================================================

CREATE TABLE IF NOT EXISTS inzerent_klasifikacia (
  inzerent_id    text PRIMARY KEY,                 -- napr. "bazos:12345" (anonymné)
  typ            text NOT NULL CHECK (typ IN ('rk','sukromny')),
  pridal_user_id text REFERENCES users(id) ON DELETE SET NULL,
  poznamka       text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inzerent_klasifikacia ENABLE ROW LEVEL SECURITY;

-- Čítanie: prihlásení používatelia. Zápis: len service_role (cez classify-override).
CREATE POLICY "inzerent_klasifikacia_select_auth" ON inzerent_klasifikacia
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inzerent_klasifikacia_all_service" ON inzerent_klasifikacia
  TO service_role USING (true) WITH CHECK (true);
