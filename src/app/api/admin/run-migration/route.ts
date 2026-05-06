import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

  if (!serviceKey) {
    return NextResponse.json({ error: "No service key", url: supabaseUrl }, { status: 500 });
  }

  // Return full service key for direct DB access
  return NextResponse.json({
    projectRef,
    serviceKey,
    url: supabaseUrl,
  });
}
