-- 022 — Zvyšné chýbajúce stĺpce v `nehnutelnosti` (catch-all).
-- Pokračovanie 021 — doplnenie zvyšných polí používaných v InzeratForm.

alter table nehnutelnosti
  -- Core fields (boli v base schéme, ale niektoré projekty schema drift)
  add column if not exists typ                 text,
  add column if not exists nazov               text,
  add column if not exists lokalita            text,
  add column if not exists ulica               text,
  add column if not exists cena                numeric,
  add column if not exists plocha              numeric,
  add column if not exists izby                integer,
  add column if not exists stav                text,

  -- Rozšírené vlastnosti
  add column if not exists uzitkova_plocha     numeric,
  add column if not exists zastavana_plocha    numeric,
  add column if not exists podlahova_plocha    numeric,
  add column if not exists skladova_plocha     numeric,
  add column if not exists celkova_plocha      numeric,
  add column if not exists energeticky_certifikat text,
  add column if not exists energeticka_narocnost  text,
  add column if not exists typ_budovy          text,
  add column if not exists typ_vybavy          text,

  -- Priestory
  add column if not exists pozicia             text,
  add column if not exists poschodia_vyssie    integer,
  add column if not exists rok_vystavby        integer,
  add column if not exists rok_rekonstrukcie   integer,

  -- Toggles
  add column if not exists balkon              boolean default false,
  add column if not exists balkon_plocha       numeric,
  add column if not exists loggia              boolean default false,
  add column if not exists loggia_plocha       numeric,
  add column if not exists terasa              boolean default false,
  add column if not exists terasa_plocha       numeric,
  add column if not exists garaz               boolean default false,
  add column if not exists pivnica             boolean default false,
  add column if not exists verejne_parkovanie  boolean default false,
  add column if not exists sukromne_parkovanie boolean default false,
  add column if not exists spajza              boolean default false,
  add column if not exists sklad_toggle        boolean default false,
  add column if not exists dielna              boolean default false,
  add column if not exists vytah               boolean default false,

  -- Vykurovanie
  add column if not exists vykurovanie         jsonb default '{}'::jsonb,

  -- Mesačné náklady
  add column if not exists mesacne_naklady     numeric,
  add column if not exists naklady_detail      text,

  -- Právne vady
  add column if not exists pravne_vady         text,

  -- LV text
  add column if not exists lv_text             text,

  -- Rezerva
  add column if not exists h1                  text,
  add column if not exists meta_description    text;
