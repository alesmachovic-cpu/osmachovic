/* ── Notifikačný servis — Email (Resend) + Telegram ── */

import { ScrapedInzerat, MonitorFilter } from "./types";

// ─── Email cez Resend ───

export async function sendEmailNotification(
  inzeraty: ScrapedInzerat[],
  filter: MonitorFilter
): Promise<{ success: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  const managerEmail = process.env.MANAGER_EMAIL;

  if (!resendKey || !managerEmail) {
    return { success: false, error: "Missing RESEND_API_KEY or MANAGER_EMAIL" };
  }

  const count = inzeraty.length;
  const subject = `🏠 ${count} ${count === 1 ? "nový inzerát" : count < 5 ? "nové inzeráty" : "nových inzerátov"} — ${filter.nazov}`;

  const listingsHtml = inzeraty
    .slice(0, 20) // max 20 v emaili
    .map(
      (i) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 8px;">
        ${i.foto_url ? `<img src="${i.foto_url}" alt="" style="width:80px;height:60px;object-fit:cover;border-radius:6px;" />` : ""}
      </td>
      <td style="padding: 12px 8px;">
        <a href="${i.url}" style="color: #1d4ed8; font-weight: 600; text-decoration: none;">${i.nazov || "Inzerát"}</a>
        <br />
        <span style="color: #6b7280; font-size: 13px;">
          ${[i.lokalita, i.typ, i.izby ? `${i.izby}-izb` : null, i.plocha ? `${i.plocha} m²` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </td>
      <td style="padding: 12px 8px; text-align: right; font-weight: 700; white-space: nowrap;">
        ${i.cena ? `${i.cena.toLocaleString("sk-SK")} €` : "—"}
      </td>
    </tr>
  `
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111827;">${subject}</h2>
      <p style="color: #6b7280;">Filter: <strong>${filter.nazov}</strong> (${filter.portal})</p>
      <table style="width: 100%; border-collapse: collapse;">
        ${listingsHtml}
      </table>
      ${count > 20 ? `<p style="color: #6b7280; margin-top: 16px;">...a ďalších ${count - 20} inzerátov</p>` : ""}
      <p style="margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://crmvianema.vercel.app"}/monitor"
           style="background: #374151; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Otvoriť Monitor
        </a>
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Machovič CRM Monitor <onboarding@resend.dev>",  // TODO: zmeň na noreply@vianema.sk keď overíš doménu v Resend
        to: managerEmail,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Resend ${res.status}: ${err}` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ─── Telegram Bot ───

export async function sendTelegramNotification(
  inzeraty: ScrapedInzerat[],
  filter: MonitorFilter
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return { success: false, error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" };
  }

  const count = inzeraty.length;
  const header = `🏠 *${count} ${count === 1 ? "nový inzerát" : count < 5 ? "nové inzeráty" : "nových inzerátov"}*\nFilter: _${filter.nazov}_\n`;

  const lines = inzeraty.slice(0, 10).map((i) => {
    const parts = [
      i.cena ? `*${i.cena.toLocaleString("sk-SK")} €*` : "",
      i.plocha ? `${i.plocha} m²` : "",
      i.izby ? `${i.izby}-izb` : "",
      i.lokalita || "",
    ].filter(Boolean);

    return `• [${(i.nazov || "Inzerát").substring(0, 60)}](${i.url})\n  ${parts.join(" · ")}`;
  });

  const text = header + "\n" + lines.join("\n\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Telegram ${res.status}: ${err}` };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
