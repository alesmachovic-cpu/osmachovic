-- 104_klienti_last_engagement.sql
-- Presné meranie nečinnosti pre retention (F11). Doteraz sa používal updated_at
-- (zmena záznamu — hrubý odhad). last_engagement_at sa nastaví len pri REÁLNOM
-- signáli živého vzťahu: zalogovaný kontakt klienta (hovor/stretnutie/email/
-- poznámka), udelenie súhlasu, nová obhliadka. Jednostranné odoslanie mailu
-- z našej strany ho NEnastavuje (to nie je dôkaz živého vzťahu — viď
-- security-audit/retention-policy.md).

alter table klienti add column if not exists last_engagement_at timestamptz;

-- Backfill existujúcich z reálnej poslednej aktivity (nie "teraz", aby sme
-- umelo neresetovali všetkých).
update klienti
set last_engagement_at = coalesce(updated_at, created_at, now())
where last_engagement_at is null;

-- Nové záznamy: založenie klienta = engagement → default now().
alter table klienti alter column last_engagement_at set default now();

create index if not exists klienti_last_engagement_idx on klienti (last_engagement_at);
