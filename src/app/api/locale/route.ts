import { NextRequest, NextResponse } from "next/server";
import { LOCALES, type Locale } from "@/i18n";

export const runtime = "nodejs";

/** POST /api/locale  body: { locale: "sk" | "cs" | "en" } */
export async function POST(req: NextRequest) {
  const { locale } = await req.json() as { locale: string };
  if (!(LOCALES as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: "Neplatný jazyk" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set("NEXT_LOCALE", locale as Locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
