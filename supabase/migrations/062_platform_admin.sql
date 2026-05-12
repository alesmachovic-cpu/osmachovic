-- ============================================================
-- 062: Platform admin — super admin pre SaaS operatívu
-- ============================================================
-- platform_admin je špeciálna rola pre AMGD tím, ktorá má prístup
-- ku všetkým firmám (mimo RLS). Ukladá sa v stĺpci users.role.
-- ============================================================

-- Pridaj platform_admin ako validnú hodnotu roly (ak existuje constraint)
-- users.role je text bez CHECK constraint — stačí ho používať

-- Pohľad pre platform admin dashboard — všetky firmy s počtom userov
CREATE OR REPLACE VIEW platform_admin_companies AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.plan,
  c.is_active,
  c.stripe_customer_id,
  c.stripe_subscription_id,
  c.plan_valid_until,
  c.created_at,
  COUNT(u.id) AS user_count
FROM companies c
LEFT JOIN users u ON u.company_id = c.id
GROUP BY c.id
ORDER BY c.created_at DESC;

-- RLS: len service_role
ALTER VIEW platform_admin_companies OWNER TO postgres;
