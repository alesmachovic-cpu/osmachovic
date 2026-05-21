-- 081_users_telefon.sql
-- Pridáva stĺpec `telefon` do users tabuľky.
-- Pôvodne sa makler.telefon ukladal iba do localStorage (per-browser), nepretrvával do DB.
-- Lekcia (2026-05-21): Aleš nahlásil "nefunguje uprava maklera" — handleSaveMakler v
-- /nastavenia ukladal iba localStorage, nikdy nevolal API.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telefon TEXT;

COMMENT ON COLUMN public.users.telefon IS 'Telefónny kontakt maklera (formát +421...). Zobrazuje sa v inzerátoch a klientskej komunikácii.';
