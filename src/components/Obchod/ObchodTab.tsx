"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Klient } from "@/lib/database.types";
import { OBCHOD_STATUS_LABELS, OBCHOD_STATUS_COLORS } from "@/lib/obchodStatus";

// ─── Typy ─────────────────────────────────────────────────────────────────────

interface ObchodUloha {
  id: string;
  obchod_id: string;
  kategoria: "dokument" | "aml" | "akcia" | "termin";
  nazov: string;
  popis?: string | null;
  done: boolean;
  done_at?: string | null;
  priorita: "nizka" | "normalna" | "vysoka";
  deadline?: string | null;
  drive_link?: string | null;
  calendar_event_id?: string | null;
  created_at: string;
}

interface Obchod {
  id: string;
  klient_id: string;
  nehnutelnost_id?: string | null;
  status: string;
  cena?: number | null;
  provizia?: number | null;
  kupujuci_meno?: string | null;
  notar?: string | null;
  banka?: string | null;
  poznamky?: string | null;
  rz_vynimka_poziadana?: boolean;
  rz_vynimka_approved?: boolean;
  created_at: string;
  updated_at: string;
  obchod_ulohy: ObchodUloha[];
}

type ZmluvaInfo = {
  zmluva: boolean;
  typZmluvy: string | null;
  zmluva_do: string | null;
  datum_podpisu: string | null;
  naberakId: string | null;
} | null;

// ─── Pomocné ──────────────────────────────────────────────────────────────────

const KATEGORIA_META: Record<string, { label: string; icon: string }> = {
  dokument: { label: "Dokumenty",        icon: "📄" },
  aml:      { label: "AML / Overenia",   icon: "🛡️" },
  akcia:    { label: "Akcie a úlohy",    icon: "⚙️" },
  termin:   { label: "Termíny",          icon: "📅" },
};

const PRIORITA_COLORS: Record<string, string> = {
  vysoka:   "#EF4444",
  normalna: "#6B7280",
  nizka:    "#9CA3AF",
};

const PRIORITA_LABELS: Record<string, string> = {
  vysoka:   "Vysoká",
  normalna: "Normálna",
  nizka:    "Nízka",
};

function deadlineChipStyle(deadline: string | null | undefined): React.CSSProperties {
  if (!deadline) return { display: "none" };
  const d = new Date(deadline);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0)   return { background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5" };
  if (diff <= 3)  return { background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" };
  return { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("sk-SK", { day: "numeric", month: "short" });
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("sk-SK") + " €";
}

// ─── Riadok úlohy ─────────────────────────────────────────────────────────────

function UlohaRow({
  uloha,
  obchodId,
  onToggle,
  onDriveEdit,
}: {
  uloha: ObchodUloha;
  obchodId: string;
  onToggle: (id: string, done: boolean) => Promise<void>;
  onDriveEdit: (id: string, link: string) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const chipSt: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "3px",
    padding: "2px 8px", borderRadius: "20px",
    fontSize: "11px", fontWeight: 500,
  };

  const dl = deadlineChipStyle(uloha.deadline);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "10px",
      padding: "10px 0", borderBottom: "1px solid var(--border)",
      opacity: uloha.done ? 0.55 : 1, transition: "opacity 0.2s",
    }}>
      {/* Checkbox */}
      <button
        disabled={toggling}
        onClick={async () => {
          setToggling(true);
          try { await onToggle(uloha.id, !uloha.done); } finally { setToggling(false); }
        }}
        style={{
          width: "20px", height: "20px", borderRadius: "5px", flexShrink: 0, marginTop: "1px",
          border: uloha.done ? "none" : "2px solid var(--border)",
          background: uloha.done ? "#059669" : "var(--bg-surface)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", color: "#fff",
        }}
        title={uloha.done ? "Označiť ako nedokončené" : "Označiť ako hotové"}
      >
        {uloha.done && "✓"}
      </button>

      {/* Obsah */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: "13px", fontWeight: uloha.done ? 400 : 600,
          color: "var(--text-primary)",
          textDecoration: uloha.done ? "line-through" : "none",
        }}>
          {uloha.nazov}
        </div>
        {uloha.popis && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {uloha.popis}
          </div>
        )}
        {/* Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
          {/* Priorita — zobraz len vysoku */}
          {uloha.priorita === "vysoka" && !uloha.done && (
            <span style={{ ...chipSt, background: "#FEE2E2", color: PRIORITA_COLORS.vysoka, border: "1px solid #FCA5A5" }}>
              ↑ {PRIORITA_LABELS.vysoka}
            </span>
          )}
          {/* Deadline */}
          {uloha.deadline && (
            <span style={{ ...chipSt, ...dl }}>
              ⏰ {formatDate(uloha.deadline)}
            </span>
          )}
          {/* Drive link */}
          {uloha.drive_link ? (
            <a
              href={uloha.drive_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...chipSt, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", textDecoration: "none" }}
            >
              📁 Drive
            </a>
          ) : (
            <button
              onClick={() => onDriveEdit(uloha.id, "")}
              style={{ ...chipSt, background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer" }}
            >
              + Drive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sekcia (Dokumenty / AML / Akcie / Termíny) ───────────────────────────────

function ObchodSekcia({
  kategoria,
  ulohy,
  obchodId,
  onToggle,
  onDriveEdit,
}: {
  kategoria: string;
  ulohy: ObchodUloha[];
  obchodId: string;
  onToggle: (id: string, done: boolean) => Promise<void>;
  onDriveEdit: (id: string, link: string) => void;
}) {
  const meta = KATEGORIA_META[kategoria] ?? { label: kategoria, icon: "📌" };
  const done = ulohy.filter(u => u.done).length;

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "14px", padding: "18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "17px" }}>{meta.icon}</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{meta.label}</span>
        </div>
        <span style={{ fontSize: "12px", color: done === ulohy.length && ulohy.length > 0 ? "#059669" : "var(--text-muted)", fontWeight: 600 }}>
          {done}/{ulohy.length}
        </span>
      </div>

      {/* Mini progress */}
      <div style={{ height: "3px", background: "var(--border)", borderRadius: "3px", marginBottom: "12px", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "3px",
          background: done === ulohy.length && ulohy.length > 0 ? "#059669" : "#3B82F6",
          width: ulohy.length > 0 ? `${(done / ulohy.length) * 100}%` : "0%",
          transition: "width 0.3s",
        }} />
      </div>

      {ulohy.length === 0 ? (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "8px 0" }}>Žiadne úlohy</div>
      ) : (
        <div>
          {ulohy.map(u => (
            <UlohaRow
              key={u.id}
              uloha={u}
              obchodId={obchodId}
              onToggle={onToggle}
              onDriveEdit={onDriveEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modál: vytvorenie obchodu ─────────────────────────────────────────────────

function NovyObchodModal({
  klientId,
  onCreated,
  onClose,
}: {
  klientId: string;
  onCreated: (o: Obchod) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [cena, setCena] = useState("");
  const [provizia, setProvizia] = useState("");
  const [kupujuci, setKupujuci] = useState("");
  const [notar, setNotar] = useState("");
  const [banka, setBanka] = useState("");

  async function create() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/obchody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          klient_id:     klientId,
          cena:          cena ? Number(cena) : null,
          provizia:      provizia ? Number(provizia) : null,
          kupujuci_meno: kupujuci || null,
          notar:         notar || null,
          banka:         banka || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || res.statusText); }
      const { obchod } = await res.json();
      onCreated(obchod);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    background: "var(--bg-elevated)", border: "1px solid var(--border)",
    color: "var(--text-primary)", fontSize: "13px",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: "16px",
    }}>
      <div style={{
        background: "var(--bg-surface)", borderRadius: "18px",
        padding: "28px", width: "100%", maxWidth: "480px",
        boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
      }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 20px" }}>
          🤝 Nový obchod
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 20px" }}>
          Vyplň kľúčové fakty. Predvyplnené úlohy sa pridajú automaticky.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>CENA (€)</label>
              <input value={cena} onChange={e => setCena(e.target.value)} type="number" placeholder="napr. 185000" style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>PROVÍZIA (€)</label>
              <input value={provizia} onChange={e => setProvizia(e.target.value)} type="number" placeholder="napr. 3700" style={inputSt} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>KUPUJÚCI</label>
            <input value={kupujuci} onChange={e => setKupujuci(e.target.value)} placeholder="Meno a priezvisko kupujúceho" style={inputSt} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>NOTÁR</label>
              <input value={notar} onChange={e => setNotar(e.target.value)} placeholder="JUDr. ..." style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "5px" }}>BANKA</label>
              <input value={banka} onChange={e => setBanka(e.target.value)} placeholder="SLSP, VÚB, ..." style={inputSt} />
            </div>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: "14px", padding: "10px 12px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "8px", fontSize: "13px", color: "#B91C1C" }}>
            ⚠️ {err}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: "10px 18px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
          }}>Zrušiť</button>
          <button onClick={create} disabled={saving} style={{
            padding: "10px 22px", background: "#374151", color: "#fff",
            border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}>
            {saving ? "Vytváram..." : "Vytvoriť obchod"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modál: pridať Drive link ──────────────────────────────────────────────────

function DriveModal({
  ulohaId,
  obchodId,
  initial,
  onSaved,
  onClose,
}: {
  ulohaId: string;
  obchodId: string;
  initial: string;
  onSaved: (ulohaId: string, link: string) => void;
  onClose: () => void;
}) {
  const [link, setLink] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/obchody/${obchodId}/ulohy/${ulohaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ drive_link: link || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved(ulohaId, link);
      onClose();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1010, padding: "16px",
    }}>
      <div style={{
        background: "var(--bg-surface)", borderRadius: "14px",
        padding: "24px", width: "100%", maxWidth: "420px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
          📁 Drive odkaz
        </h3>
        <input
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="https://drive.google.com/..."
          style={{
            width: "100%", padding: "10px 12px", borderRadius: "8px",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            color: "var(--text-primary)", fontSize: "13px",
          }}
          autoFocus
        />
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
          <button onClick={onClose} style={{
            padding: "9px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "8px", fontSize: "13px", cursor: "pointer", color: "var(--text-secondary)",
          }}>Zrušiť</button>
          <button onClick={save} disabled={saving} style={{
            padding: "9px 18px", background: "#374151", color: "#fff",
            border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}>
            {saving ? "Ukladám..." : "Uložiť"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hlavný komponent ──────────────────────────────────────────────────────────

export default function ObchodTab({
  klient,
  userId,
  zmluvaInfo,
}: {
  klient: Klient;
  userId: string;
  zmluvaInfo?: ZmluvaInfo;
}) {
  const [obchody, setObchody] = useState<Obchod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovyModal, setShowNovyModal] = useState(false);
  const [driveModal, setDriveModal] = useState<{ ulohaId: string; initial: string } | null>(null);
  const [activeObchodIdx, setActiveObchodIdx] = useState(0);
  const [rzGate, setRzGate] = useState<{ obchodId: string; ulohaId: string } | null>(null);
  const [vynimkaSending, setVynimkaSending] = useState(false);
  const notesRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/obchody?klient_id=${klient.id}`, { credentials: "include" });
      if (res.ok) {
        const { obchody: data } = await res.json();
        setObchody(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [klient.id]);

  useEffect(() => { load(); }, [load]);

  // ── Toggle úlohy ────────────────────────────────────────────────────────────
  async function toggleUloha(obchodId: string, ulohaId: string, done: boolean) {
    // Gate: RZ vyžaduje výhradnú zmluvu
    if (done) {
      const uloha = obchody.find(o => o.id === obchodId)?.obchod_ulohy.find(u => u.id === ulohaId);
      const isRZ = uloha?.nazov?.toLowerCase().includes("rezervačná zmluva") || uloha?.nazov?.toLowerCase().includes("rezervacna zmluva");
      if (isRZ) {
        const obchod = obchody.find(o => o.id === obchodId);
        const hasVyhradna = zmluvaInfo?.zmluva && zmluvaInfo.typZmluvy === "exkluzivna";
        const hasVynimka = obchod?.rz_vynimka_approved;
        if (!hasVyhradna && !hasVynimka) {
          setRzGate({ obchodId, ulohaId });
          return;
        }
      }
    }

    const res = await fetch(`/api/obchody/${obchodId}/ulohy/${ulohaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ done }),
    });
    if (!res.ok) return;
    const { uloha } = await res.json();

    setObchody(prev => prev.map(o => {
      if (o.id !== obchodId) return o;
      const updatedUlohy = o.obchod_ulohy.map(u => u.id === ulohaId ? { ...u, ...uloha } : u);
      return { ...o, obchod_ulohy: updatedUlohy };
    }));

    // Refresh obchod status z BE
    const oRes = await fetch(`/api/obchody?klient_id=${klient.id}`, { credentials: "include" });
    if (oRes.ok) {
      const { obchody: fresh } = await oRes.json();
      setObchody(fresh ?? []);
    }
  }

  // ── Požiadať o výnimku na RZ ────────────────────────────────────────────────
  async function poziadatVynimku(obchodId: string) {
    setVynimkaSending(true);
    await fetch(`/api/obchody/${obchodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rz_vynimka_poziadana: true }),
    });
    // Refresh
    const oRes = await fetch(`/api/obchody?klient_id=${klient.id}`, { credentials: "include" });
    if (oRes.ok) {
      const { obchody: fresh } = await oRes.json();
      setObchody(fresh ?? []);
    }
    setVynimkaSending(false);
    setRzGate(null);
  }

  // ── Schváliť výnimku (admin/manažér) ───────────────────────────────────────
  async function schvalitVynimku(obchodId: string) {
    await fetch(`/api/obchody/${obchodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ rz_vynimka_approved: true }),
    });
    const oRes = await fetch(`/api/obchody?klient_id=${klient.id}`, { credentials: "include" });
    if (oRes.ok) {
      const { obchody: fresh } = await oRes.json();
      setObchody(fresh ?? []);
    }
  }

  // ── Autosave poznámok ────────────────────────────────────────────────────────
  function handleNotesChange(obchodId: string, text: string) {
    setObchody(prev => prev.map(o => o.id === obchodId ? { ...o, poznamky: text } : o));
    if (notesRef.current) clearTimeout(notesRef.current);
    notesRef.current = setTimeout(() => {
      fetch(`/api/obchody/${obchodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ poznamky: text }),
      });
    }, 800);
  }

  // ── Drive link uloženie ──────────────────────────────────────────────────────
  function saveDriveLink(ulohaId: string, link: string) {
    setObchody(prev => prev.map(o => ({
      ...o,
      obchod_ulohy: o.obchod_ulohy.map(u => u.id === ulohaId ? { ...u, drive_link: link || null } : u),
    })));
  }

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
        Načítavam obchody...
      </div>
    );
  }

  // ── Prázdny stav ─────────────────────────────────────────────────────────────
  if (obchody.length === 0) {
    return (
      <>
        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "14px", padding: "48px", textAlign: "center",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>🤝</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
            Žiadny aktívny obchod
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px", maxWidth: "320px", margin: "0 auto 24px" }}>
            Vytvor obchod a systém automaticky pripraví checklist dokumentov, AML a akcií.
          </div>
          <button
            onClick={() => setShowNovyModal(true)}
            style={{
              padding: "11px 24px", background: "#374151", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "14px",
              fontWeight: 600, cursor: "pointer",
            }}
          >
            + Vytvoriť obchod
          </button>
        </div>

        {showNovyModal && (
          <NovyObchodModal
            klientId={klient.id}
            onCreated={o => { setObchody([o]); setShowNovyModal(false); }}
            onClose={() => setShowNovyModal(false)}
          />
        )}
      </>
    );
  }

  const obchod = obchody[activeObchodIdx] ?? obchody[0];
  const ulohy = obchod.obchod_ulohy ?? [];
  const totalDone = ulohy.filter(u => u.done).length;
  const totalAll = ulohy.length;
  const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;
  const statusColor = OBCHOD_STATUS_COLORS[obchod.status as keyof typeof OBCHOD_STATUS_COLORS] ?? "#6B7280";
  const statusLabel = OBCHOD_STATUS_LABELS[obchod.status as keyof typeof OBCHOD_STATUS_LABELS] ?? obchod.status;

  const byKat = (k: string) => ulohy.filter(u => u.kategoria === k);

  return (
    <>
      {/* ── Prepínač obchodov (ak je viac) ─────────────────────────────── */}
      {obchody.length > 1 && (
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          {obchody.map((o, i) => (
            <button
              key={o.id}
              onClick={() => setActiveObchodIdx(i)}
              style={{
                padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                border: i === activeObchodIdx ? "1px solid #374151" : "1px solid var(--border)",
                background: i === activeObchodIdx ? "#374151" : "var(--bg-surface)",
                color: i === activeObchodIdx ? "#fff" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              Obchod {i + 1}
            </button>
          ))}
          <button
            onClick={() => setShowNovyModal(true)}
            style={{
              padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              border: "1px dashed var(--border)", background: "var(--bg-surface)",
              color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            + Nový
          </button>
        </div>
      )}

      {/* ── Hlavička obchodu ────────────────────────────────────────────── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "14px", padding: "20px", marginBottom: "16px",
      }}>
        {/* Status + progress */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              display: "inline-block", padding: "4px 12px", borderRadius: "20px",
              background: `${statusColor}18`, color: statusColor,
              fontSize: "12px", fontWeight: 700, border: `1px solid ${statusColor}40`,
            }}>
              {statusLabel}
            </span>
            <span style={{
              display: "inline-block", padding: "4px 12px", borderRadius: "20px",
              background: "var(--bg-elevated)", color: "var(--text-muted)",
              fontSize: "12px", fontWeight: 600, border: "1px solid var(--border)",
            }}>
              {totalDone}/{totalAll} hotových
            </span>
          </div>
          <button
            onClick={() => setShowNovyModal(true)}
            style={{
              padding: "7px 14px", background: "var(--bg-elevated)",
              border: "1px solid var(--border)", borderRadius: "8px",
              fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            + Nový obchod
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Postup obchodu</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: pct === 100 ? "#059669" : "var(--text-primary)" }}>{pct}%</span>
          </div>
          <div style={{ height: "6px", background: "var(--border)", borderRadius: "6px", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "6px",
              background: pct === 100 ? "#059669" : "#3B82F6",
              width: `${pct}%`, transition: "width 0.3s",
            }} />
          </div>
        </div>

        {/* Kľúčové fakty */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
          {[
            { label: "Cena", value: fmtEur(obchod.cena) },
            { label: "Provízia", value: fmtEur(obchod.provizia) },
            { label: "Kupujúci", value: obchod.kupujuci_meno || "—" },
            { label: "Notár", value: obchod.notar || "—" },
            { label: "Banka", value: obchod.banka || "—" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>{f.label}</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zmluva status banner ────────────────────────────────────────── */}
      {zmluvaInfo !== undefined && (() => {
        const hasVyhradna = zmluvaInfo?.zmluva && zmluvaInfo.typZmluvy === "exkluzivna";
        const hasNevyhradna = zmluvaInfo?.zmluva && zmluvaInfo.typZmluvy === "neexkluzivna";
        const noZmluva = !zmluvaInfo?.zmluva;
        const expired = zmluvaInfo?.zmluva_do ? new Date(zmluvaInfo.zmluva_do) < new Date() : false;
        const poziadana = obchod.rz_vynimka_poziadana;
        const approved = obchod.rz_vynimka_approved;
        return (
          <div style={{
            background: "var(--bg-surface)", border: `1px solid ${hasVyhradna ? "#059669" : noZmluva ? "#f59e0b" : "var(--border)"}`,
            borderRadius: "12px", padding: "14px 18px", marginBottom: "12px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>{hasVyhradna ? "📋" : noZmluva ? "⚠️" : "📋"}</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: hasVyhradna ? "#059669" : noZmluva ? "#b45309" : "var(--text-primary)" }}>
                  {hasVyhradna ? "Výhradná zmluva" + (expired ? " — EXPIROVANÁ" : "") :
                   hasNevyhradna ? "Nevýhradná zmluva" :
                   "Bez zmluvy"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                  {zmluvaInfo?.zmluva && zmluvaInfo.datum_podpisu ? `Podpísaná ${new Date(zmluvaInfo.datum_podpisu).toLocaleDateString("sk-SK")}` : ""}
                  {zmluvaInfo?.zmluva_do ? ` · platná do ${new Date(zmluvaInfo.zmluva_do).toLocaleDateString("sk-SK")}` : ""}
                  {noZmluva ? "Na podpis RZ je potrebná výhradná zmluva" : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {noZmluva && !approved && (
                <a href={`/naber?klient_id=${klient.id}`} style={{
                  padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  background: "#374151", color: "#fff", textDecoration: "none",
                }}>
                  + Podpísať zmluvu
                </a>
              )}
              {noZmluva && approved && (
                <span style={{ padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600, background: "#d1fae5", color: "#065f46" }}>
                  ✓ Výnimka schválená manažérom
                </span>
              )}
              {noZmluva && poziadana && !approved && (
                <span style={{ padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600, background: "#fef3c7", color: "#92400e" }}>
                  ⏳ Výnimka čaká na schválenie
                </span>
              )}
              {/* Admin/manažér môže schváliť */}
              {noZmluva && poziadana && !approved && (
                <button onClick={() => schvalitVynimku(obchod.id)} style={{
                  padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
                  background: "#059669", color: "#fff", border: "none", cursor: "pointer",
                }}>
                  Schváliť výnimku
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── RZ Gate modal ────────────────────────────────────────────────── */}
      {rzGate && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{
            background: "var(--bg-surface)", borderRadius: "16px", padding: "28px",
            maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
            <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
              Rezervačná zmluva vyžaduje výhradnú zmluvu
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.5 }}>
              Pred podpisom rezervačnej zmluvy musí byť podpísaná výhradná sprostredkovateľská zmluva.
              Môžeš požiadať manažéra pobočky o výnimku — ten ju musí schváliť v systéme.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a href={`/naber?klient_id=${klient.id}`} style={{
                padding: "11px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                background: "#374151", color: "#fff", textDecoration: "none", textAlign: "center",
              }}>
                📋 Podpísať výhradnú zmluvu teraz
              </a>
              {!obchody.find(o => o.id === rzGate.obchodId)?.rz_vynimka_poziadana ? (
                <button onClick={() => poziadatVynimku(rzGate.obchodId)} disabled={vynimkaSending} style={{
                  padding: "11px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                  background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", cursor: "pointer",
                }}>
                  {vynimkaSending ? "Odosielam…" : "📨 Požiadať manažéra o výnimku"}
                </button>
              ) : (
                <div style={{ padding: "11px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, background: "#fef3c7", color: "#92400e", textAlign: "center" }}>
                  ⏳ Žiadosť o výnimku bola odoslaná
                </div>
              )}
              <button onClick={() => setRzGate(null)} style={{
                padding: "9px 16px", borderRadius: "10px", fontSize: "13px",
                background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer",
              }}>
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4 sekcie v gride ────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "12px",
        marginBottom: "16px",
      }}>
        {["dokument", "aml", "akcia", "termin"].map(k => (
          <ObchodSekcia
            key={k}
            kategoria={k}
            ulohy={byKat(k)}
            obchodId={obchod.id}
            onToggle={(ulohaId, done) => toggleUloha(obchod.id, ulohaId, done)}
            onDriveEdit={(ulohaId, initial) => setDriveModal({ ulohaId, initial })}
          />
        ))}
      </div>

      {/* ── Poznámky k obchodu ──────────────────────────────────────────── */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "14px", padding: "18px",
      }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px" }}>
          📝 Poznámky k obchodu
        </div>
        <textarea
          value={obchod.poznamky ?? ""}
          onChange={e => handleNotesChange(obchod.id, e.target.value)}
          placeholder="Voľné poznámky — ukladajú sa automaticky..."
          rows={4}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: "8px",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            color: "var(--text-primary)", fontSize: "13px",
            resize: "vertical", lineHeight: 1.5,
          }}
        />
      </div>

      {/* ── Modály ──────────────────────────────────────────────────────── */}
      {showNovyModal && (
        <NovyObchodModal
          klientId={klient.id}
          onCreated={o => {
            setObchody(prev => [o, ...prev]);
            setActiveObchodIdx(0);
            setShowNovyModal(false);
          }}
          onClose={() => setShowNovyModal(false)}
        />
      )}

      {driveModal && (
        <DriveModal
          ulohaId={driveModal.ulohaId}
          obchodId={obchod.id}
          initial={driveModal.initial}
          onSaved={saveDriveLink}
          onClose={() => setDriveModal(null)}
        />
      )}
    </>
  );
}
