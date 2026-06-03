-- 102_parse_failures.sql
-- Fix #4 (failure UX — review fronta): keď AI parsovanie dokumentu zlyhá,
-- zalogujeme to sem, aby sme v produkcii videli KTORÉ dokumenty zlyhávajú
-- (a vedeli doladiť prompt / model). Nie je to audit_log — toto je operatívna
-- fronta na review, nemá forenzný invariant.

create table if not exists parse_failures (
  id uuid primary key default gen_random_uuid(),
  klient_id uuid references klienti(id) on delete set null,
  company_id uuid,
  actor_id uuid,
  filename text,
  doc_type text,                       -- lv | posudok | zmluva | docx | pdf | image
  source text,                         -- parse-doc | parse-lv | parse-pdf
  error text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists parse_failures_created_idx on parse_failures (created_at desc);
create index if not exists parse_failures_unreviewed_idx on parse_failures (reviewed) where reviewed = false;

-- RLS: prístup len cez service_role (parse routes zapisujú, admin endpoint číta
-- s app-level scope). Žiadny anon/authenticated priamy prístup cez PostgREST.
alter table parse_failures enable row level security;
