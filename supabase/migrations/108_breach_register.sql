-- 108_breach_register.sql
-- G9: Evidencia porušení ochrany osobných údajov (GDPR čl. 33 ods. 5 — povinný
-- register VŠETKÝCH porušení, aj nenahlásených). Playbook (security-audit/
-- breach-playbook.md) ho vyžaduje; doteraz neexistovala tabuľka.

create table if not exists breach_register (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid,
  detected_at       timestamptz not null default now(),   -- kedy sme sa dozvedeli
  occurred_at       timestamptz,                           -- kedy nastalo (ak vieme)
  description       text not null,                         -- čo sa stalo
  data_categories   text,                                  -- typy údajov (kontakty/OP/AML…)
  affected_count    integer,                               -- odhad počtu dotknutých
  risk_level        text not null default 'normal',        -- none | normal | high
  reported_uoou     boolean not null default false,        -- nahlásené ÚOOÚ (čl. 33)
  reported_uoou_at  timestamptz,
  subjects_notified boolean not null default false,        -- informovaní dotknutí (čl. 34)
  measures          text,                                  -- nápravné opatrenia
  created_by        uuid,
  created_at        timestamptz not null default now()
);

create index if not exists breach_register_detected_idx on breach_register (detected_at desc);

-- RLS: prístup len cez service_role (API s admin gate). Žiadny anon/authenticated
-- priamy prístup — register porušení je citlivý interný dokument.
alter table breach_register enable row level security;
