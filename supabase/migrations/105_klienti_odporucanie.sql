-- 105_klienti_odporucanie.sql
-- Odporúčanie makléra: nový klient môže byť naviazaný na existujúceho klienta,
-- ktorý ho odporučil (word-of-mouth atribúcia). Aktívne odporúčanie = živý
-- vzťah → resetuje retention lehotu odporúčajúceho (F11, viď engagement.ts).

alter table klienti
  add column if not exists odporucil_klient_id uuid references klienti(id) on delete set null;

-- Index pre dopyt "koho tento klient odporučil".
create index if not exists klienti_odporucil_idx
  on klienti (odporucil_klient_id) where odporucil_klient_id is not null;
