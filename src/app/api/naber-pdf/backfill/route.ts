import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * /api/naber-pdf/backfill
 *
 * Jednorazový backfill PDF súborov náberových listov do klient_dokumenty
 * pre klientov, ktorí majú náber ale nemajú PDF v dokumentoch.
 *
 * Spustenie:
 *   GET /api/naber-pdf/backfill?key=__internal__&limit=5
 *
 * Kvôli Vercel 30s limitu spracuje naraz max `limit` klientov (default 5).
 * Zavolaj opakovane kým remaining = 0.
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  // Auth
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const queryKey = searchParams.get("key");
  const cronSecret = process.env.CRON_SECRET;
  const isInternal = queryKey === "__internal__";
  if (cronSecret && !isInternal && authHeader !== `Bearer ${cronSecret}` && queryKey !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") || "5"), 10);
  const origin = new URL(request.url).origin;

  try {
    const sb = getSupabaseAdmin();

    // Nájdi všetky náberové listy
    const { data: allNabery, error: naberyErr } = await sb
      .from("naberove_listy")
      .select("id, klient_id, created_at")
      .not("klient_id", "is", null)
      .order("created_at", { ascending: true });

    if (naberyErr) return NextResponse.json({ error: naberyErr.message }, { status: 500 });
    if (!allNabery?.length) {
      return NextResponse.json({ message: "Žiadne nábery v DB", processed: 0, remaining: 0 });
    }

    // Nájdi ktorí klienti už MAJÚ náberák v dokumentoch (type = 'Náberový list')
    const klientIds = [...new Set(allNabery.map((n) => n.klient_id))];
    const { data: existingDocs } = await sb
      .from("klient_dokumenty")
      .select("klient_id")
      .in("klient_id", klientIds)
      .eq("type", "Náberový list");

    const klientiWithPdf = new Set((existingDocs || []).map((d) => d.klient_id));

    // Zisti ktorí klienti ešte existujú (orphan nábery preskočíme)
    const { data: existingKlienti } = await sb
      .from("klienti")
      .select("id")
      .in("id", klientIds);
    const klientiExist = new Set((existingKlienti || []).map((k) => k.id));

    // Nábery, ktoré treba spracovať: klient existuje A ešte nemá PDF
    const todo = allNabery.filter((n) => klientiExist.has(n.klient_id) && !klientiWithPdf.has(n.klient_id));
    const orphanCount = allNabery.filter((n) => !klientiExist.has(n.klient_id)).length;
    const totalTodo = todo.length;
    const batch = todo.slice(0, limit);

    const results: Array<{ naber_id: string; klient_id: string; status: string; error?: string }> = [];

    for (const naber of batch) {
      // Safety: ak čas dochádza, skončíme
      if (Date.now() - startTime > 25000) {
        results.push({ naber_id: naber.id, klient_id: naber.klient_id, status: "timeout_skipped" });
        continue;
      }

      try {
        // 1. Fetch PDF z internal endpointu
        const pdfRes = await fetch(`${origin}/api/naber-pdf?id=${naber.id}`);
        if (!pdfRes.ok) {
          results.push({ naber_id: naber.id, klient_id: naber.klient_id, status: "pdf_fetch_failed", error: `${pdfRes.status}` });
          continue;
        }
        const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
        const base64 = pdfBuf.toString("base64");

        // 2. Získaj meno klienta pre názov súboru
        const { data: klient } = await sb
          .from("klienti")
          .select("meno")
          .eq("id", naber.klient_id)
          .single();

        const meno = (klient?.meno || "klient").replace(/[^a-zA-Z0-9]+/g, "_");
        const datum = new Date(naber.created_at).toISOString().split("T")[0];
        const name = `naberovy_list_${meno}_${datum}.pdf`;

        // 3. Skontroluj duplicitu podľa name + klient_id
        const { data: existing } = await sb
          .from("klient_dokumenty")
          .select("id")
          .eq("klient_id", naber.klient_id)
          .eq("name", name)
          .maybeSingle();

        if (existing?.id) {
          results.push({ naber_id: naber.id, klient_id: naber.klient_id, status: "already_exists" });
          continue;
        }

        // 4. Vlož do klient_dokumenty
        const { error: insertErr } = await sb.from("klient_dokumenty").insert({
          klient_id: naber.klient_id,
          name,
          type: "Náberový list",
          size: pdfBuf.length,
          source: "naber",
          mime: "application/pdf",
          data_base64: base64,
        });

        if (insertErr) {
          results.push({ naber_id: naber.id, klient_id: naber.klient_id, status: "insert_failed", error: insertErr.message });
        } else {
          results.push({ naber_id: naber.id, klient_id: naber.klient_id, status: "uploaded" });
        }
      } catch (e) {
        results.push({ naber_id: naber.id, klient_id: naber.klient_id, status: "error", error: String(e) });
      }
    }

    const processed = results.filter((r) => r.status === "uploaded").length;
    const remaining = totalTodo - batch.length;

    return NextResponse.json({
      message: `Spracované ${processed} / ${batch.length} náberov. Zostáva: ${remaining}`,
      total_nabery: allNabery.length,
      already_had_pdf: allNabery.length - totalTodo - orphanCount,
      orphan_missing_klient: orphanCount,
      to_process: totalTodo,
      processed_this_batch: processed,
      remaining,
      duration_ms: Date.now() - startTime,
      results,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
