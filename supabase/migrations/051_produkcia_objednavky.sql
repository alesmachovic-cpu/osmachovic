-- Migration 051 — produkcia_objednavky
-- Produkčné objednávky (foto-video, homestaging, certifikát) pre predávajúcich klientov.
-- ODLIŠNÉ od tabuľky objednavky (tá je pre kupujúcich / matching systém).

create table if not exists produkcia_objednavky (
  id               uuid primary key default gen_random_uuid(),
  klient_id        uuid not null references klienti(id) on delete cascade,
  makler_id        text not null,
  stav             text not null default 'draft'
                     check (stav in ('draft','submitted','scheduled','in_progress','completed','cancelled')),
  typ              text not null default 'foto_video'
                     check (typ in ('foto_video','homestaging','certifikat')),

  -- Snapshot klienta pri vytvorení (GDPR: anonymizácia klienta neovplyvní históriu)
  snapshot_meno     text,
  snapshot_telefon  text,
  snapshot_lokalita text,

  -- Detaily objednávky (foto-video špecifické polia v JSONB)
  details           jsonb not null default '{}',

  -- Workflow
  scheduled_date    timestamptz,
  submitted_at      timestamptz,
  completed_at      timestamptz,
  deliverable_url   text,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table produkcia_objednavky enable row level security;

create index if not exists produkcia_objednavky_klient_id_idx on produkcia_objednavky(klient_id);
create index if not exists produkcia_objednavky_stav_idx       on produkcia_objednavky(stav);
create index if not exists produkcia_objednavky_makler_id_idx  on produkcia_objednavky(makler_id);

notify pgrst, 'reload schema';
