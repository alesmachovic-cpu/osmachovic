-- Náberové listy - digitálne tlačivá pre náber nehnuteľností
CREATE TABLE IF NOT EXISTS naberove_listy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  typ_nehnutelnosti TEXT NOT NULL CHECK (typ_nehnutelnosti IN ('byt', 'rodinny_dom', 'pozemok')),

  -- Lokalita
  kraj TEXT,
  okres TEXT,
  obec TEXT,
  cast_obce TEXT,
  kat_uzemie TEXT,
  ulica TEXT,
  supisne_cislo TEXT,
  cislo_orientacne TEXT,

  -- Nehnuteľnosť (spoločné)
  plocha NUMERIC,
  stav TEXT,
  poznamky_vybavenie TEXT,

  -- Typ-špecifické parametre (JSONB)
  parametre JSONB DEFAULT '{}',
  -- Byt: pocet_izieb, vlastnictvo, druzstvo, typ_domu, byt_cislo, poschodie, z_kolko, kurenie, typ_podlahy, anuita, vyhlad, mesacne_poplatky
  -- Dom: pocet_izieb, typ_domu, pocet_podlazi, rok_vystavby, pozemok_plocha, zahrada, kurenie, typ_podlahy, anuita, vyhlad, mesacne_poplatky
  -- Pozemok: druh_pozemku, pristupova_cesta, siete, ucelove_urcenie

  -- Vybavenie (checkboxy)
  vybavenie JSONB DEFAULT '{}',

  -- Označenie
  oznacenie TEXT DEFAULT 'ziadne',

  -- Majiteľ
  majitel TEXT,
  konatel TEXT,
  jednatel TEXT,
  kontakt_majitel TEXT,
  uzivatel TEXT,
  kontakt_uzivatel TEXT,

  -- Predaj
  predajna_cena NUMERIC,
  makler TEXT,
  zmluva BOOLEAN DEFAULT false,
  typ_zmluvy TEXT,
  datum_podpisu DATE,
  zmluva_do DATE,
  provizia TEXT,
  popis TEXT,

  -- Podpis klienta (base64 PNG)
  podpis_data TEXT,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now(),
  klient_id UUID
);

-- RLS povolenie
ALTER TABLE naberove_listy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verejný prístup na naberove_listy" ON naberove_listy FOR ALL USING (true) WITH CHECK (true);
