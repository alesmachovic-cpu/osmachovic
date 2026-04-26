-- ============================================================
-- 025: GDPR — explicitný súhlas + audit trail pre podpisy
-- ============================================================
-- Účel: pri elektronickom podpise (obhliadka, náberák) zaznamenať
--   1) explicitný súhlas (gdpr_consent BOOLEAN)
--   2) audit trail v JSONB (IP adresa, user-agent, timestamp, verzia GDPR
--      textu, súhlas s konkrétnymi účelmi)
--   3) anonymizáciu (klient.anonymized_at) — právo na zabudnutie
-- ============================================================

-- 1) obhliadky: GDPR súhlas + audit metadata
ALTER TABLE obhliadky ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN DEFAULT false;
ALTER TABLE obhliadky ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ;
ALTER TABLE obhliadky ADD COLUMN IF NOT EXISTS podpis_meta JSONB;
-- podpis_meta example: { ip: "1.2.3.4", user_agent: "...", gdpr_version: "v1.0",
--                       consent_evidence: true, consent_marketing: false }

-- 2) naberove_listy: rovnaký GDPR pattern
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS gdpr_consent BOOLEAN DEFAULT false;
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ;
ALTER TABLE naberove_listy ADD COLUMN IF NOT EXISTS podpis_meta JSONB;

-- 3) klienti: právo na zabudnutie (anonymizácia)
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
-- Po anonymizácii: meno = "[anonymizovaný]", telefon = NULL, email = NULL,
-- poznamka = NULL, lv_data = NULL. Obhliadka/náberák zostáva pre evidenciu
-- (právny základ: oprávnený záujem RK na evidenciu sprostredkovania).

CREATE INDEX IF NOT EXISTS klienti_anonymized_idx ON klienti(anonymized_at);
