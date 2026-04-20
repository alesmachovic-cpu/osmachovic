import { NextResponse } from "next/server";
import { mintServiceRoleJwt } from "@/lib/supabase-storage";

export const runtime = "nodejs";

/**
 * GET /api/fotky/upload/diag
 * Jednorazový diagnostický endpoint — overí že SUPABASE_JWT_SECRET je
 * nastavený a mint-nutý JWT akceptuje Storage API. Žiadne citlivé dáta
 * v odpovedi — iba status.
 */
export async function GET() {
  const hasSecret = !!process.env.SUPABASE_JWT_SECRET;
  const secretLen = (process.env.SUPABASE_JWT_SECRET || "").length;
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAdminKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSecret) {
    return NextResponse.json({
      ok: false,
      step: "env",
      error: "SUPABASE_JWT_SECRET is missing",
      hasUrl, hasAdminKey,
    });
  }

  let jwt: string;
  try {
    jwt = mintServiceRoleJwt();
  } catch (e) {
    return NextResponse.json({
      ok: false,
      step: "mint",
      error: String((e as Error)?.message || e),
      hasUrl, hasAdminKey, secretLen,
    });
  }

  // Test the JWT against Storage
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const r = await fetch(`${url}/storage/v1/bucket`, {
      headers: { apikey: jwt, Authorization: `Bearer ${jwt}` },
    });
    const body = await r.text();
    return NextResponse.json({
      ok: r.ok,
      step: "storage-test",
      status: r.status,
      body: body.slice(0, 300),
      jwtHeaderPayload: jwt.split(".").slice(0, 2).join("."),
      secretLen,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      step: "fetch",
      error: String((e as Error)?.message || e),
      secretLen,
    });
  }
}
