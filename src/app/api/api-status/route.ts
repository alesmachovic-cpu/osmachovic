import { NextRequest, NextResponse } from "next/server";

export type ApiStatus = "ok" | "credit_low" | "error" | "no_key";
export type ApiStatuses = { anthropic: ApiStatus; gemini: ApiStatus; openai: ApiStatus };

async function checkAnthropic(): Promise<ApiStatus> {
  if (!process.env.ANTHROPIC_API_KEY) return "no_key";
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    return "ok";
  } catch (e: unknown) {
    const msg = String(e);
    if (msg.includes("credit balance") || msg.includes("billing") || msg.includes("402")) return "credit_low";
    return "error";
  }
}

async function checkGemini(): Promise<ApiStatus> {
  if (!process.env.GEMINI_API_KEY) return "no_key";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) return "ok";
    const text = await res.text();
    if (text.includes("quota") || text.includes("billing") || text.includes("RESOURCE_EXHAUSTED")) return "credit_low";
    return "error";
  } catch {
    return "error";
  }
}

async function checkOpenAI(): Promise<ApiStatus> {
  if (!process.env.OPENAI_API_KEY) return "no_key";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return "ok";
    const text = await res.text();
    if (res.status === 402 || text.includes("quota") || text.includes("billing") || text.includes("insufficient_quota")) return "credit_low";
    return "error";
  } catch {
    return "error";
  }
}

export async function sendApiAlert(statuses: ApiStatuses) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const managerEmail = process.env.MANAGER_EMAIL;
  if (!RESEND_API_KEY || !managerEmail) return;

  const labels: Record<string, string> = {
    anthropic: "Anthropic (Claude)",
    gemini: "Google Gemini",
    openai: "OpenAI (GPT)",
  };
  const statusLabels: Record<ApiStatus, string> = {
    ok: "OK",
    credit_low: "⚠️ Nízke kredity",
    error: "❌ Chyba",
    no_key: "🔑 Chýba API kľúč",
  };

  const issues = (Object.entries(statuses) as [string, ApiStatus][])
    .filter(([, v]) => v !== "ok" && v !== "no_key");

  if (issues.length === 0) return;

  const rows = issues
    .map(([k, v]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${labels[k]}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${statusLabels[v]}</td></tr>`)
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Vianema CRM <noreply@vianema.sk>",
      to: [managerEmail],
      subject: `⚠️ API problém — Vianema CRM (${new Date().toLocaleString("sk")})`,
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#1a1a1a">Upozornenie na stav API</h2>
          <p>Nasledujúce API majú problémy:</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">
            <thead><tr style="background:#f5f5f5">
              <th style="padding:8px 12px;text-align:left">API</th>
              <th style="padding:8px 12px;text-align:left">Stav</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#666;font-size:13px">Skontroluj kredity a doplň ich v príslušnom dashboarde.</p>
        </div>`,
    }),
  }).catch((e) => console.error("[api-status] Resend error:", e));
}

export async function GET(req: NextRequest) {
  const sendEmail = req.nextUrl.searchParams.get("alert") === "1";

  const [anthropic, gemini, openai] = await Promise.all([
    checkAnthropic(),
    checkGemini(),
    checkOpenAI(),
  ]);

  const statuses: ApiStatuses = { anthropic, gemini, openai };

  if (sendEmail) {
    await sendApiAlert(statuses);
  }

  return NextResponse.json(statuses);
}
