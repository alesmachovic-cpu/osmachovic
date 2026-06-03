-- 101_klient_dokumenty_unique.sql
-- Fix #6 (race condition / TOCTOU): POST /api/klient-dokumenty robil
-- check-then-insert bez DB constraintu → dvaja makléri nahrávajúci ten istý
-- dokument naraz vytvorili duplikát. Pridávame unique index ako tvrdú poistku.

-- 1) Zjednoť NULL size na 0 (kód deduplikuje na size ?? 0).
update klient_dokumenty set size = 0 where size is null;

-- 2) Odstráň existujúce duplikáty — ponechaj najstarší záznam
--    (pri zhodnom created_at rozhodne menšie id).
delete from klient_dokumenty a
using klient_dokumenty b
where a.klient_id = b.klient_id
  and a.name = b.name
  and coalesce(a.size, 0) = coalesce(b.size, 0)
  and (a.created_at > b.created_at
       or (a.created_at = b.created_at and a.id > b.id));

-- 3) Unique index — DB teraz odmietne duplikát aj pri súbežnom inserte.
create unique index if not exists klient_dokumenty_klient_name_size_uniq
  on klient_dokumenty (klient_id, name, coalesce(size, 0));
