// Generátor seedu: `node --experimental-strip-types src/lib/seed-sql.mts > supabase/seed.sql`
// Vloží 7 webov (stav zo 17. 9. 2026) a účty maklérov (heslo ZmenMaHned2026).
import { DEFAULT_MANAZER, DEFAULT_MAKLERI, DEFAULT_NASTAVENIA } from "./defaults.ts";
const q = (o: unknown) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
let sql = "-- Seed webov a účtov. Spusti po schema.sql. Počiatočné heslo maklérov: ZmenMaHned2026\nBEGIN;\n\n";
sql += `INSERT INTO weby_settings (id, data) VALUES ('default', ${q(DEFAULT_NASTAVENIA)}) ON CONFLICT (id) DO NOTHING;\n\n`;
sql += "INSERT INTO weby_users (email, name, role, password_hash) VALUES\n" + DEFAULT_MAKLERI.map(m =>
  `  ('${m.data.email.toLowerCase()}', '${m.data.name.replace(/'/g, "''")}', 'makler', crypt('ZmenMaHned2026', gen_salt('bf')))`).join(",\n") + "\nON CONFLICT (email) DO NOTHING;\n\n";
sql += "INSERT INTO weby_sites (slug, typ, user_id, poradie, draft, published, published_at) VALUES\n";
const rows = [`  ('ales-machovic', 'manazer', (SELECT id FROM weby_users WHERE email = 'machovic@vianema.eu'), 0, ${q(DEFAULT_MANAZER)}, ${q(DEFAULT_MANAZER)}, now())`];
DEFAULT_MAKLERI.forEach((m, i) => rows.push(`  ('${m.slug}', 'makler', (SELECT id FROM weby_users WHERE email = '${m.data.email.toLowerCase()}'), ${i + 1}, ${q(m.data)}, ${q(m.data)}, now())`));
sql += rows.join(",\n") + "\nON CONFLICT (slug) DO NOTHING;\n\nCOMMIT;\n";
process.stdout.write(sql);
