"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useZhodyPreObjednavku, useZaujemcoviaPreNehnutelnost } from "@/hooks/useMatching";
import type { ZhodaItem, ZaujemcaItem } from "@/hooks/useMatching";

type Props = {
  klientTyp: string;
  nehnutelnostId?: string | null;
  objednavkaId?: string | null;
  klientId: string;
  onPlanovatObhliadku?: (matchKlientId: string, matchMeno: string, matchTel?: string | null) => void;
};

function scoreBadge(score: number) {
  if (score >= 85) return { bg: "#0f3a22", fg: "#86efac" };
  if (score >= 70) return { bg: "#3a2d0e", fg: "#fde68a" };
  return { bg: "#243044", fg: "#94a3b8" };
}

function SkeletonRow() {
  return (
    <div style={{ padding: "10px 14px", display: "flex", gap: "10px", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: "36px", height: "20px", background: "var(--bg-elevated)", borderRadius: "4px" }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: "12px", background: "var(--bg-elevated)", borderRadius: "4px", marginBottom: "6px", width: "70%" }} />
        <div style={{ height: "10px", background: "var(--bg-elevated)", borderRadius: "4px", width: "50%" }} />
      </div>
    </div>
  );
}

function SellerWidget({ nehnutelnostId, onPlanovatObhliadku, klientId }: {
  nehnutelnostId: string;
  onPlanovatObhliadku?: Props["onPlanovatObhliadku"];
  klientId: string;
}) {
  const router = useRouter();
  const { data, loading } = useZaujemcoviaPreNehnutelnost(nehnutelnostId);
  const [selectedMatch, setSelectedMatch] = useState<ZaujemcaItem | null>(null);

  const top3 = (data ?? []).slice(0, 3);
  const totalCount = (data ?? []).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
          🎯 Kupujúci — {loading ? "…" : `${totalCount} zhôd`}
        </span>
        <button onClick={() => router.push(`/nastroje?tab=matching&nehnutelnost=${nehnutelnostId}`)}
          style={{ fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Všetky →
        </button>
      </div>

      {loading && <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}

      {!loading && top3.length === 0 && (
        <div style={{ padding: "16px 14px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          Zatiaľ žiadne zhody.<br />
          <button onClick={() => router.push(`/naber?klient_id=${klientId}`)}
            style={{ marginTop: "6px", fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Doplniť inzerát →
          </button>
        </div>
      )}

      {top3.map((m: ZaujemcaItem, i: number) => {
        const o = m.objednavka;
        const kup = o.kupujuci;
        const meno = kup?.meno ?? "Záujemca";
        const tel = kup?.telefon ?? null;
        const badge = scoreBadge(m.score);
        const druhRaw = o.druh;
        const druhArr = Array.isArray(druhRaw) ? druhRaw : String(druhRaw || "").split(/[,/]/).map((s: string) => s.trim()).filter(Boolean);
        const lokRaw = (o.lokalita || {}) as Record<string, unknown>;
        const lokArr: string[] = [];
        if ((lokRaw.kraje as string[] | undefined)?.length) lokArr.push((lokRaw.kraje as string[])[0]);
        else if (lokRaw.kraj) lokArr.push(String(lokRaw.kraj));
        if (lokRaw.obec) lokArr.push(String(lokRaw.obec));
        const cenaDo = o.cena_do ? `${Math.round(o.cena_do / 1000)}k €` : null;
        const summary = [druhArr[0], lokArr[0], cenaDo].filter(Boolean).join(" · ");

        return (
          <div key={o.id} style={{ borderBottom: i < top3.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div onClick={() => setSelectedMatch(selectedMatch?.objednavka.id === o.id ? null : m)}
              style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: badge.bg, color: badge.fg, flexShrink: 0, marginTop: "1px" }}>
                {m.score}%
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meno}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{summary || "—"}</div>
              </div>
              {tel && (
                <a href={`tel:${tel}`} onClick={e => e.stopPropagation()}
                  style={{ fontSize: "11px", padding: "3px 6px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "5px", textDecoration: "none", color: "var(--text-primary)", flexShrink: 0 }}>
                  📞
                </a>
              )}
            </div>
            {selectedMatch?.objednavka.id === o.id && (
              <div style={{ padding: "10px 14px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border)" }}>
                {tel && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>📞 {tel}</div>}
                {o.cena_od && o.cena_do && (
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    💰 {Number(o.cena_od).toLocaleString("sk")} – {Number(o.cena_do).toLocaleString("sk")} €
                  </div>
                )}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {onPlanovatObhliadku && kup && (
                    <button onClick={() => { onPlanovatObhliadku(kup.id, kup.meno, kup.telefon); setSelectedMatch(null); }}
                      style={{ fontSize: "11px", padding: "5px 10px", background: "#374151", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
                      📅 Naplánovať obhliadku
                    </button>
                  )}
                  {kup && (
                    <button onClick={() => router.push(`/klienti/${kup.id}`)}
                      style={{ fontSize: "11px", padding: "5px 10px", background: "var(--bg-surface)", color: "#60a5fa", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>
                      Karta →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!loading && top3.length > 0 && onPlanovatObhliadku && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
          <button onClick={() => {
            const first = top3[0].objednavka.kupujuci;
            if (first) onPlanovatObhliadku(first.id, first.meno, first.telefon);
          }} style={{ width: "100%", padding: "7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "7px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            📅 Naplánovať obhliadku
          </button>
        </div>
      )}
    </div>
  );
}

function BuyerWidget({ objednavkaId, onPlanovatObhliadku, klientId }: {
  objednavkaId: string;
  onPlanovatObhliadku?: Props["onPlanovatObhliadku"];
  klientId: string;
}) {
  const router = useRouter();
  const { data, loading } = useZhodyPreObjednavku(objednavkaId, 3);
  const [selectedMatch, setSelectedMatch] = useState<ZhodaItem | null>(null);

  const top3 = (data ?? []).slice(0, 3);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
          🎯 Ponuky — {loading ? "…" : `${top3.length} zhôd`}
        </span>
        <button onClick={() => router.push(`/nastroje?tab=matching&objednavka=${objednavkaId}`)}
          style={{ fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Všetky →
        </button>
      </div>

      {loading && <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}

      {!loading && top3.length === 0 && (
        <div style={{ padding: "16px 14px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          Žiadne zhody.<br />
          <button onClick={() => router.push(`/kupujuci?klient_id=${klientId}`)}
            style={{ marginTop: "6px", fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Upraviť kritériá →
          </button>
        </div>
      )}

      {top3.map((m: ZhodaItem, i: number) => {
        const n = m.nehnutelnost;
        const pred = n.predavajuci;
        const badge = scoreBadge(m.score);
        const isMonitor = n.source === "monitor";
        const summary = [n.lokalita || n.okres, n.cena ? `${Math.round(n.cena / 1000)}k €` : null, n.plocha ? `${n.plocha}m²` : null].filter(Boolean).join(" · ");

        return (
          <div key={n.id} style={{ borderBottom: i < top3.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div onClick={() => setSelectedMatch(selectedMatch?.nehnutelnost.id === n.id ? null : m)}
              style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: badge.bg, color: badge.fg, flexShrink: 0, marginTop: "1px" }}>
                {m.score}%
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {isMonitor && n.url ? (
                  <a href={n.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    style={{ fontSize: "12px", fontWeight: 600, color: "#60a5fa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", textDecoration: "none" }}>
                    {summary || "Nehnuteľnosť"}
                  </a>
                ) : (
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary || "Nehnuteľnosť"}</div>
                )}
                <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "4px", alignItems: "center" }}>
                  {isMonitor && n.portal && (
                    <span style={{ fontSize: "9px", padding: "1px 4px", background: "#1e3a5f", color: "#93c5fd", borderRadius: "3px", flexShrink: 0 }}>{n.portal}</span>
                  )}
                  <span>{pred?.meno ?? "—"}</span>
                </div>
              </div>
              {pred?.telefon && (
                <a href={`tel:${pred.telefon}`} onClick={e => e.stopPropagation()}
                  style={{ fontSize: "11px", padding: "3px 6px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "5px", textDecoration: "none", color: "var(--text-primary)", flexShrink: 0 }}>
                  📞
                </a>
              )}
            </div>
            {selectedMatch?.nehnutelnost.id === n.id && (
              <div style={{ padding: "10px 14px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border)" }}>
                {pred?.telefon && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>📞 {pred.telefon}</div>}
                {n.cena && <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "6px" }}>💰 {Number(n.cena).toLocaleString("sk")} €</div>}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {onPlanovatObhliadku && pred && pred.id && (
                    <button onClick={() => { onPlanovatObhliadku(pred.id, pred.meno, pred.telefon); setSelectedMatch(null); }}
                      style={{ fontSize: "11px", padding: "5px 10px", background: "#374151", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
                      📅 Naplánovať obhliadku
                    </button>
                  )}
                  {!isMonitor && pred && pred.id && (
                    <button onClick={() => router.push(`/klienti/${pred.id}`)}
                      style={{ fontSize: "11px", padding: "5px 10px", background: "var(--bg-surface)", color: "#60a5fa", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>
                      Karta →
                    </button>
                  )}
                  {isMonitor && n.url && (
                    <a href={n.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: "11px", padding: "5px 10px", background: "var(--bg-surface)", color: "#60a5fa", border: "1px solid var(--border)", borderRadius: "6px", textDecoration: "none" }}>
                      Inzerát →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MatchingWidget({ klientTyp, nehnutelnostId, objednavkaId, klientId, onPlanovatObhliadku }: Props) {
  const isSeller = (klientTyp === "predavajuci" || klientTyp === "oboje") && !!nehnutelnostId;
  const isBuyer = klientTyp === "kupujuci" && !!objednavkaId;
  const isBuyerFallback = klientTyp === "oboje" && !nehnutelnostId && !!objednavkaId;

  if (isSeller) {
    return <SellerWidget nehnutelnostId={nehnutelnostId!} onPlanovatObhliadku={onPlanovatObhliadku} klientId={klientId} />;
  }
  if (isBuyer || isBuyerFallback) {
    return <BuyerWidget objednavkaId={objednavkaId!} onPlanovatObhliadku={onPlanovatObhliadku} klientId={klientId} />;
  }
  const isKupujuci = klientTyp === "kupujuci" || klientTyp === "oboje";
  return (
    <div style={{ padding: "16px 14px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
      🎯 Matching<br />
      <button onClick={() => window.location.href = isKupujuci ? `/kupujuci?klient_id=${klientId}` : `/naber?klient_id=${klientId}`}
        style={{ marginTop: "6px", fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {isKupujuci ? "Vytvoriť objednávku →" : "Pridať inzerát →"}
      </button>
    </div>
  );
}
