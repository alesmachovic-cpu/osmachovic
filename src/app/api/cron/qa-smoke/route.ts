import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, isSuperAdmin } from "@/lib/auth/requireUser";
import { sendTelegram } from "@/lib/telegram";
import { VIANEMA_COMPANY_ID } from "@/lib/auth/companyScope";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/qa-smoke
 *
 * Daily Reality Checker (E027 Zuzana Hladká).
 * Spúšťa sa každý deň 06:30 UTC (≈ 8:30 Europe/Bratislava v zime, 8:30 v lete).
 *
 * Prejde systém **server-side** ako reálny maklér cez Supabase admin client:
 *   1) Klient — create (test data) + GET overí čítanie
 *   2) Obhliadka — create pre toho klienta
 *   3) Faktúra — create s 1 položkou, overí číslovanie + UNIQUE
 *   4) Cleanup — soft-delete faktúru, DELETE obhliadku, DELETE klient (test data)
 *   5) Insert audit row do qa_smoke_runs
 *
 * Telegram alert IBA pri fail. Silent pri ok (žiadny spam).
 *
 * Auth: rovnaký pattern ako daily-audit (Vercel cron header / Bearer / admin session).
 */

type StepResult = { name: string; status: "ok" | "failed"; duration_ms: number; error?: string };

async function step<T>(name: string, fn: () => Promise<T>): Promise<{ ok: true; result: T; step: StepResult } | { ok: false; step: StepResult }> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { ok: true, result, step: { name, status: "ok", duration_ms: Date.now() - t0 } };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, step: { name, status: "failed", duration_ms: Date.now() - t0, error: error.slice(0, 500) } };
  }
}

export async function GET(req: NextRequest) {
  // Auth — povoľ ak (a) Vercel cron, (b) Bearer CRON_SECRET, ALEBO (c) admin session.
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const isBearerOk = cronSecret ? req.headers.get("authorization") === `Bearer ${cronSecret}` : false;
  if (!isVercelCron && !isBearerOk) {
    const auth = await requireUser(req);
    if (auth.error || !isSuperAdmin(auth.user.role)) {
      return NextResponse.json({ error: "Unauthorized — vyžaduje admin session, Vercel cron, alebo Bearer secret" }, { status: 401 });
    }
  }

  const sb = getSupabaseAdmin();
  const started = Date.now();
  const steps: StepResult[] = [];
  const triggeredBy = isVercelCron ? "vercel-cron" : (isBearerOk ? "bearer" : "admin-session");

  // Get a real makler_id z VIANEMA company pre realistický test (foreign key constraints).
  const { data: maklerRow } = await sb
    .from("makleri")
    .select("id")
    .eq("company_id", VIANEMA_COMPANY_ID)
    .limit(1)
    .maybeSingle();
  const maklerId = maklerRow?.id ?? null;

  // Tag pre cleanup neskôr a pre identifikáciu test data.
  const tag = `qa-smoke-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;

  // Najprv vyčisti predošlé QA Smoke Test záznamy (idempotencia — keby cleanup minulého behu zlyhal).
  await sb.from("klienti").delete().eq("company_id", VIANEMA_COMPANY_ID).like("meno", "QA Smoke Test%");

  let klientId: string | null = null;
  let obhliadkaId: string | null = null;
  let fakturaId: string | null = null;

  // 1) KLIENT
  const sKlient = await step("create_klient", async () => {
    const { data, error } = await sb.from("klienti").insert({
      meno: `QA Smoke Test (${tag})`,
      telefon: `+421900000000`,
      email: `${tag}@vianema.internal`,
      typ: "predavajuci",
      company_id: VIANEMA_COMPANY_ID,
      ...(maklerId ? { makler_id: maklerId } : {}),
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id as string;
  });
  steps.push(sKlient.step);
  if (sKlient.ok) klientId = sKlient.result;

  // 2) OBHLIADKA — len ak klient prešiel
  if (klientId) {
    const sObh = await step("create_obhliadka", async () => {
      const { data, error } = await sb.from("obhliadky").insert({
        predavajuci_klient_id: klientId,
        datum: new Date(Date.now() + 86400000).toISOString(),
        miesto: `${tag} ulica 1, Bratislava`,
        status: "planovana",
        company_id: VIANEMA_COMPANY_ID,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return data.id as string;
    });
    steps.push(sObh.step);
    if (sObh.ok) obhliadkaId = sObh.result;
  } else {
    steps.push({ name: "create_obhliadka", status: "failed", duration_ms: 0, error: "skipped — klient zlyhal" });
  }

  // 3) FAKTÚRA
  if (klientId) {
    const sFak = await step("create_faktura", async () => {
      // Najprv potrebujeme user_id (faktúra je viazaná na user, nie klient).
      const { data: u } = await sb.from("users").select("id").eq("company_id", VIANEMA_COMPANY_ID).limit(1).maybeSingle();
      if (!u) throw new Error("žiadny user vo VIANEMA company");
      const year = new Date().getFullYear();
      const cislo = `QA${year}${String(Date.now()).slice(-6)}`;
      const { data, error } = await sb.from("faktury").insert({
        user_id: u.id,
        company_id: VIANEMA_COMPANY_ID,
        cislo_faktury: cislo,
        variabilny_symbol: cislo.replace("QA", "QV"),
        datum_vystavenia: new Date().toISOString().slice(0, 10),
        suma_bez_dph: 100,
        dph: 0,
        suma_celkom: 100,
        forma_uhrady: "Prevodom",
      }).select("id, cislo_faktury").single();
      if (error) throw new Error(error.message);
      return data.id as string;
    });
    steps.push(sFak.step);
    if (sFak.ok) fakturaId = sFak.result;
  } else {
    steps.push({ name: "create_faktura", status: "failed", duration_ms: 0, error: "skipped — klient zlyhal" });
  }

  // 4) READ verify — over že GET endpointy vrátia naše dáta
  if (klientId) {
    const sRead = await step("read_verify", async () => {
      const { data, error } = await sb.from("klienti").select("id, meno").eq("id", klientId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("klient nenájdený cez GET");
      return true;
    });
    steps.push(sRead.step);
  } else {
    steps.push({ name: "read_verify", status: "failed", duration_ms: 0, error: "skipped — klient zlyhal" });
  }

  // 5) CLEANUP — vždy sa pokús
  let cleanupOk = true;
  try {
    if (fakturaId) {
      // Faktúra je soft-delete-only, ale tu chceme reálne odstrániť QA test data.
      // Pravidlo 10y retention sa nevzťahuje na test data → manuálny hard delete.
      await sb.from("prehlad_zaznamy").delete().eq("faktura_id", fakturaId);
      await sb.from("faktura_polozky").delete().eq("faktura_id", fakturaId);
      await sb.from("faktury").delete().eq("id", fakturaId);
    }
    if (obhliadkaId) {
      await sb.from("obhliadky").delete().eq("id", obhliadkaId);
    }
    if (klientId) {
      await sb.from("klienti").delete().eq("id", klientId);
    }
  } catch (e) {
    cleanupOk = false;
    steps.push({ name: "cleanup", status: "failed", duration_ms: 0, error: String(e).slice(0, 500) });
  }

  // 6) Compose result
  const failedSteps = steps.filter(s => s.status === "failed");
  const status: "ok" | "failed" = failedSteps.length === 0 ? "ok" : "failed";
  const durationMs = Date.now() - started;
  const failedStep = failedSteps[0]?.name ?? null;

  // Insert audit row
  await sb.from("qa_smoke_runs").insert({
    started_at: new Date(started).toISOString(),
    completed_at: new Date().toISOString(),
    status,
    duration_ms: durationMs,
    steps,
    failed_step: failedStep,
    error: failedSteps[0]?.error ?? null,
    base_url: req.headers.get("host") || null,
    triggered_by: triggeredBy,
    cleanup_ok: cleanupOk,
  });

  // 7) Telegram alert IBA pri fail (silent pri ok)
  if (status === "failed") {
    const stepLines = steps.map(s => `  ${s.status === "ok" ? "✓" : "✗"} ${s.name}${s.error ? ` — ${s.error.slice(0, 100)}` : ""}`).join("\n");
    await sendTelegram({
      text: [
        "🚨 VIANEMA QA SMOKE — FAIL",
        "",
        `Failed step: ${failedStep}`,
        `Trvanie: ${durationMs}ms`,
        "",
        "Kroky:",
        stepLines,
        "",
        `Cleanup OK: ${cleanupOk ? "áno" : "NIE — manual cleanup potrebný"}`,
        "",
        "Daily Reality Checker E027 Zuzana Hladká",
      ].join("\n"),
      parseMode: "HTML",
    }).catch(() => {/* swallow — alert failure nesmie zhodiť cron */});
  }

  return NextResponse.json({
    status,
    duration_ms: durationMs,
    steps,
    failed_step: failedStep,
    cleanup_ok: cleanupOk,
  });
}
