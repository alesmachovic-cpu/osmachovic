"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  nazov: string;
  obec: string | null;
  ulica_privatna: string | null;
  cena: number | null;
  fotky_thumbs: string[] | null;
  status?: string | null;
  updated_at?: string | null;
};

type Props = {
  value: string | null;
  onChange: (id: string | null, label: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

function priceText(cena: number | null): string {
  if (!cena || cena <= 0) return "";
  return new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 0 }).format(cena) + " €";
}

function itemLabel(it: Item): string {
  const adresa = [it.ulica_privatna, it.obec].filter(Boolean).join(", ");
  return adresa ? `${it.nazov} — ${adresa}` : it.nazov;
}

export default function PropertyPickerSearch({ value, onChange, disabled, placeholder: _placeholder }: Props) {
  const [all, setAll] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterObec, setFilterObec] = useState<string>("");
  const [selected, setSelected] = useState<Item | null>(null);

  // Načítaj aktívne nehnuteľnosti z /api/nehnutelnosti (rešpektuje company scope cez session)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/nehnutelnosti", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Item[];
        const aktivne = (data || [])
          .filter(it => it.status === "aktivny")
          .sort((a, b) => (a.obec || "").localeCompare(b.obec || "", "sk"));
        if (!cancelled) setAll(aktivne);
      } catch {
        if (!cancelled) setAll([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Synchronizuj vybranú položku podľa value
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    const inAll = all.find(i => i.id === value);
    if (inAll) { setSelected(inAll); return; }
    if (selected?.id === value) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/nehnutelnosti?id=${encodeURIComponent(value)}`, { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.nehnutelnost) setSelected(json.nehnutelnost as Item);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [value, all, selected?.id]);

  const obce = useMemo(() => {
    const set = new Set<string>();
    all.forEach(it => { if (it.obec) set.add(it.obec); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sk"));
  }, [all]);

  const filtered = useMemo(() => {
    if (!filterObec) return all;
    return all.filter(it => it.obec === filterObec);
  }, [all, filterObec]);

  // Pri prvom render-i auto-vyber obec ak je len jedna
  useEffect(() => {
    if (!filterObec && obce.length === 1) setFilterObec(obce[0]);
  }, [obce, filterObec]);

  // Selected state — kompaktná karta
  if (selected) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "8px 10px", borderRadius: "10px",
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
      }}>
        {selected.fotky_thumbs?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.fotky_thumbs[0]} alt="" style={{
            width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0,
          }} />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: 8, background: "var(--bg-surface)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>🏠</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected.nazov}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[selected.ulica_privatna, selected.obec].filter(Boolean).join(", ") || "—"}
            {priceText(selected.cena) && <> · <b>{priceText(selected.cena)}</b></>}
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => { setSelected(null); onChange(null, null); }}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 8,
              padding: "4px 10px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer",
            }}
          >Zmeniť</button>
        )}
      </div>
    );
  }

  // Picker state — filter + grid
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <select
        value={filterObec}
        onChange={e => setFilterObec(e.target.value)}
        disabled={disabled || loading}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: "10px",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          color: "var(--text-primary)", fontSize: 13, outline: "none", appearance: "none",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
        }}
      >
        <option value="">— vyber mesto / obec —</option>
        {obce.map(o => {
          const count = all.filter(it => it.obec === o).length;
          return <option key={o} value={o}>{o} ({count})</option>;
        })}
      </select>

      {loading && (
        <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)" }}>Načítavam portfólio…</div>
      )}

      {!loading && all.length === 0 && (
        <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)" }}>
          V portfóliu nie sú žiadne aktívne nehnuteľnosti.
        </div>
      )}

      {!loading && all.length > 0 && !filterObec && (
        <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)" }}>
          Vyber mesto/obec pre zobrazenie nehnuteľností.
        </div>
      )}

      {!loading && filterObec && filtered.length === 0 && (
        <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)" }}>
          V <b>{filterObec}</b> nie sú žiadne aktívne nehnuteľnosti.
        </div>
      )}

      {!loading && filtered.length > 0 && filterObec && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr", gap: 6,
          maxHeight: 360, overflowY: "auto",
          border: "1px solid var(--border)", borderRadius: 10, padding: 6,
        }}>
          {filtered.map(it => (
            <button
              key={it.id}
              type="button"
              onClick={() => { setSelected(it); onChange(it.id, itemLabel(it)); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "8px 10px", background: "var(--bg-elevated)",
                border: "1px solid var(--border)", borderRadius: 8,
                cursor: "pointer", textAlign: "left",
              }}
            >
              {it.fotky_thumbs?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.fotky_thumbs[0]} alt="" style={{
                  width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0,
                }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: 6, background: "var(--bg-surface)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
                }}>🏠</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.nazov}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.ulica_privatna || "—"}
                  {priceText(it.cena) && <> · <b>{priceText(it.cena)}</b></>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
