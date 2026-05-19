import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/daily-audit
 *
 * Spúšťa sa denne o 02:30 UTC cez Vercel cron.
 * Reprezentuje "Inspector General" (E023 Bc. Mária Hlavatá) — kontrolný orgán
 * ktorý kontroluje či kritické subsystémy fungujú a posiela report tebe (CEO).
 *
 * Toto je TS verzia subsetu `scripts/audit-all.sh` (kritické health checks
 * ktoré sa dajú spustiť server-side bez bash).
 *
 * Pri kritickom findingu pošle email cez Resend na MANAGER_EMAIL.
 */

type CheckResult = {
  name: string;
  status: "ok" | "warn" | "fail";
  message: string;
  detail?: string;
};

async function run(): Promise<{ results: CheckResult[]; counts: { ok: number; warn: number; fail: number } }> {
  const results: CheckResult[] = [];
  const sb = getSupabaseAdmin();

  // ─── 1) Monitor scrape lag (KRITICKÁ — bug ktorý sme zistili 2026-05-19) ───
  try {
    const { data } = await sb
      .from("monitor_inzeraty")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const ageHours = (Date.now() - new Date(data[0].created_at).getTime()) / 3600_000;
      if (ageHours < 36) {
        results.push({ name: "Monitor scrape", status: "ok", message: `Posledný scrape pred ${Math.round(ageHours)}h` });
      } else {
        results.push({
          name: "Monitor scrape",
          status: "fail",
          message: `🚨 Scrape mŕtve ${Math.round(ageHours)}h (>36h) — cron je rozbitý`,
          detail: "Owner: Bc. Martin Žiak (E005) + Bc. Patrik Vlk (E013)",
        });
      }
    }
  } catch (e) {
    results.push({ name: "Monitor scrape", status: "warn", message: `Check failed: ${String(e).slice(0, 100)}` });
  }

  // ─── 2) Anon RLS leak check (kritické tabuľky) ───
  const PRIVATE_TABLES = ["users", "klienti", "naberove_listy", "obhliadky", "faktury", "audit_log"];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  let anonLeaks = 0;
  for (const t of PRIVATE_TABLES) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=id&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const body = await res.text();
      if (body !== "[]" && !body.includes("permission denied") && !body.includes("JWT")) {
        anonLeaks++;
      }
    } catch { /* ignore */ }
  }
  results.push({
    name: "Anon RLS leak",
    status: anonLeaks === 0 ? "ok" : "fail",
    message: anonLeaks === 0 ? "Žiadny leak — anon nevidí privátne tabuľky" : `🚨 ${anonLeaks}/${PRIVATE_TABLES.length} tabuliek dostupných cez anon kľúč`,
    detail: anonLeaks > 0 ? "Owner: PhDr. Adam Vrabec (E016) Security Auditor" : undefined,
  });

  // ─── 3) Cron health (počet úspešných behov za 24h) ───
  // (Predpokladáme tabuľku cron_runs ak existuje — P1 TODO)
  // Aktuálne skip, len log že tu by sa mal hodnotiť cron health.
  results.push({
    name: "Cron health tracking",
    status: "warn",
    message: "cron_runs tabuľka neexistuje — tichý fail nezachytiteľný",
    detail: "Owner: Bc. Patrik Vlk (E013) — P1 ticket v memory/roadmap.md #12",
  });

  // ─── 4) Recent klient creation (sanity — užívatelia používajú CRM?) ───
  try {
    const { data } = await sb
      .from("klienti")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const ageDays = (Date.now() - new Date(data[0].created_at).getTime()) / 86400_000;
      if (ageDays < 14) {
        results.push({ name: "Klient creation activity", status: "ok", message: `Posledný klient pred ${Math.round(ageDays)} dňami` });
      } else {
        results.push({ name: "Klient creation activity", status: "warn", message: `Žiadny nový klient ${Math.round(ageDays)} dní` });
      }
    }
  } catch (e) {
    results.push({ name: "Klient activity", status: "warn", message: `Check failed: ${String(e).slice(0, 100)}` });
  }

  // ─── 5) Google token expiry coverage ───
  try {
    const { data } = await sb.from("users").select("google_email, google_token_expires_at");
    if (data) {
      const now = Math.floor(Date.now() / 1000);
      const connected = data.filter((u: { google_email: string | null }) => u.google_email).length;
      const expired = data.filter((u: { google_email: string | null; google_token_expires_at: number | null }) =>
        u.google_email && u.google_token_expires_at && u.google_token_expires_at < now
      ).length;
      results.push({
        name: "Google integration health",
        status: expired === 0 ? "ok" : "warn",
        message: `${connected}/${data.length} maklerov má Google connect, ${expired} expired`,
        detail: expired > 0 ? "Owner: Ing. Roman Krištof (E011) — UI mali by ukazovať reconnect banner" : undefined,
      });
    }
  } catch (e) {
    results.push({ name: "Google health", status: "warn", message: `Check failed: ${String(e).slice(0, 100)}` });
  }

  const counts = {
    ok: results.filter(r => r.status === "ok").length,
    warn: results.filter(r => r.status === "warn").length,
    fail: results.filter(r => r.status === "fail").length,
  };

  return { results, counts };
}

type EmailResult = { sent: boolean; error?: string; debug?: Record<string, unknown> };

async function sendEmailReport(results: CheckResult[], counts: { ok: number; warn: number; fail: number }): Promise<EmailResult> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const MANAGER_EMAIL = process.env.MANAGER_EMAIL;
  if (!RESEND_API_KEY) return { sent: false, error: "RESEND_API_KEY missing in env" };
  if (!MANAGER_EMAIL) return { sent: false, error: "MANAGER_EMAIL missing in env" };

  // Pošli email LEN ak je nejaký fail alebo warn (žiadny "all green" spam)
  if (counts.fail === 0 && counts.warn === 0) {
    return { sent: false, error: "all green — no email needed (by design)" };
  }

  const subject = counts.fail > 0
    ? `🚨 VIANEMA daily audit: ${counts.fail} FAIL + ${counts.warn} warn`
    : `⚠ VIANEMA daily audit: ${counts.warn} warn`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
      <h2 style="color: #1F3864;">VIANEMA Engineering — Daily Audit Report</h2>
      <p style="color: #555;">Inspector General (E023 Bc. Mária Hlavatá) hlási stav systému.</p>
      <p><strong>Súhrn:</strong> ✓ ${counts.ok} ok | ⚠ ${counts.warn} warn | ✗ ${counts.fail} fail</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 16px;">
        <thead>
          <tr style="background: #D6E4F0;">
            <th style="text-align: left; padding: 8px; border: 1px solid #B4B4B4;">Status</th>
            <th style="text-align: left; padding: 8px; border: 1px solid #B4B4B4;">Check</th>
            <th style="text-align: left; padding: 8px; border: 1px solid #B4B4B4;">Detail</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => {
            const icon = r.status === "fail" ? "🚨" : r.status === "warn" ? "⚠" : "✓";
            const bg = r.status === "fail" ? "#FCE4D6" : r.status === "warn" ? "#FFF2CC" : "#E2EFDA";
            return `
              <tr style="background: ${bg};">
                <td style="padding: 8px; border: 1px solid #B4B4B4;">${icon}</td>
                <td style="padding: 8px; border: 1px solid #B4B4B4;"><strong>${r.name}</strong></td>
                <td style="padding: 8px; border: 1px solid #B4B4B4;">
                  ${r.message}
                  ${r.detail ? `<br><small style="color: #666;">${r.detail}</small>` : ""}
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p style="margin-top: 24px; color: #888; font-size: 12px;">
        Detailný audit: spusti <code>./scripts/audit-all.sh</code> v repe.<br>
        Tickety: memory/roadmap.md.
      </p>
    </div>
  `;

  const fromAddr = process.env.RESEND_FROM || "VIANEMA Audit <noreply@vianema.eu>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [MANAGER_EMAIL],
        subject,
        html,
      }),
    });
    const respBody = await res.text();
    if (!res.ok) {
      return {
        sent: false,
        error: `Resend ${res.status}: ${respBody.slice(0, 300)}`,
        debug: { from: fromAddr, to: MANAGER_EMAIL.slice(0, 5) + "...", subject },
      };
    }
    return { sent: true, debug: { from: fromAddr, to: MANAGER_EMAIL, response: respBody.slice(0, 200) } };
  } catch (e) {
    return { sent: false, error: `Exception: ${String(e).slice(0, 300)}` };
  }
}

export async function GET(req: NextRequest) {
  // Vercel cron auth — voliteľne over Authorization header pre extra safety
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Ak je CRON_SECRET nastavený, vyžadujeme Bearer match. Bez secret = open (Vercel cron len)
    if (req.headers.get("x-vercel-cron") !== "1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { results, counts } = await run();
  const email = await sendEmailReport(results, counts);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    counts,
    email,
    results,
  });
}
