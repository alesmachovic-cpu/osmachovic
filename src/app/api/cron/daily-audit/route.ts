import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/daily-audit
 * Spúšťa sa denne o 02:30 UTC cez Vercel cron.
 * Inspector General (E023 Bc. Mária Hlavatá) — kontrolný orgán.
 *
 * Flow:
 *   1) Run health checks
 *   2) Load last run z audit_runs tabuľky
 *   3) Diff: RESOLVED (bolo fail/warn → teraz ok), NEW (bolo ok → teraz fail/warn),
 *      PERSISTENT (stále fail/warn — tlak na owner-a)
 *   4) Email cez Resend ak je čokoľvek non-trivial (nový fail / persistent fail / resolved)
 *   5) Save snapshot do audit_runs
 */

type CheckStatus = "ok" | "warn" | "fail";
type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  owner?: string;       // Subagent name (napr. "monitor-owner")
  ownerName?: string;   // Display meno (napr. "Bc. Martin Žiak (E005)")
  department?: string;  // Display oddelenie (napr. "Monitor & Analýza")
};

// Owner mapping per check name. Subject + body identifikuje koho aktivovať.
// Všetky emaily fyzicky idú na MANAGER_EMAIL (Aleš), ownership je v texte.
const CHECK_OWNERS: Record<string, { owner: string; ownerName: string; department: string }> = {
  "Monitor scrape": {
    owner: "monitor-owner",
    ownerName: "Bc. Martin Žiak (E005) + Bc. Patrik Vlk (E013)",
    department: "Monitor & Analýza + Operativa",
  },
  "Anon RLS leak": {
    owner: "security-auditor",
    ownerName: "PhDr. Adam Vrabec (E016) + Ing. Lukáš Bobok (E004)",
    department: "Security Audit + Security",
  },
  "Cron health tracking": {
    owner: "operativa-owner",
    ownerName: "Bc. Patrik Vlk (E013)",
    department: "Operativa & Manažér",
  },
  "Klient creation activity": {
    owner: "customer-success",
    ownerName: "Mgr. Zuzana Novosadová (E022)",
    department: "Customer Success",
  },
  "Google integration health": {
    owner: "google-owner",
    ownerName: "Ing. Roman Krištof (E011)",
    department: "Google Integrácia",
  },
  "Email service (Resend)": {
    owner: "devops",
    ownerName: "Bc. Jaroslav Šebo (E017) + Aleš (CEO)",
    department: "DevOps + Infrastructure",
  },
};

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const sb = getSupabaseAdmin();

  // ─── 1) Monitor scrape lag ───
  try {
    const { data } = await sb
      .from("monitor_inzeraty")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const ageHours = (Date.now() - new Date(data[0].created_at).getTime()) / 3600_000;
      results.push({
        name: "Monitor scrape",
        status: ageHours < 36 ? "ok" : "fail",
        message: ageHours < 36
          ? `Posledný scrape pred ${Math.round(ageHours)}h`
          : `🚨 Scrape mŕtve ${Math.round(ageHours)}h (>36h) — cron je rozbitý`,
      });
    }
  } catch (e) {
    results.push({ name: "Monitor scrape", status: "warn", message: `Check failed: ${String(e).slice(0, 100)}` });
  }

  // ─── 2) Anon RLS leak ───
  const PRIVATE_TABLES = ["users", "klienti", "naberove_listy", "obhliadky", "faktury", "audit_log"];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  let anonLeaks = 0;
  const leakedTables: string[] = [];
  for (const t of PRIVATE_TABLES) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=id&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const body = await res.text();
      if (body !== "[]" && !body.includes("permission denied") && !body.includes("JWT") && !body.includes("not exist")) {
        anonLeaks++;
        leakedTables.push(t);
      }
    } catch { /* ignore */ }
  }
  results.push({
    name: "Anon RLS leak",
    status: anonLeaks === 0 ? "ok" : "fail",
    message: anonLeaks === 0
      ? "Žiadny leak — anon nevidí privátne tabuľky"
      : `🚨 ${anonLeaks}/${PRIVATE_TABLES.length} tabuliek leak: ${leakedTables.join(", ")}`,
  });

  // ─── 3) Cron health tracking — placeholder kým neexistuje cron_runs ───
  results.push({
    name: "Cron health tracking",
    status: "warn",
    message: "cron_runs tabuľka neexistuje — tichý fail nezachytiteľný",
    detail: "P1 ticket #12 v memory/roadmap.md",
  });

  // ─── 4) Klient creation activity ───
  try {
    const { data } = await sb
      .from("klienti")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const ageDays = (Date.now() - new Date(data[0].created_at).getTime()) / 86400_000;
      results.push({
        name: "Klient creation activity",
        status: ageDays < 14 ? "ok" : "warn",
        message: ageDays < 14
          ? `Posledný klient pred ${Math.round(ageDays)} dňami`
          : `Žiadny nový klient ${Math.round(ageDays)} dní — možný churn signál`,
      });
    }
  } catch (e) {
    results.push({ name: "Klient creation activity", status: "warn", message: `Check failed: ${String(e).slice(0, 100)}` });
  }

  // ─── 5.5) Resend API key valid (KRITICKÉ — ovplyvňuje VŠETKY emaily) ───
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      results.push({ name: "Email service (Resend)", status: "fail", message: "🚨 RESEND_API_KEY chýba v env" });
    } else {
      const r = await fetch("https://api.resend.com/api-keys", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (r.ok) {
        results.push({ name: "Email service (Resend)", status: "ok", message: "API kľúč valid, emaily sú functional" });
      } else {
        results.push({
          name: "Email service (Resend)",
          status: "fail",
          message: `🚨 Resend kľúč INVALID (HTTP ${r.status}) — VŠETKY emaily v CRM sú rozbité`,
          detail: "Akcia: vytvor nový kľúč na https://resend.com/api-keys a update Vercel env",
        });
      }
    }
  } catch (e) {
    results.push({ name: "Email service (Resend)", status: "warn", message: `Check failed: ${String(e).slice(0, 100)}` });
  }

  // ─── 6) Google token expiry ───
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
        detail: expired > 0 ? "UI by mal ukázať reconnect banner týmto userom" : undefined,
      });
    }
  } catch (e) {
    results.push({ name: "Google health", status: "warn", message: `Check failed: ${String(e).slice(0, 100)}` });
  }

  // Pridaj ownership
  return results.map(r => ({ ...r, ...(CHECK_OWNERS[r.name] || {}) }));
}

type DiffCategory = "RESOLVED" | "NEW" | "PERSISTENT" | "UNCHANGED_OK";
type DiffResult = CheckResult & {
  category: DiffCategory;
  previousStatus?: CheckStatus;
};

function diff(current: CheckResult[], previous: CheckResult[] | null): DiffResult[] {
  if (!previous) {
    // Prvý beh — všetko je "NEW" pre fail/warn, "UNCHANGED_OK" pre ok
    return current.map(c => ({
      ...c,
      category: c.status === "ok" ? "UNCHANGED_OK" : "NEW",
    }));
  }
  const prevMap = new Map(previous.map(p => [p.name, p]));
  return current.map(c => {
    const prev = prevMap.get(c.name);
    const prevStatus = prev?.status;

    let category: DiffCategory = "UNCHANGED_OK";
    if (c.status === "ok") {
      if (prevStatus === "fail" || prevStatus === "warn") category = "RESOLVED";
      else category = "UNCHANGED_OK";
    } else {
      // fail or warn
      if (prevStatus === "ok" || !prevStatus) category = "NEW";
      else category = "PERSISTENT";
    }
    return { ...c, category, previousStatus: prevStatus };
  });
}

function buildEmail(diffed: DiffResult[]): { subject: string; html: string; shouldSend: boolean } {
  const resolved = diffed.filter(d => d.category === "RESOLVED");
  const newOnes = diffed.filter(d => d.category === "NEW");
  const persistent = diffed.filter(d => d.category === "PERSISTENT");

  // Don't send if nothing interesting happened
  const shouldSend = resolved.length > 0 || newOnes.length > 0 || persistent.length > 0;
  if (!shouldSend) {
    return { subject: "", html: "", shouldSend: false };
  }

  // Subject — kompaktný stav
  const parts: string[] = [];
  if (newOnes.length > 0) parts.push(`🚨 ${newOnes.length} NOVÝ`);
  if (resolved.length > 0) parts.push(`✓ ${resolved.length} VYRIEŠENÉ`);
  if (persistent.length > 0) parts.push(`⚠ ${persistent.length} persistent`);
  const subject = `VIANEMA daily: ${parts.join(", ")}`;

  // Sections
  const section = (title: string, items: DiffResult[], bg: string) => {
    if (items.length === 0) return "";
    const rows = items.map(d => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px; vertical-align: top; width: 25%;">
          <strong>${d.name}</strong><br>
          <small style="color: #888;">${d.department || "(no department)"}</small>
        </td>
        <td style="padding: 10px; vertical-align: top;">
          ${d.message}
          ${d.detail ? `<br><small style="color: #666; font-style: italic;">${d.detail}</small>` : ""}
          ${d.previousStatus ? `<br><small style="color: #888;">Predtým: ${d.previousStatus}</small>` : ""}
        </td>
        <td style="padding: 10px; vertical-align: top; width: 30%;">
          <small><strong>Owner:</strong> ${d.ownerName || "(unassigned)"}<br>
          <em>Aktivuj cez Claude:</em> <code>${d.owner || "?"}</code></small>
        </td>
      </tr>
    `).join("");
    return `
      <h3 style="background: ${bg}; padding: 10px; margin: 24px 0 0 0; border-radius: 4px;">${title}</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 0;">
        ${rows}
      </table>
    `;
  };

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 720px; margin: 0 auto;">
      <h2 style="color: #1F3864;">VIANEMA Engineering — Daily Audit</h2>
      <p style="color: #555;">
        Inspector General (E023 Bc. Mária Hlavatá) hlási stav systému.<br>
        ${new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "full", timeStyle: "short" })}
      </p>
      ${section("✓ VYRIEŠENÉ (oprava nasadená)", resolved, "#E2EFDA")}
      ${section("🚨 NOVÝ problém (vyžaduje okamžitú reakciu)", newOnes, "#FCE4D6")}
      ${section("⚠ PERSISTENT (stále nevyriešené — tlak na owner-a)", persistent, "#FFF2CC")}
      <p style="margin-top: 32px; padding: 12px; background: #F0F0F0; border-radius: 4px; color: #666; font-size: 12px;">
        <strong>Workflow:</strong><br>
        🚨 NOVÝ → aktivuj owner subagenta v Claude Code (napr. <code>/agents monitor-owner</code>)<br>
        ⚠ PERSISTENT → owner už pracuje, ale pomalý progress — eskaluj ak >7 dní<br>
        ✓ VYRIEŠENÉ → ack, zatvor ticket v memory/roadmap.md<br>
        <br>
        Detail: spusti <code>./scripts/audit-all.sh</code>. Tickety: <code>memory/roadmap.md</code>.
      </p>
    </div>
  `;

  return { subject, html, shouldSend: true };
}

type EmailResult = { sent: boolean; error?: string; debug?: Record<string, unknown> };

async function sendEmail(subject: string, html: string): Promise<EmailResult> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const MANAGER_EMAIL = process.env.MANAGER_EMAIL;
  if (!RESEND_API_KEY) return { sent: false, error: "RESEND_API_KEY missing" };
  if (!MANAGER_EMAIL) return { sent: false, error: "MANAGER_EMAIL missing" };

  // Sender: Resend default doména (onboarding@resend.dev) — vždy funguje, nepotrebuje verify.
  // Príjemca: process.env.MANAGER_EMAIL (= ales.machovic@gmail.com).
  // Žiadny vianema.eu nepoužitý.
  const fromAddr = "VIANEMA Audit <onboarding@resend.dev>";
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
        debug: { from: fromAddr },
      };
    }
    return { sent: true, debug: { from: fromAddr, response: respBody.slice(0, 100) } };
  } catch (e) {
    return { sent: false, error: `Exception: ${String(e).slice(0, 300)}` };
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}` && req.headers.get("x-vercel-cron") !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // 1) Run checks
  const current = await runChecks();
  const counts = {
    ok: current.filter(r => r.status === "ok").length,
    warn: current.filter(r => r.status === "warn").length,
    fail: current.filter(r => r.status === "fail").length,
  };

  // 2) Load last run pre diff
  const { data: lastRun } = await sb
    .from("audit_runs")
    .select("results")
    .order("run_at", { ascending: false })
    .limit(1);
  const previous = (lastRun && lastRun.length > 0) ? lastRun[0].results as CheckResult[] : null;

  // 3) Diff
  const diffed = diff(current, previous);
  const diffCounts = {
    resolved: diffed.filter(d => d.category === "RESOLVED").length,
    new: diffed.filter(d => d.category === "NEW").length,
    persistent: diffed.filter(d => d.category === "PERSISTENT").length,
    unchanged_ok: diffed.filter(d => d.category === "UNCHANGED_OK").length,
  };

  // 4) Email (len ak je čo nového)
  const { subject, html, shouldSend } = buildEmail(diffed);
  const email: EmailResult = shouldSend
    ? await sendEmail(subject, html)
    : { sent: false, error: "no changes (all unchanged_ok)" };

  // 5) Save snapshot do DB
  const { error: saveErr } = await sb.from("audit_runs").insert({
    source: req.headers.get("x-vercel-cron") === "1" ? "daily-cron" : "manual",
    counts,
    results: current,
    email_summary: { sent: email.sent, error: email.error || null, diffCounts, subject },
  });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    counts,
    diff: diffCounts,
    email: { sent: email.sent, error: email.error, subject },
    saved: !saveErr,
    saveError: saveErr?.message,
    diffed,
  });
}
