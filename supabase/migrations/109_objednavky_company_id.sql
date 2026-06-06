-- 109_objednavky_company_id.sql
-- B2 fix: tabuľka objednavky nemala company_id → žiadny multi-tenant scope na
-- app úrovni (IDOR/leak cez /api/objednavky). Pridávame company_id rovnako ako
-- má klienti. RLS policies objednavky UŽ MÁ identické s klienti
-- (authenticated_read USING(true) + service_role ALL) — nemeníme; multi-tenant
-- enforcement je app-level scope cez .eq("company_id") v route (vzor klienti).

alter table objednavky add column if not exists company_id uuid;

-- Backfill: company_id z klienti cez klient_id.
update objednavky o
set company_id = k.company_id
from klienti k
where o.klient_id = k.id and o.company_id is null;

-- Orphany (klient_id NULL alebo neexistujúci klient) → default firma (vzor 061).
update objednavky set company_id = 'a0000000-0000-0000-0000-000000000001'
where company_id is null;

alter table objednavky alter column company_id set not null;
create index if not exists idx_objednavky_company_id on objednavky(company_id);
