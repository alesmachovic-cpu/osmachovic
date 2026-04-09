-- Centrálne úložisko dokumentov pre klienta
-- Dokumenty nahrané v náberáku, inzeráte alebo rezervácii sa ukladajú sem
create table if not exists klient_dokumenty (
  id uuid primary key default gen_random_uuid(),
  klient_id uuid not null references klienti(id) on delete cascade,
  name text not null,
  type text,            -- "LV", "Znalecký posudok", "Zmluva", "PDF", "Foto", ...
  size integer,
  source text,          -- "naber" | "inzerat" | "rezervacia"
  mime text,
  text_content text,    -- extrahovaný OCR/text (nullable)
  data_base64 text,     -- voliteľne base64 obsah (malé súbory < 5MB)
  created_at timestamptz default now()
);

create index if not exists klient_dokumenty_klient_id_idx on klient_dokumenty(klient_id);
create index if not exists klient_dokumenty_created_at_idx on klient_dokumenty(created_at desc);
