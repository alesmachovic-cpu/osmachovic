import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sb } from "@/lib/db";
import { cookieValue, sign } from "@/lib/session";

export const runtime = "nodejs";

/** Jednoduchý rate limit na IP: max 10 neúspešných za 15 min (per inštancia). */
const fails = new Map<string, number[]>();

/** POST /api/auth/login  { email, password } → nastaví cookie, vráti { user } */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const recent = (fails.get(ip) || []).filter(t => Date.now() - t < 15 * 60 * 1000);
  if (recent.length >= 10) return NextResponse.json({ error: "Príliš veľa pokusov, skús o 15 minút." }, { status: 429 });

  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return NextResponse.json({ error: "Zadaj e‑mail a heslo" }, { status: 400 });

  const { data: u } = await sb().from("weby_users").select("id, email, name, role, password_hash").eq("email", email).maybeSingle();
  const ok = u?.password_hash ? await bcrypt.compare(password, u.password_hash as string) : await bcrypt.compare(password, "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL").then(() => false);
  if (!u || !ok) {
    fails.set(ip, [...recent, Date.now()]);
    return NextResponse.json({ error: "Nesprávny e‑mail alebo heslo" }, { status: 401 });
  }
  fails.delete(ip);
  await sb().from("weby_users").update({ last_login_at: new Date().toISOString() }).eq("id", u.id);

  const res = NextResponse.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } });
  res.headers.set("Set-Cookie", cookieValue(sign(u.id as string)));
  return res;
}
