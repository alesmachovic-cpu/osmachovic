-- 032_id_defaults_and_dedup.sql
--
-- Tri samostatné fixy ktoré boli odhalené paralelným multi-user testom:
--
-- 1. klienti.id a nehnutelnosti.id boli UUID NOT NULL bez DEFAULT — každý
--    INSERT bez explicitného id zhasne s 23502. To okrem iného tichom rozbíjala
--    auto-vytvorenie kupujúceho klienta v /api/obhliadky a /api/inzerat/save.
--
-- 2. faktury (user_id, cislo_faktury) nemali unique — pri 2 paralelných
--    POSToch s rovnakým makler_id mohli vzniknúť dve faktúry s rovnakým
--    číslom. POST handler teraz robí retry on 23505 — ale potrebuje
--    constraint, inak retry nemá čo zachytiť.
--
-- 3. klienti.telefon nemal žiaden anti-dup. Dvaja makléri overujúci toho
--    istého klienta v rovnakom čase vytvorili 2 záznamy. Partial unique
--    index na normalizované číslo to znemožní.

-- 1) UUID defaults — pred touto migráciou bolo defaultu zbavených 8 tabuliek;
-- ktokoľvek kto INSERT bez explicitného id spadol s 23502.
ALTER TABLE klienti         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE nehnutelnosti   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE makleri         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE faktury         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE faktura_polozky ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE naberove_listy  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE objednavky      ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE odberatelia     ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2) Unique faktura (user_id, cislo_faktury) — partial, ignoruj prázdne
CREATE UNIQUE INDEX IF NOT EXISTS faktury_user_cislo_uniq
  ON faktury (user_id, cislo_faktury)
  WHERE cislo_faktury IS NOT NULL AND user_id IS NOT NULL;

-- 3) Helper na normalizáciu SK telefónu (digits, +421 prefix)
CREATE OR REPLACE FUNCTION normalize_sk_phone(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p IS NULL OR length(trim(p)) = 0 THEN NULL
    WHEN regexp_replace(p, '[^0-9+]', '', 'g') ~ '^\+421[0-9]+$'
      THEN regexp_replace(p, '[^0-9+]', '', 'g')
    WHEN regexp_replace(p, '[^0-9]', '', 'g') ~ '^00421[0-9]+$'
      THEN '+' || substring(regexp_replace(p, '[^0-9]', '', 'g') from 3)
    WHEN regexp_replace(p, '[^0-9]', '', 'g') ~ '^0[0-9]+$'
      THEN '+421' || substring(regexp_replace(p, '[^0-9]', '', 'g') from 2)
    ELSE regexp_replace(p, '[^0-9+]', '', 'g')
  END;
$$;

-- 4) Partial unique index na normalizovaný telefón klienta — len pre nové
--    záznamy (created_at >= dátum migrácie). Ignorujeme legacy duplikáty
--    (3 páry ktoré v DB existovali pred touto migráciou — Kristiana
--    Ivancová, Vlastimil Feiner, Schmer Erik), nech ich Aleš zmerguje sám.
CREATE UNIQUE INDEX IF NOT EXISTS klienti_telefon_uniq
  ON klienti (normalize_sk_phone(telefon))
  WHERE telefon IS NOT NULL
    AND anonymized_at IS NULL
    AND created_at >= '2026-05-01 09:00:00+00';
