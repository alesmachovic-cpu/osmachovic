-- 087_user_pobocky_multi.sql
-- Manažér môže mať viac pobočiek (1:N). Aleš (2026-05-23): "manager vediet
-- pridelenu pobočku a tym aj makléov pod pobockou" → viac pobočiek treba.
--
-- Schéma:
--   - nová join tabuľka user_pobocky(user_id, pobocka_id)
--   - existujúce users.pobocka_id sa migruje (every row → INSERT into join)
--   - users.pobocka_id PONECHANÉ (default pre maklérov ostáva ako je)
--   - manazer rola číta z user_pobocky (môže mať N záznamov)

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_pobocky (
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pobocka_id text NOT NULL REFERENCES public.pobocky(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pobocka_id)
);

-- index pre rýchle "ktoré pobočky má užívateľ X"
CREATE INDEX IF NOT EXISTS idx_user_pobocky_user ON public.user_pobocky(user_id);
-- index pre rýchle "kto sú maklieri v pobočke Y"
CREATE INDEX IF NOT EXISTS idx_user_pobocky_pobocka ON public.user_pobocky(pobocka_id);

-- Migrácia existujúcich dát: každý user s pobocka_id dostane záznam v join tabuľke.
-- ON CONFLICT DO NOTHING — migrácia je idempotentná, môžeme spustiť opakovane.
INSERT INTO public.user_pobocky(user_id, pobocka_id)
SELECT id, pobocka_id FROM public.users WHERE pobocka_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: každý user vidí len SVOJE priradenia, admin/majiteľ vidí všetko.
ALTER TABLE public.user_pobocky ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_pobocky_read ON public.user_pobocky;
CREATE POLICY user_pobocky_read ON public.user_pobocky
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::text AND u.role IN ('super_admin', 'majitel')
    )
  );

-- INSERT/UPDATE/DELETE — LEN admin/majiteľ (per Aleš 2026-05-23: "len majitel a admin")
DROP POLICY IF EXISTS user_pobocky_write ON public.user_pobocky;
CREATE POLICY user_pobocky_write ON public.user_pobocky
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::text AND u.role IN ('super_admin', 'majitel')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::text AND u.role IN ('super_admin', 'majitel')
    )
  );

COMMENT ON TABLE public.user_pobocky IS 'Manažér môže byť priradený k N pobočkám. Maklér typicky pri users.pobocka_id (single).';
COMMENT ON COLUMN public.user_pobocky.user_id IS 'FK na users.id (rola manazer alebo nižšia)';
COMMENT ON COLUMN public.user_pobocky.pobocka_id IS 'FK na pobocky.id — manažér môže spravovať záznamy maklérov v tejto pobočke';

COMMIT;
