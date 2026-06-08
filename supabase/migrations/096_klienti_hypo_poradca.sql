-- 096_klienti_hypo_poradca.sql
-- Per Aleš (2026-05-24): pri statuse "Čaká na hypotéku" treba evidovať
-- kto rieši hypotéku — 3 možnosti:
--   1) náš hypo poradca (entita zatiaľ neexistuje — FK rezervujeme do users)
--   2) externý poradca (meno + firma)
--   3) klient si rieši sám (banka)

BEGIN;

ALTER TABLE public.klienti
  ADD COLUMN IF NOT EXISTS hypo_typ TEXT
    CHECK (hypo_typ IS NULL OR hypo_typ IN ('nas_poradca', 'externy', 'klient_sam')),
  ADD COLUMN IF NOT EXISTS hypo_meno TEXT,
  ADD COLUMN IF NOT EXISTS hypo_firma TEXT,
  ADD COLUMN IF NOT EXISTS hypo_poradca_id TEXT
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS klienti_hypo_poradca_id_idx
  ON public.klienti(hypo_poradca_id)
  WHERE hypo_poradca_id IS NOT NULL;

COMMENT ON COLUMN public.klienti.hypo_typ IS
  'Kto rieši hypotéku: nas_poradca (FK hypo_poradca_id), externy (meno+firma), klient_sam (firma = banka).';
COMMENT ON COLUMN public.klienti.hypo_meno IS 'Meno externého hypo poradcu.';
COMMENT ON COLUMN public.klienti.hypo_firma IS 'Firma externého poradcu, alebo banka pri klient_sam.';
COMMENT ON COLUMN public.klienti.hypo_poradca_id IS 'FK na users.id — náš interný hypo poradca (rola sa pridá neskôr).';

COMMIT;
