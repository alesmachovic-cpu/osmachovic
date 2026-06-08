-- ============================================================
-- 106: Monitor — data-minimizácia (GDPR čl. 5/14)
-- ============================================================
-- Monitor scrapuje cudzie portály. Ukladanie mena + telefónu súkromných
-- predajcov z nás robí prevádzkovateľa ich osobných údajov bez právneho
-- základu a bez splnenia informačnej povinnosti → GDPR riziko.
--
-- Riešenie: prestať UKLADAŤ osobné údaje. Klasifikácia súkromník/RK naďalej
-- prebieha pri scrape behu na TRANSIENTNÝCH dátach (v pamäti, nikdy do DB).
-- V DB ostávajú len údaje o objekte + link + výsledok klasifikácie.
--
-- POZOR: DROP COLUMN je nezvratné — existujúce hodnoty sa stratia (zámer).
-- ============================================================

-- 1. Najprv vynuluj (defenzívne — pre prípad replikácie/triggerov na hodnotách)
UPDATE monitor_inzeraty
SET predajca_meno = NULL,
    predajca_telefon = NULL,
    popis = NULL,
    raw_data = '{}'::jsonb
WHERE predajca_meno IS NOT NULL
   OR predajca_telefon IS NOT NULL
   OR popis IS NOT NULL
   OR raw_data <> '{}'::jsonb;

-- 2. Odstráň stĺpce s osobnými údajmi predajcu + voľný scrape text
ALTER TABLE monitor_inzeraty DROP COLUMN IF EXISTS predajca_meno;
ALTER TABLE monitor_inzeraty DROP COLUMN IF EXISTS predajca_telefon;
ALTER TABLE monitor_inzeraty DROP COLUMN IF EXISTS popis;
ALTER TABLE monitor_inzeraty DROP COLUMN IF EXISTS raw_data;

-- Ponechané (údaje o objekte, nie o osobe): url, typ, lokalita, cena, mena,
-- plocha, izby, foto_url, predajca_typ (len klasifikácia súkromník/RK),
-- poschodie, stav, dátumy, motivation_score, canonical_id, listed_on_n_portals.

-- 3. rk_directory — prestávame doň ukladať telefón/meno scrapnutých osôb.
--    Existujúce osobné záznamy vynulujeme (ponecháme len typ='rk' podľa
--    email_domain, čo je firemný/obchodný údaj, nie osobný údaj súkromníka).
--    Tabuľka môže ešte neexistovať na niektorých prostrediach → guard.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rk_directory') THEN
    -- Zmaž riadky ktoré sú identifikované len telefónom alebo menom (osobné údaje),
    -- bez email_domain. Riadky s email_domain (firemný identifikátor) ponecháme.
    DELETE FROM rk_directory
    WHERE (email_domain IS NULL OR email_domain = '')
      AND (telefon IS NOT NULL OR meno IS NOT NULL);
    -- U zvyšných (email_domain) vynuluj prípadné osobné polia.
    UPDATE rk_directory SET telefon = NULL, meno = NULL
    WHERE telefon IS NOT NULL OR meno IS NOT NULL;
  END IF;
END $$;
