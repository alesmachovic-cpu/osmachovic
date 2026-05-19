import { NextRequest, NextResponse } from "next/server";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";
import { sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * GET /api/admin/telegram-test
 * Pošle test správu cez Telegram bota. Admin-only.
 * Vráti detail (sent, chatIds, error) — pre debug.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user.role)) {
    return NextResponse.json({ error: "Len admin" }, { status: 403 });
  }

  const result = await sendTelegram({
    text: [
      "🧪 *VIANEMA test*",
      "",
      "Ak vidíš túto správu, Telegram bot je nastavený správne.",
      "",
      `_Spustené: ${new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })}_`,
      `_User: ${auth.user.email || auth.user.id}_`,
    ].join("\n"),
  });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    result,
    config: {
      tokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
      chatIdSet: !!process.env.TELEGRAM_CHAT_ID,
    },
  });
}
