-- 043: Pohľady pre Štatistiky — Súťaž + Pobočky
-- deals = nehnuteľnosti so stav_inzeratu IN ('predany','archiv') kde je cena
-- Použivame naberove_listy.datum_naberu pre "uzavretie" keďže nehnutelnosti.updated_at
-- nie je spoľahlivý. Fallback na created_at.

-- VIEW: v_deals — jeden riadok = jeden uzavretý obchod
CREATE OR REPLACE VIEW v_deals AS
SELECT
  n.id,
  n.nazov,
  n.cena                                       AS obrat,
  n.provizia_hodnota                           AS provizia_firmy,
  n.provizia_typ,
  n.lokalita,
  n.typ_nehnutelnosti                          AS typ,
  n.stav_inzeratu,
  n.makler                                     AS makler_meno,
  n.makler_id                                  AS makler_user_id,
  n.makler_email,
  n.created_at,
  n.updated_at,
  -- pre period filtrovanie: berieme updated_at ako ~dátum predaja
  COALESCE(n.updated_at, n.created_at)         AS deal_date
FROM nehnutelnosti n
WHERE n.stav_inzeratu IN ('predany', 'predaný', 'archiv')
  AND n.cena IS NOT NULL
  AND n.cena > 0;

GRANT SELECT ON v_deals TO anon, authenticated, service_role;

-- VIEW: v_makler_stats — agregáty za ALL time (period filter client-side)
CREATE OR REPLACE VIEW v_makler_stats AS
SELECT
  d.makler_user_id,
  d.makler_meno,
  d.makler_email,
  COUNT(*)                                     AS pocet_obchodov,
  SUM(d.obrat)                                 AS celkovy_obrat,
  AVG(d.provizia_firmy)                        AS avg_provizia_firmy,
  MIN(d.deal_date)                             AS first_deal,
  MAX(d.deal_date)                             AS last_deal
FROM v_deals d
GROUP BY d.makler_user_id, d.makler_meno, d.makler_email;

GRANT SELECT ON v_makler_stats TO anon, authenticated, service_role;
