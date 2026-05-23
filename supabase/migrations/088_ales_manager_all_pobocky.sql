-- 088_ales_manager_all_pobocky.sql
-- Aleš (CEO + super_admin) je formálne manažérom všetkých pobočiek.
-- Per Aleš (2026-05-23): "som admin a som zároveň aj manager pobočky".
--
-- Technicky to nič nemení na jeho permissions (super_admin má aj tak
-- canEditRecord → true pre čokoľvek), ale formálne ho registruje ako
-- manažéra do user_pobocky pre štatistiky, UI filtre "moja pobočka",
-- pridelenie kontaktnej osoby atď.
--
-- Tiež nastavíme jeho default pobočku na "bratislava" (hlavná).

BEGIN;

-- Default pobočka (single, pre legacy users.pobocka_id stĺpec)
UPDATE public.users
SET pobocka_id = 'bratislava'
WHERE id = 'ales' AND pobocka_id IS NULL;

-- Manager vo všetkých pobočkách (multi, via user_pobocky)
INSERT INTO public.user_pobocky(user_id, pobocka_id)
SELECT 'ales', p.id FROM public.pobocky p
ON CONFLICT DO NOTHING;

COMMIT;
