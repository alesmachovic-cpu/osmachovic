/**
 * SMS sender — abstracted nad provider. Default: Twilio. Ak chýbajú env
 * premenné, vrátime "manual" mód kde maklér zadá OTP klientovi po telefóne.
 *
 * Twilio env:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *
 * Smslogic.sk (alternatíva, ak by si neskôr prepol):
 *   SMS_PROVIDER=smslogic + SMSLOGIC_API_KEY
 */

export interface SmsResult {
  ok: boolean;
  provider: "twilio" | "smslogic" | "manual";
  error?: string;
  message_id?: string;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  // Normalizuj telefón na E.164 formát (+421...)
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, provider: "manual", error: "Neplatný telefón" };

  const provider = (process.env.SMS_PROVIDER || "twilio").toLowerCase();

  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      return { ok: false, provider: "manual", error: "Twilio nie je nakonfigurovaný — pošli OTP klientovi ručne" };
    }
    try {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const params = new URLSearchParams({ To: phone, From: from, Body: body });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const data = await r.json();
      if (!r.ok) return { ok: false, provider: "twilio", error: data.message || `HTTP ${r.status}` };
      return { ok: true, provider: "twilio", message_id: data.sid };
    } catch (e) {
      return { ok: false, provider: "twilio", error: (e as Error).message };
    }
  }

  if (provider === "smslogic") {
    const apiKey = process.env.SMSLOGIC_API_KEY;
    if (!apiKey) return { ok: false, provider: "manual", error: "Smslogic nie je nakonfigurovaný" };
    try {
      // Smslogic.sk REST API (overenie podľa ich docs)
      const r = await fetch("https://api.smslogic.sk/api/v1/sms/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, body, sender: "Vianema" }),
      });
      const data = await r.json();
      if (!r.ok) return { ok: false, provider: "smslogic", error: data.error || `HTTP ${r.status}` };
      return { ok: true, provider: "smslogic", message_id: data.id };
    } catch (e) {
      return { ok: false, provider: "smslogic", error: (e as Error).message };
    }
  }

  return { ok: false, provider: "manual", error: `Neznámy SMS provider: ${provider}` };
}

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let s = String(raw).replace(/[\s().\-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0") && !s.startsWith("0+")) s = "+421" + s.slice(1);
  if (!s.startsWith("+")) s = "+421" + s;
  // Validuj +421 + 9 číslic alebo iný + štát + min 8 číslic
  if (!/^\+\d{8,15}$/.test(s)) return null;
  return s;
}
