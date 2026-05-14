import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    if (!isSuperAdmin(auth.user.role)) {
      return NextResponse.json({ error: "Len admin môže posielať pozvánky" }, { status: 403 });
    }

    const body = await request.json();
    const userId = String(body.user_id || "").trim();
    if (!userId) return NextResponse.json({ error: "Chýba user_id" }, { status: 400 });

    const sb = getSupabaseAdmin();

    const { data: user } = await sb
      .from("users")
      .select("id, name, email, login_email")
      .eq("id", userId)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "Používateľ neexistuje" }, { status: 404 });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const { error: insertErr } = await sb.from("user_invites").insert({
      user_id: userId,
      token,
      created_by: auth.user.id,
      expires_at: expiresAt,
      company_id: auth.user.company_id,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    const baseUrl = process.env.VERCEL_ENV === "production"
      ? "https://vianema.amgd.sk"
      : process.env.VERCEL_ENV === "preview"
      ? "https://test.amgd.sk"
      : "http://localhost:3000";
    const inviteUrl = `${baseUrl}/pridat-heslo/${token}`;

    // Email je len bonus — link funguje vždy
    const recipientEmail = (user.login_email || user.email) as string | null;
    const RESEND = process.env.RESEND_API_KEY;
    if (RESEND && recipientEmail) {
      const html = `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#1d1d1f">Vitaj v VIANEMA CRM</h2>
          <p>Ahoj <strong>${user.name}</strong>,</p>
          <p>Bol ti vytvorený účet v CRM systéme Vianema. Nastav si heslo kliknutím na odkaz nižšie.</p>
          <p style="margin:32px 0">
            <a href="${inviteUrl}"
               style="background:#0071e3;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Nastaviť heslo →
            </a>
          </p>
          <p style="color:#6e6e73;font-size:14px">Odkaz platí 7 dní. Ak si neočakával(a) tento email, ignoruj ho.</p>
        </div>
      `;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "VIANEMA CRM <onboarding@resend.dev>",
          to: recipientEmail,
          reply_to: process.env.MANAGER_EMAIL || "ales.machovic@gmail.com",
          subject: "Pozvánka do VIANEMA CRM",
          html,
        }),
      });
    }

    return NextResponse.json({ success: true, email: recipientEmail, invite_url: inviteUrl });
  } catch (e) {
    console.error("[invite] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
