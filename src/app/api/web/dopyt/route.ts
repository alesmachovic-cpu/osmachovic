import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyUser } from "@/lib/notify";
import type { SiteData } from "@/lib/web/types";

export const runtime = "nodejs";

/** Jednoduchý rate limit na IP (best-effort, per inštancia). */
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 8;
}

const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/**
 * POST /api/web/dopyt — verejný formulár „Koľko stojí vaša nehnuteľnosť".
 * Uloží dopyt do web_dopyty, pošle e‑mail maklérovi (Resend) a push/e‑mail
 * priradenému používateľovi CRM.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Príliš veľa pokusov, skúste to o chvíľu." }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }

  // honeypot
  if (typeof body.web === "string" && body.web.trim()) return NextResponse.json({ ok: true });

  const str = (k: string, max = 200) => String(body[k] ?? "").trim().slice(0, max);
  const slug = str("slug", 80);
  const data = {
    typ: str("typ", 40), adresa: str("adresa"), m2: str("m2", 20), stav: str("stav", 60), izby: str("izby", 20),
    meno: str("meno"), tel: str("tel", 40), kedy: str("kedy", 60),
  };
  if (!slug || !data.typ || !data.adresa || !data.m2 || !data.meno || !data.tel) {
    return NextResponse.json({ error: "Chýbajú povinné údaje" }, { status: 400 });
  }
  if (body.gdpr !== true) return NextResponse.json({ error: "Chýba súhlas so spracovaním údajov" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: site } = await sb.from("web_sites").select("id, user_id, published").eq("slug", slug).maybeSingle();
  if (!site?.published) return NextResponse.json({ error: "Web neexistuje" }, { status: 404 });
  const pub = site.published as SiteData;

  const { error } = await sb.from("web_dopyty").insert({ site_id: site.id, site_slug: slug, data, ip });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = [
    ["Typ", data.typ], ["Adresa / lokalita", data.adresa], ["Výmera", `${data.m2} m²`],
    ["Stav", data.stav || "—"], ["Izby", data.izby || "—"], ["Kedy predávať", data.kedy || "neviem ešte"],
    ["Meno", data.meno], ["Telefón", data.tel],
  ];
  const html = `<h2>Nový dopyt na ocenenie z webu</h2><table cellpadding="6">${lines.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table><p>Web: /web/${esc(slug)}</p>`;

  // E‑mail maklérovi (adresa z webu) — best effort
  const RESEND = process.env.RESEND_API_KEY;
  if (RESEND && pub.email) {
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "VIANEMA Real <onboarding@resend.dev>",
        to: pub.email,
        subject: `Dopyt na ocenenie — ${data.adresa}`,
        html,
      }),
    }).catch(e => console.warn("[web dopyt] email failed:", e));
  }
  // Push + e‑mail priradenému používateľovi CRM
  if (site.user_id) {
    notifyUser(site.user_id as string, {
      type: "web_dopyt",
      title: "Nový dopyt z webu",
      body: `${data.meno} · ${data.typ} ${data.adresa} · ${data.m2} m²`,
      url: "/weby?tab=dopyty",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
