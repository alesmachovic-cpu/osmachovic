import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

// GET /api/klienti/csv — export všetkých klientov firmy do CSV
export async function GET(req: NextRequest) {
  const auth = await requireUser(req, { strict: true });
  if (auth.error) return auth.error;

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("klienti")
    .select("meno, telefon, email, typ, status, lokalita, created_at, makler_id")
    .eq("company_id", auth.user.company_id)
    .order("created_at", { ascending: false });

  const rows = data ?? [];

  const header = ["Meno", "Telefón", "Email", "Typ", "Status", "Lokalita", "Dátum vytvorenia"];
  const lines = rows.map(r => [
    r.meno ?? "",
    r.telefon ?? "",
    r.email ?? "",
    r.typ ?? "",
    r.status ?? "",
    r.lokalita ?? "",
    r.created_at ? new Date(r.created_at as string).toLocaleDateString("sk") : "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));

  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="klienti-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
