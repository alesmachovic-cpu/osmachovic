import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "NOT SET";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ? "SET (" + process.env.GOOGLE_CLIENT_SECRET.substring(0, 8) + "...)" : "NOT SET";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET";
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET";

  return NextResponse.json({
    GOOGLE_CLIENT_ID: clientId.substring(0, 20) + "...",
    GOOGLE_CLIENT_SECRET: clientSecret,
    SUPABASE_SERVICE_ROLE_KEY: serviceRole,
    NEXT_PUBLIC_SUPABASE_URL: supaUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  });
}
