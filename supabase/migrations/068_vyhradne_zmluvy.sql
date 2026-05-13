-- 068: Zmluvy o výhradnom sprostredkovaní
CREATE TABLE IF NOT EXISTS vyhradne_zmluvy (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  klient_id             UUID REFERENCES klienti(id) ON DELETE CASCADE,
  naber_id              UUID REFERENCES naberove_listy(id) ON DELETE SET NULL,
  company_id            UUID,

  -- Záujemcovia (vlastníci — z LV alebo ručne)
  -- [{meno, datum_narodenia, rc, bydlisko, email, telefon}]
  majitelia             JSONB NOT NULL DEFAULT '[]',

  -- Nehnuteľnosť
  okres                 TEXT,
  obec                  TEXT,
  kat_uzemie            TEXT,
  -- [{druh, supisne_cislo, cislo_bytu, lv_cislo, podiel}]
  stavby                JSONB NOT NULL DEFAULT '[]',
  -- [{cislo_parcely, vymera, druh, lv_cislo, podiel}]
  pozemky               JSONB NOT NULL DEFAULT '[]',

  -- Komerčné podmienky
  pozadovana_cena       NUMERIC,
  moznost_znizenia_dni  INTEGER,
  suma_znizenia         NUMERIC,

  provizna_text         TEXT,
  provizna_slovom       TEXT,
  provizna_suma         NUMERIC,
  dodatocna_provizna    TEXT,

  trvanie_mesiacov      INTEGER NOT NULL DEFAULT 6,
  predlzenie_mesiacov   INTEGER NOT NULL DEFAULT 3,
  datum_zacatia         DATE NOT NULL DEFAULT CURRENT_DATE,

  zastupena_meno        TEXT,

  -- Podpis
  podpis_data           TEXT,
  podpis_meta           JSONB,
  podpisane_at          TIMESTAMPTZ,

  pocet_rovnopisov      INTEGER NOT NULL DEFAULT 2,
  kluče_ks              INTEGER,
  kluče_poznamka        TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vyhradne_zmluvy ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_all_vyhradne ON vyhradne_zmluvy
  TO service_role USING (true) WITH CHECK (true);
