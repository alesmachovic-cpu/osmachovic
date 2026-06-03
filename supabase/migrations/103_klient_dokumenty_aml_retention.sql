-- 103_klient_dokumenty_aml_retention.sql
-- AML retention vs GDPR výmaz: AML doklady (kópia OP, identifikácia, overovacia
-- dokumentácia) sa podľa § 20 zák. 297/2008 musia uchovať 5 rokov po skončení
-- obchodného vzťahu (právny základ čl. 6 ods.1 c GDPR). Právo na výmaz sa na ne
-- NEVZŤAHUJE (čl. 17 ods.3 b). GDPR erasure ich teda NESMIE zmazať počas lehoty.

-- aml_retention: dokument podlieha AML retencii (nemazať pri GDPR výmaze).
alter table klient_dokumenty add column if not exists aml_retention boolean not null default false;
-- retention_do: dátum, po ktorom sa AML doklad smie (a má) zmazať.
alter table klient_dokumenty add column if not exists retention_do date;

-- Backfill: existujúce identifikačné / AML doklady označ ako retention.
-- (Len identifikácia a overovacia dokumentácia podľa § 7-8 AMLZ.)
update klient_dokumenty
set aml_retention = true
where aml_retention = false
  and type in ('Identifikácia', 'OP', 'Občiansky preukaz', 'AML', 'KYC');

create index if not exists klient_dokumenty_retention_do_idx
  on klient_dokumenty (retention_do) where retention_do is not null;
