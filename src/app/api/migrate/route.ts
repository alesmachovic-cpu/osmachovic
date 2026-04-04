import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const s = createClient(supabaseUrl, supabaseKey);

  // Add 'makler' text column to klienti if it doesn't exist
  const { error } = await s.rpc("exec_sql", {
    sql: "ALTER TABLE klienti ADD COLUMN IF NOT EXISTS makler text",
  });

  if (error) {
    // Try raw SQL via postgrest - not available with anon key
    return NextResponse.json({ error: error.message, hint: "Run this SQL in Supabase dashboard: ALTER TABLE klienti ADD COLUMN IF NOT EXISTS makler text;" });
  }

  return NextResponse.json({ ok: true });
}
