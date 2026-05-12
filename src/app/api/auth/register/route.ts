import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildSessionCookieValue, buildBillingCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      companyName?: string;
      name?: string;
      email?: string;
      password?: string;
    };

    const { companyName, name, email, password } = body;

    if (!companyName?.trim()) return NextResponse.json({ error: "Názov kancelárie je povinný" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: "Meno je povinné" }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "Email je povinný" }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: "Heslo musí mať aspoň 8 znakov" }, { status: 400 });

    const sb = getSupabaseAdmin();

    // Skontroluj či email nie je obsadený
    const { data: existing } = await sb.from("users").select("id").eq("email", email.toLowerCase().trim()).maybeSingle();
    if (existing) return NextResponse.json({ error: "Email je už zaregistrovaný" }, { status: 409 });

    // Vytvor slug a over unikátnosť
    let slug = slugify(companyName);
    const { data: slugExists } = await sb.from("companies").select("id").eq("slug", slug).maybeSingle();
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Vytvor firmu
    const { data: company, error: companyErr } = await sb
      .from("companies")
      .insert({ name: companyName.trim(), slug, is_active: true, plan: "starter", country: "SK" })
      .select("id")
      .single();

    if (companyErr || !company) {
      console.error("[register] company insert failed:", companyErr);
      return NextResponse.json({ error: "Chyba pri vytváraní kancelárie" }, { status: 500 });
    }

    // Vytvor admin usera
    const hashed = await bcrypt.hash(password, 10);
    const initials = name.trim().split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

    const { data: user, error: userErr } = await sb
      .from("users")
      .insert({
        name: name.trim(),
        initials,
        email: email.toLowerCase().trim(),
        password: hashed,
        role: "admin",
        company_id: company.id,
      })
      .select("id, name, role, email, company_id")
      .single();

    if (userErr || !user) {
      // Rollback — zmaž firmu
      await sb.from("companies").delete().eq("id", company.id);
      console.error("[register] user insert failed:", userErr);
      return NextResponse.json({ error: "Chyba pri vytváraní účtu" }, { status: 500 });
    }

    const res = NextResponse.json({ user });
    res.headers.append("Set-Cookie", buildSessionCookieValue(String(user.id)));
    res.headers.append("Set-Cookie", buildBillingCookieValue(true));
    return res;
  } catch (e) {
    console.error("[register] error:", e);
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 });
  }
}
