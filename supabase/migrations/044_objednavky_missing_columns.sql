-- Migration 044 — objednavky: pridaj chýbajúce stĺpce (bezpečné IF NOT EXISTS)
-- Tabuľka objednavky bola vytvorená manuálne bez migrácie.
-- Tento skript doplní stĺpce, ktoré kód predpokladá.

-- Cenové rozmedzie (ObjednavkaForm)
ALTER TABLE objednavky ADD COLUMN IF NOT EXISTS cena_od       NUMERIC;
ALTER TABLE objednavky ADD COLUMN IF NOT EXISTS cena_do       NUMERIC;

-- Slobodný text požiadaviek (matching)
ALTER TABLE objednavky ADD COLUMN IF NOT EXISTS poziadavky    TEXT;

-- Maklér zodpovedný za objednávku
ALTER TABLE objednavky ADD COLUMN IF NOT EXISTS makler        TEXT;

-- Podpis (SMS sign flow)
ALTER TABLE objednavky ADD COLUMN IF NOT EXISTS podpis        TEXT;

-- Timestamps
ALTER TABLE objednavky ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
