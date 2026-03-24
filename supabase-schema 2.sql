-- OS Machovič · Databázová schéma
-- Spusti v Supabase → SQL Editor

-- === KLIENTI ===
create table if not exists klienti (
  id            uuid primary key default gen_random_uuid(),
  meno          text not null,
  mobil         text,
  email         text,
  rozpocet_min  numeric,
  rozpocet_max  numeric,
  lokalita      text,
  typ           text check (typ in ('byt', 'dom', 'pozemok')),
  priorita      text not null default 'stredna' check (priorita in ('vysoka', 'stredna', 'nizka')),
  poznamka      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- === NEHNUTEĽNOSTI ===
create table if not exists nehnutelnosti (
  id              uuid primary key default gen_random_uuid(),
  nazov           text not null,
  typ             text not null check (typ in ('byt', 'dom', 'pozemok')),
  lokalita        text not null,
  cena            numeric not null,
  plocha          numeric,
  izby            integer,
  poschodie       integer,
  popis           text,
  stav            text check (stav in ('nova', 'rekonstruovana', 'povodny_stav', 'novostavba')),
  ai_skore        numeric check (ai_skore >= 0 and ai_skore <= 10),
  ai_analyza      text,
  url_inzercia    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- === LOGY ===
create table if not exists logy (
  id                 uuid primary key default gen_random_uuid(),
  typ                text not null,
  popis              text not null,
  klient_id          uuid references klienti(id) on delete set null,
  nehnutelnost_id    uuid references nehnutelnosti(id) on delete set null,
  metadata           jsonb,
  created_at         timestamptz not null default now()
);

-- === AUTO updated_at ===
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger klienti_updated_at
  before update on klienti
  for each row execute function update_updated_at();

create or replace trigger nehnutelnosti_updated_at
  before update on nehnutelnosti
  for each row execute function update_updated_at();

-- === ROW LEVEL SECURITY ===
alter table klienti enable row level security;
alter table nehnutelnosti enable row level security;
alter table logy enable row level security;

-- Politiky: povolenie všetkého pre anon kľúč (upraviť po pridaní autentifikácie)
create policy "allow_all_klienti" on klienti for all using (true) with check (true);
create policy "allow_all_nehnutelnosti" on nehnutelnosti for all using (true) with check (true);
create policy "allow_all_logy" on logy for all using (true) with check (true);
