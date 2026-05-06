import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MIGRATION_SQL = `
ALTER TABLE monitor_inzeraty
  ADD COLUMN IF NOT EXISTS poschodie TEXT,
  ADD COLUMN IF NOT EXISTS stav      TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitor_inzeraty' AND column_name = 'cena_za_m2'
  ) THEN
    EXECUTE 'ALTER TABLE monitor_inzeraty ADD COLUMN cena_za_m2 NUMERIC GENERATED ALWAYS AS (CASE WHEN plocha > 0 THEN ROUND(cena / plocha, 0) ELSE NULL END) STORED';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_cena_za_m2 ON monitor_inzeraty(cena_za_m2);
CREATE INDEX IF NOT EXISTS idx_monitor_inzeraty_stav ON monitor_inzeraty(stav);
`;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    return NextResponse.json({ error: "No service key", url: supabaseUrl }, { status: 500 });
  }

  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: MIGRATION_SQL }),
  });

  const text = await res.text();
  return NextResponse.json({
    status: res.status,
    result: text,
    projectRef,
    keyPrefix: serviceKey.substring(0, 15),
  });
}
