import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendPushToAll } from "@/lib/monitor";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * /api/cron/volni-klienti
 *
 * SLA enforcement pre klientov. Spúšťa sa **každú hodinu** (Vercel cron),
 * aby sa stihli "1h pred vypršaním" alerty.
 *
 * SLA pravidlá:
 *   1) status "novy" / "novy_kontakt"
 *      - 24h od updated_at → uvoľní (presun do voľného poolu)
 *      - 23h-24h: posledná šanca alert maklerovi (1h pred vypršaním)
 *
 *   2) status "volat_neskor"
 *      - 24h od datum_naberu → uvoľní
 *      - 23h-24h: posledná šanca alert
 *
 *   3) status "dohodnuty_naber"
 *      - 48h od datum_naberu BEZ inzerátu → SLA WARNING maklerovi (banner+email+push)
 *      - 72h od datum_naberu BEZ inzerátu → SLA CRITICAL → manažér notifikovaný
 *      - 47h-48h: posledná šanca alert (1h pred warningom)
 *      - Klient sa NEUVOĽNÍ automaticky — manažér rozhoduje (presun/napomenutie)
 *
 *   4) status "nechce_rk"
 *      - okamžite uvoľnený (akýkoľvek maklér môže prebrať)
 *
 *   5) status "realitna_kancelaria"
 *      - permanentný stav, NIKDY do voľného poolu
 *
 * Spustenie:
 *   - Vercel cron (hourly)
 *   - Manuálne z UI: GET /api/cron/volni-klienti?key=__internal__
 *   - Externý cron: Bearer CRON_SECRET
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

  try {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const HOUR = 60 * 60 * 1000;
    const dayAgo = new Date(now.getTime() - 24 * HOUR).toISOString();
    const lastChanceMs = now.getTime() - 23 * HOUR; // 23h prahová hranica pre "1h pred vypršaním"
    const naber48hAgo = new Date(now.getTime() - 48 * HOUR).toISOString();
    const naber47hAgo = new Date(now.getTime() - 47 * HOUR).toISOString();
    const naber72hAgo = new Date(now.getTime() - 72 * HOUR).toISOString();

    const movedIds: string[] = [];                      // klientov uvoľníme
    const reasons: Record<string, string> = {};

    // 1) "nechce_rk" → presun okamžite
    const { data: nechceRk } = await sb
      .from("klienti")
      .select("id, status, makler_id")
      .eq("status", "nechce_rk")
      .eq("je_volny", false);
    for (const k of nechceRk || []) {
      movedIds.push(k.id);
      reasons[k.id] = "nechce_rk";
    }

    // 2) "novy" / "novy_kontakt" → 24h od updated_at
    const { data: novi } = await sb
      .from("klienti")
      .select("id, status, updated_at, makler_id")
      .in("status", ["novy", "novy_kontakt"])
      .eq("je_volny", false)
      .lt("updated_at", dayAgo);
    for (const k of novi || []) {
      movedIds.push(k.id);
      reasons[k.id] = `${k.status} (24h bez zmeny)`;
    }

    // 3) "volat_neskor" → 24h od datum_naberu
    const { data: volat } = await sb
      .from("klienti")
      .select("id, status, datum_naberu, makler_id")
      .eq("status", "volat_neskor")
      .eq("je_volny", false)
      .not("datum_naberu", "is", null)
      .lt("datum_naberu", dayAgo);
    for (const k of volat || []) {
      movedIds.push(k.id);
      reasons[k.id] = "volat_neskor (24h po termíne)";
    }

    // 4) "dohodnuty_naber" — 48h SLA warning + 72h critical (NEUVOĽŇUJEME automaticky)
    //    Maklér má najprv 48h na vytvorenie inzerátu. Po 72h ide manažér rozhodnúť.
    const { data: naber } = await sb
      .from("klienti")
      .select("id, status, datum_naberu, makler_id, sla_warning_at, sla_critical_at")
      .eq("status", "dohodnuty_naber")
      .eq("je_volny", false)
      .not("datum_naberu", "is", null);

    // Klienti bez inzerátu (cez nehnutelnosti.makler = klient.makler_id NIE je dostatočné — kontrolujeme cez naberove_listy + nehnutelnosti spojené s klientom)
    // Nájdeme všetky inzeráty (=nehnutelnosti) prepojené na týchto klientov cez naberove_listy.klient_id
    const klientIds = (naber || []).map(k => k.id);
    let inzeratClientIds = new Set<string>();
    if (klientIds.length > 0) {
      // 1. Klient → naberove_listy → nehnutelnost (cez nehnutelnost_id alebo iný link)
      // 2. Alebo Klient → nehnutelnosti.klient_id (priame)
      // Zjednodušene: klient má aspoň 1 nehnutelnost s klient_id = jeho id, znamená že má inzerát
      const { data: nehn } = await sb.from("nehnutelnosti").select("klient_id").in("klient_id", klientIds);
      inzeratClientIds = new Set((nehn || []).map(n => String(n.klient_id)));
    }

    const slaWarningIds: { id: string; makler_id: string | null }[] = [];
    const slaCriticalIds: { id: string; makler_id: string | null }[] = [];

    for (const k of naber || []) {
      if (inzeratClientIds.has(k.id)) continue; // má inzerát → SLA OK
      const naberMs = new Date(String(k.datum_naberu)).getTime();
      const elapsedH = (now.getTime() - naberMs) / HOUR;

      if (elapsedH >= 72 && !k.sla_critical_at) {
        slaCriticalIds.push({ id: k.id, makler_id: k.makler_id as string | null });
      } else if (elapsedH >= 48 && elapsedH < 72 && !k.sla_warning_at) {
        slaWarningIds.push({ id: k.id, makler_id: k.makler_id as string | null });
      }
    }

    // 5) "Posledná šanca" alerts (1h pred vypršaním) pre statusy 1-3
    //    Hľadáme tie ktoré budú v ďalšej hodine vypršiavať a ešte nedostali "last chance"
    const { data: lastChanceCandidates } = await sb
      .from("klienti")
      .select("id, status, updated_at, datum_naberu, makler_id, sla_last_chance_at")
      .in("status", ["novy", "novy_kontakt", "volat_neskor", "dohodnuty_naber"])
      .eq("je_volny", false)
      .is("sla_last_chance_at", null);

    const lastChanceToFlag: { id: string; makler_id: string | null; reason: string }[] = [];
    for (const k of lastChanceCandidates || []) {
      let triggerMs: number | null = null;
      let reason = "";
      if (k.status === "novy" || k.status === "novy_kontakt") {
        triggerMs = new Date(String(k.updated_at)).getTime();
        reason = "1h pred uvolnením (nový klient)";
      } else if (k.status === "volat_neskor" && k.datum_naberu) {
        triggerMs = new Date(String(k.datum_naberu)).getTime();
        reason = "1h pred uvolnením (volať neskor)";
      } else if (k.status === "dohodnuty_naber" && k.datum_naberu) {
        triggerMs = new Date(String(k.datum_naberu)).getTime() + 47 * HOUR;
        reason = "1h pred SLA warningom (chýba inzerát)";
      }
      if (triggerMs && triggerMs <= lastChanceMs) {
        // Vypršiava v nasledujúcej hodine ALEBO už vypršalo (last-chance prešiel)
        const expiresAt = k.status === "dohodnuty_naber"
          ? triggerMs + HOUR // = 48h od náberu
          : triggerMs + 24 * HOUR;
        if (expiresAt > now.getTime()) { // ešte nevypršalo úplne
          lastChanceToFlag.push({ id: k.id, makler_id: k.makler_id as string | null, reason });
        }
      }
    }

    // === Vykonaj presun + auditovanie ===
    let movedCount = 0;
    if (movedIds.length > 0) {
      const { data: toMove } = await sb
        .from("klienti")
        .select("id, status, makler_id")
        .in("id", movedIds);
      for (const k of toMove || []) {
        const { error } = await sb
          .from("klienti")
          .update({
            je_volny: true,
            volny_dovod: k.status,
            volny_at: now.toISOString(),
          })
          .eq("id", k.id);
        if (!error) {
          movedCount++;
          await sb.from("klienti_history").insert({
            klient_id: k.id,
            action: "uvolneny",
            from_makler_id: k.makler_id,
            dovod: reasons[k.id] || k.status,
            meta: { auto: true },
          });
        }
      }
    }

    // SLA warning markers + audit
    let slaWarningCount = 0;
    for (const w of slaWarningIds) {
      await sb.from("klienti").update({ sla_warning_at: now.toISOString() }).eq("id", w.id);
      await sb.from("klienti_history").insert({
        klient_id: w.id,
        action: "sla_warning",
        from_makler_id: w.makler_id,
        dovod: "48h od dohodnutého náberu bez vytvoreného inzerátu",
        meta: { auto: true, hours: 48 },
      });
      slaWarningCount++;
    }
    let slaCriticalCount = 0;
    for (const c of slaCriticalIds) {
      await sb.from("klienti").update({ sla_critical_at: now.toISOString() }).eq("id", c.id);
      await sb.from("klienti_history").insert({
        klient_id: c.id,
        action: "sla_critical",
        from_makler_id: c.makler_id,
        dovod: "72h od dohodnutého náberu bez vytvoreného inzerátu",
        meta: { auto: true, hours: 72 },
      });
      slaCriticalCount++;
    }
    // Posledná šanca markers
    let lastChanceCount = 0;
    for (const lc of lastChanceToFlag) {
      await sb.from("klienti").update({ sla_last_chance_at: now.toISOString() }).eq("id", lc.id);
      await sb.from("klienti_history").insert({
        klient_id: lc.id,
        action: "sla_last_chance",
        from_makler_id: lc.makler_id,
        dovod: lc.reason,
        meta: { auto: true },
      });
      lastChanceCount++;
    }

    // === Notifikácie ===
    if (movedCount > 0) {
      try {
        await sendPushToAll({
          type: "odklik",
          title: `${movedCount} ${movedCount === 1 ? "klient sa uvoľnil" : "klientov sa uvoľnilo"}`,
          body: "Po vypršaní SLA. Skontroluj v sekcii Voľní klienti.",
          url: "/volni-klienti",
        });
      } catch (e) { console.warn("[volni-klienti] push failed:", e); }
    }
    if (slaWarningCount > 0) {
      try {
        await sendPushToAll({
          type: "odklik",
          title: `Pozor: ${slaWarningCount} ${slaWarningCount === 1 ? "klient prekročil" : "klientov prekročilo"} 48h SLA`,
          body: "Vytvor inzerát do 24h, inak rozhoduje manažér.",
          url: "/",
        });
      } catch (e) { console.warn("[volni-klienti] push failed:", e); }
    }
    if (slaCriticalCount > 0) {
      try {
        await sendPushToAll({
          type: "odklik",
          title: `Manažér: ${slaCriticalCount} ${slaCriticalCount === 1 ? "klient" : "klientov"} prekročili 72h SLA`,
          body: "Treba rozhodnúť: presunúť alebo napomenúť maklera.",
          url: "/manazer",
        });
      } catch (e) { console.warn("[volni-klienti] push failed:", e); }
    }
    if (lastChanceCount > 0) {
      try {
        await sendPushToAll({
          type: "odklik",
          title: `Posledná šanca: ${lastChanceCount} ${lastChanceCount === 1 ? "klient" : "klientov"}`,
          body: "Klient/i sa uvoľnia v nasledujúcej hodine. Konaj teraz.",
          url: "/",
        });
      } catch (e) { console.warn("[volni-klienti] push failed:", e); }
    }

    return NextResponse.json({
      message: `${movedCount} uvoľnených, ${slaWarningCount} SLA warningov, ${slaCriticalCount} SLA critical, ${lastChanceCount} last-chance alerty`,
      moved_count: movedCount,
      sla_warning_count: slaWarningCount,
      sla_critical_count: slaCriticalCount,
      last_chance_count: lastChanceCount,
      reasons,
      duration_ms: Date.now() - startTime,
    });
  } catch (e) {
    console.error("[volni-klienti] error:", e);
    return NextResponse.json(
      { error: String(e), duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}
