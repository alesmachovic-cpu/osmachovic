-- 2026-06-03 — Backfill prod DB schema (hokymscytscsewrpwdjf) na úroveň dev
--
-- Background: Code shipped 24.5.+ s 2FA features + iné drobné stĺpce, ale prod DB
-- nikdy nedostala migrácie. Endpointy SELECTujúce neexistujúce stĺpce vracali 500,
-- čo lámalo:
--   - /api/auth/google/match  (totp_enabled_at) → "nie je povolený"
--   - /api/users (telefon)    → AuthProvider loadAccounts crash → login form sa vrátil
--   - /api/nabery (makler_id) → list náberákov 500
--
-- Migráciu som spustil cez Playwright v Supabase SQL editori 2026-06-03 ~03:33-04:05 CEST.
-- Tento súbor zostáva v repe ako audit trail + idempotentný backup (IF NOT EXISTS).

-- ───────────────────────────────────────────────────────────────────────────
-- 1) TOTP columns + auth_2fa_challenges (pre 2FA setup, /api/auth/google/match)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS totp_secret              text,
  ADD COLUMN IF NOT EXISTS totp_enabled_at          timestamptz,
  ADD COLUMN IF NOT EXISTS totp_backup_codes        jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS totp_last_used_counter   bigint;

COMMENT ON COLUMN public.users.totp_secret IS 'Encrypted TOTP secret (AES-GCM via DOC_ENC_KEY). NULL = 2FA not setup.';
COMMENT ON COLUMN public.users.totp_enabled_at IS 'Timestamp keď user dokončil 2FA setup. NULL = 2FA disabled.';
COMMENT ON COLUMN public.users.totp_backup_codes IS 'Array of bcrypt-hashed backup recovery codes (10 ks po setup).';
COMMENT ON COLUMN public.users.totp_last_used_counter IS 'Posledný použitý TOTP counter (anti-replay window).';

CREATE TABLE IF NOT EXISTS public.auth_2fa_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenge   text NOT NULL UNIQUE,
  ip          text,
  user_agent  text,
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE INDEX IF NOT EXISTS auth_2fa_challenges_challenge_idx  ON public.auth_2fa_challenges (challenge);
CREATE INDEX IF NOT EXISTS auth_2fa_challenges_user_id_idx    ON public.auth_2fa_challenges (user_id);
CREATE INDEX IF NOT EXISTS auth_2fa_challenges_expires_at_idx ON public.auth_2fa_challenges (expires_at);

ALTER TABLE public.auth_2fa_challenges ENABLE ROW LEVEL SECURITY;
-- (žiadne policy = nikto cez anon/authenticated; service_role obíde RLS)

-- ───────────────────────────────────────────────────────────────────────────
-- 2) users.telefon — referenced by /api/users GET (AuthProvider.loadAccounts)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telefon text;

COMMENT ON COLUMN public.users.telefon IS 'Self-editable telefónne číslo, zobrazené v profile + tím listingu.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3) naberove_listy.makler_id — denormalized owner pre /api/nabery filter
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.naberove_listy
  ADD COLUMN IF NOT EXISTS makler_id uuid;

COMMENT ON COLUMN public.naberove_listy.makler_id IS 'Denormalizovaný owner makléra (= klienti.makler_id na čase POST). Index pre rýchle ?mine=1 filtrovanie.';

-- Backfill z existujúcich riadkov: ak má náberák klient_id, prevezmi klient.makler_id
UPDATE public.naberove_listy nl
SET makler_id = k.makler_id
FROM public.klienti k
WHERE nl.klient_id = k.id AND nl.makler_id IS NULL;

CREATE INDEX IF NOT EXISTS naberove_listy_makler_id_idx ON public.naberove_listy (makler_id);
