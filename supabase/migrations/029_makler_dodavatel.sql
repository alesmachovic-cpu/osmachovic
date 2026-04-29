-- ============================================================
-- 029: Dodávateľské údaje (faktúry) — per maklér v DB
-- ============================================================
-- Účel:
--   Doteraz boli údaje dodávateľa (firma, IČO, IBAN, bankové info, ...)
--   uložené v localStorage prehliadača per-user. Pri zmene zariadenia
--   alebo prehliadača používateľ stratil nastavenia + server-side PDF
--   nemal k nim prístup.
--
--   Presúvame to do DB. Jeden riadok na maklera (PK = user_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS makler_dodavatel (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nazov            text DEFAULT '',
  adresa           text DEFAULT '',
  ico              text DEFAULT '',
  dic              text DEFAULT '',
  ic_dph           text DEFAULT '',
  iban             text DEFAULT '',
  banka            text DEFAULT '',
  swift            text DEFAULT '',
  obch_register    text DEFAULT '',
  konst_symbol     text DEFAULT '',
  email            text DEFAULT '',
  telefon          text DEFAULT '',
  splatnost_dni    integer DEFAULT 14,
  uvodny_text      text DEFAULT '',
  poznamka_default text DEFAULT '',
  vystavil         text DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Auto-update `updated_at` pri zmene
CREATE OR REPLACE FUNCTION makler_dodavatel_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS makler_dodavatel_updated_at ON makler_dodavatel;
CREATE TRIGGER makler_dodavatel_updated_at
  BEFORE UPDATE ON makler_dodavatel
  FOR EACH ROW EXECUTE FUNCTION makler_dodavatel_set_updated_at();
