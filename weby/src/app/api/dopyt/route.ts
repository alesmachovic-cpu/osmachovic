import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/db";
import type { SiteData } from "@/lib/types";

export const runtime = "nodejs";

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 8;
}
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** POST /api/dopyt — verejný formulár. Uloží dopyt a pošle e‑mail maklérovi (Resend). */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Príliš veľa pokusov, skúste to o chvíľu." }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 }); }
  if (typeof body.web === "string" && body.web.trim()) return NextResponse.json({ ok: true }); // honeypot

  const str = (k: string, max = 200) => String(body[k] ?? "").trim().slice(0, max);
  const slug = str("slug", 80);
  const data = { typ: str("typ", 40), adresa: str("adresa"), m2: str("m2", 20), stav: str("stav", 60), izby: str("izby", 20), meno: str("meno"), tel: str("tel", 40), kedy: str("kedy", 60) };
  if (!slug || !data.typ || !data.adresa || !data.m2 || !data.meno || !data.tel) return NextResponse.json({ error: "Chýbajú povinné údaje" }, { status: 400 });
  if (body.gdpr !== true) return NextResponse.json({ error: "Chýba súhlas so spracovaním údajov" }, { status: 400 });

  const { data: site } = await sb().from("weby_sites").select("id, published").eq("slug", slug).maybeSingle();
  if (!site?.published) return NextResponse.json({ error: "Web neexistuje" }, { status: 404 });
  const pub = site.published as SiteData;

  const { error } = await sb().from("weby_leads").insert({ site_id: site.id, site_slug: slug, data, ip });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const RESEND = process.env.RESEND_API_KEY;
  if (RESEND && pub.email) {
    const rows = [["Typ", data.typ], ["Adresa / lokalita", data.adresa], ["Výmera", `${data.m2} m²`], ["Stav", data.stav || "—"], ["Izby", data.izby || "—"], ["Kedy predávať", data.kedy || "neviem ešte"], ["Meno", data.meno], ["Telefón", data.tel]];
    const html = `<h2>Nový dopyt na ocenenie z webu</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>`;
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM || "Vianema weby <onboarding@resend.dev>", to: pub.email, subject: `Dopyt na ocenenie — ${data.adresa}`, html }),
    }).catch(e => console.warn("[dopyt] email failed:", e));
  }
  return NextResponse.json({ ok: true });
}
