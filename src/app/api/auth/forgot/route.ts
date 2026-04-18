import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/auth/forgot
 * Body: { identifier } (email alebo meno)
 *
 * Nájde user, vygeneruje token, uloží hash do DB, pošle email s linkom.
 * Vždy vráti 200 (aby útočník nevedel či email existuje).
 */

const TOKEN_EXPIRY_HOURS = 1;

function generateToken(): string {
  // 32 bytes URL-safe
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim().toLowerCase();
    if (!identifier) return NextResponse.json({ ok: true });  // nemýliť

    const sb = getSupabaseAdmin();

    // Nájdi usera
    const { data: users } = await sb.from("users").select("*");
    const user = (users || []).find((a: Record<string, unknown>) =>
      String(a.id).toLowerCase() === identifier ||
      String(a.email || "").toLowerCase() === identifier ||
      String(a.login_email || "").toLowerCase() === identifier ||
      String(a.name || "").toLowerCase() === identifier
    );

    // Vždy vráť OK aj keď user neexistuje (anti-enumeration)
    if (!user) {
      console.warn(`[forgot] unknown identifier: ${identifier}`);
      return NextResponse.json({ ok: true });
    }

    // Email: preferuj login_email (Gmail), fallback na business email
    const toEmail = (user.login_email as string) || (user.email as string);
    if (!toEmail) {
      console.warn(`[forgot] user ${user.id} has no email on record`);
      return NextResponse.json({ ok: true });
    }

    // Vygeneruj + ulož token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    await sb.from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      email_sent_to: toEmail,
      expires_at: expiresAt,
    });

    // Pošli email
    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Machovič CRM <noreply@vianema.sk>",
            to: toEmail,
            subject: "Obnovenie hesla — Machovič CRM",
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1f2937; margin: 0 0 12px;">Obnovenie hesla</h2>
                <p style="color: #4b5563; line-height: 1.6;">
                  Ahoj ${user.name || user.id},<br/><br/>
                  Niekto požiadal o obnovenie hesla pre tvoj účet v Machovič CRM.
                  Ak si to nebol ty, tento email ignoruj.
                </p>
                <p style="margin: 24px 0;">
                  <a href="${resetUrl}" style="background: #374151; color: #fff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; display: inline-block;">
                    Nastaviť nové heslo
                  </a>
                </p>
                <p style="font-size: 12px; color: #6b7280;">
                  Odkaz je platný 1 hodinu. Po kliku môžeš zadať nové heslo.
                </p>
                <p style="font-size: 11px; color: #9ca3af; margin-top: 24px;">
                  Ak tlačidlo nefunguje, skopíruj tento odkaz:<br/>
                  <code style="word-break: break-all;">${resetUrl}</code>
                </p>
              </div>
            `,
          }),
        });
      } catch (e) {
        console.error("[forgot] email send failed:", e);
      }
    } else {
      console.warn("[forgot] RESEND_API_KEY not set — skipping email");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[forgot] error:", e);
    return NextResponse.json({ ok: true });  // Nikdy nevracať chybu (anti-enumeration)
  }
}
