/**
 * Telegram Bot integrácia — pre CEO notifikácie (preferovaný kanál).
 *
 * Setup (jednorazovo):
 *   1. V Telegrame napíš @BotFather → /newbot → daj meno + username
 *   2. Skopíruj TOKEN
 *   3. Otvor chat s novým botom, pošli `/start` alebo akúkoľvek správu
 *   4. Otvor https://api.telegram.org/bot<TOKEN>/getUpdates → uvidíš svoj chat_id
 *   5. Pridaj do Vercel env:
 *      TELEGRAM_BOT_TOKEN = <token>
 *      TELEGRAM_CHAT_ID = <chat_id>  (alebo viacero oddelených čiarkou pre group)
 */

type TelegramMessage = {
  text: string;
  parseMode?: "Markdown" | "HTML" | "MarkdownV2";
  disablePreview?: boolean;
};

type TelegramResult = { sent: boolean; error?: string; chatIds?: string[] };

export async function sendTelegram(msg: TelegramMessage): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdsRaw = process.env.TELEGRAM_CHAT_ID;
  if (!token) return { sent: false, error: "TELEGRAM_BOT_TOKEN missing" };
  if (!chatIdsRaw) return { sent: false, error: "TELEGRAM_CHAT_ID missing" };

  const chatIds = chatIdsRaw.split(",").map(s => s.trim()).filter(Boolean);
  const sentIds: string[] = [];
  const errors: string[] = [];

  for (const chatId of chatIds) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg.text,
          parse_mode: msg.parseMode || "Markdown",
          disable_web_page_preview: msg.disablePreview ?? true,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        errors.push(`${chatId}: ${body.description || res.statusText}`);
        continue;
      }
      sentIds.push(chatId);
    } catch (e) {
      errors.push(`${chatId}: ${String(e).slice(0, 100)}`);
    }
  }

  if (sentIds.length === 0) {
    return { sent: false, error: errors.join("; ") };
  }
  return { sent: true, chatIds: sentIds, error: errors.length > 0 ? errors.join("; ") : undefined };
}

/** Helper pre audit notifikácie. */
export function formatAuditAlert(opts: {
  newFails: Array<{ name: string; message: string; ownerName?: string }>;
  resolved: Array<{ name: string }>;
}): string {
  const parts: string[] = [];

  if (opts.newFails.length > 0) {
    parts.push("🚨 *VIANEMA audit — NOVÝ problém*");
    parts.push("");
    for (const f of opts.newFails) {
      parts.push(`• *${f.name}*`);
      parts.push(`  ${f.message}`);
      if (f.ownerName) parts.push(`  _Owner: ${f.ownerName}_`);
      parts.push("");
    }
  }

  if (opts.resolved.length > 0) {
    if (parts.length > 0) parts.push("");
    parts.push("✓ *Vyriešené*");
    for (const r of opts.resolved) parts.push(`• ${r.name}`);
  }

  parts.push("");
  parts.push("[Otvoriť audit dashboard](https://dev.amgd.sk/admin/audit)");
  return parts.join("\n");
}
