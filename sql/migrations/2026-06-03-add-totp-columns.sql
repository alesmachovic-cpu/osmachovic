-- 2026-06-03 — Add 2FA (TOTP) columns to users + auth_2fa_challenges table
--
-- Background: 2FA code shipped 24.5.+ ale prod DB (hokymscytscsewrpwdjf)
-- nemala migráciu. /api/auth/google/match a /api/auth/login majú v kóde
-- defensive fallback aby fungoval login bez týchto stĺpcov, ale 2FA setup
-- (nastavenia/security) zostane non-functional dokým táto migrácia nebehne.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste & Run.
-- Idempotent (IF NOT EXISTS) — bezpečné spustiť opakovane.

-- 1) TOTP columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS totp_secret              text,
  ADD COLUMN IF NOT EXISTS totp_enabled_at          timestamptz,
  ADD COLUMN IF NOT EXISTS totp_backup_codes        jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS totp_last_used_counter   bigint;

COMMENT ON COLUMN public.users.totp_secret IS 'Encrypted TOTP secret (AES-GCM via DOC_ENC_KEY). NULL = 2FA not setup.';
COMMENT ON COLUMN public.users.totp_enabled_at IS 'Timestamp keď user dokončil 2FA setup. NULL = 2FA disabled.';
COMMENT ON COLUMN public.users.totp_backup_codes IS 'Array of bcrypt-hashed backup recovery codes (10 ks po setup).';
COMMENT ON COLUMN public.users.totp_last_used_counter IS 'Posledný použitý TOTP counter (anti-replay window).';

-- 2) auth_2fa_challenges table — krátko-žijúce challenge tokens pre 2FA flow
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

-- RLS — challenges sa nikdy nečítajú frontendom, len service_role
ALTER TABLE public.auth_2fa_challenges ENABLE ROW LEVEL SECURITY;
-- (žiadne policy = nikto cez anon/authenticated; service_role obíde RLS)

-- 3) Cleanup expired challenges (optional cron job target)
-- DELETE FROM public.auth_2fa_challenges WHERE expires_at < now() - interval '1 day';
