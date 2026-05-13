"use client";

import { useState, useEffect } from "react";
import SmsSignButton from "@/components/SmsSignButton";

type Majitel = { meno: string; datum_narodenia: string; rc: string; bydlisko: string; email: string; telefon: string };
type Stavba = { druh: string; supisne_cislo: string; cislo_bytu: string; lv_cislo: string; podiel: string };
type Pozemok = { cislo_parcely: string; vymera: string; druh: string; lv_cislo: string; podiel: string };

type ZvsData = {
  id?: string;
  majitelia: Majitel[];
  okres: string;
  obec: string;
  kat_uzemie: string;
  stavby: Stavba[];
  pozemky: Pozemok[];
  pozadovana_cena: string;
  moznost_znizenia_dni: string;
  suma_znizenia: string;
  provizna_text: string;
  provizna_slovom: string;
  dodatocna_provizna: string;
  trvanie_mesiacov: string;
  predlzenie_mesiacov: string;
  datum_zacatia: string;
  zastupena_meno: string;
  pocet_rovnopisov: string;
  kluče_ks: string;
  kluče_poznamka: string;
  podpis_data?: string | null;
  podpisane_at?: string | null;
};

const EMPTY_MAJITEL: Majitel = { meno: "", datum_narodenia: "", rc: "", bydlisko: "", email: "", telefon: "" };
const EMPTY_STAVBA: Stavba = { druh: "Byt", supisne_cislo: "", cislo_bytu: "", lv_cislo: "", podiel: "1/1" };
const EMPTY_POZEMOK: Pozemok = { cislo_parcely: "", vymera: "", druh: "", lv_cislo: "", podiel: "1/1" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initFromLv(
  lvData: Record<string, unknown> | null | undefined,
  naber: Record<string, unknown> | null | undefined,
  klient: Record<string, unknown> | null | undefined,
): Partial<ZvsData> {
  const lv = lvData || {};
  const majiteliaLv = (lv.majitelia as Array<{ meno?: string; podiel?: string; datum_narodenia?: string; adresa?: string }> | undefined) || [];
  const pozemkyLv = (lv.pozemky as Array<{ cislo_parcely?: string; druh?: string; vymera?: number }> | undefined) || [];

  const majitelia: Majitel[] = majiteliaLv.length
    ? majiteliaLv.map((m, i) => ({
        meno: m.meno || (i === 0 ? String(klient?.meno || "") : ""),
        datum_narodenia: m.datum_narodenia || "",
        rc: "",
        bydlisko: m.adresa || (i === 0 ? String(klient?.lokalita || "") : ""),
        email: i === 0 ? String(klient?.email || "") : "",
        telefon: i === 0 ? String(klient?.telefon || "") : "",
      }))
    : [{
        meno: String(klient?.meno || ""),
        datum_narodenia: "",
        rc: "",
        bydlisko: String(klient?.lokalita || ""),
        email: String(klient?.email || ""),
        telefon: String(klient?.telefon || ""),
      }];

  const stavby: Stavba[] = [{
    druh: String(lv.typ || naber?.typ_nehnutelnosti || "Byt"),
    supisne_cislo: String(lv.supisne_cislo || naber?.supisne_cislo || ""),
    cislo_bytu: String(lv.cislo_bytu || naber?.byt_cislo || ""),
    lv_cislo: String((naber?.oznacenie as Record<string, unknown> | undefined)?.list_vlastnictva || ""),
    podiel: majiteliaLv[0]?.podiel || "1/1",
  }];

  const pozemky: Pozemok[] = pozemkyLv.map(p => ({
    cislo_parcely: p.cislo_parcely || "",
    vymera: p.vymera ? String(p.vymera) : "",
    druh: p.druh || "",
    lv_cislo: String((naber?.oznacenie as Record<string, unknown> | undefined)?.list_vlastnictva || ""),
    podiel: "1/1",
  }));

  return {
    majitelia,
    okres: String(lv.okres || naber?.okres || ""),
    obec: String(lv.obec || naber?.obec || ""),
    kat_uzemie: String(lv.katastralneUzemie || naber?.kat_uzemie || ""),
    stavby,
    pozemky,
    pozadovana_cena: String(naber?.predajna_cena || ""),
    provizna_text: String(naber?.provizia || ""),
    zastupena_meno: String(naber?.makler || ""),
    datum_zacatia: today(),
    trvanie_mesiacov: "6",
    predlzenie_mesiacov: "3",
    pocet_rovnopisov: "2",
  };
}

const INP: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg-surface)",
  color: "var(--text-primary)", fontSize: "13px", boxSizing: "border-box",
};
const LBL: React.CSSProperties = { fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, marginBottom: "3px", display: "block" };
const GRID2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };
const GRID3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" };
const SEC: React.CSSProperties = { marginBottom: "18px" };
const SECTITLE: React.CSSProperties = { fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid var(--border)" };

export default function VyhradnaZmluvaModal({
  open,
  onClose,
  naberId,
  klientId,
  klientEmail,
  userId,
  lvData,
  naberData,
  klientData,
}: {
  open: boolean;
  onClose: () => void;
  naberId?: string | null;
  klientId?: string | null;
  klientEmail?: string;
  userId?: string;
  lvData?: Record<string, unknown> | null;
  naberData?: Record<string, unknown> | null;
  klientData?: Record<string, unknown> | null;
}) {
  const [tab, setTab] = useState<"zaujemcovia" | "nehnutelnost" | "podmienky">("zaujemcovia");
  const [data, setData] = useState<ZvsData>(() => ({
    majitelia: [{ ...EMPTY_MAJITEL }],
    okres: "", obec: "", kat_uzemie: "",
    stavby: [{ ...EMPTY_STAVBA }],
    pozemky: [],
    pozadovana_cena: "", moznost_znizenia_dni: "", suma_znizenia: "",
    provizna_text: "", provizna_slovom: "", dodatocna_provizna: "",
    trvanie_mesiacov: "6", predlzenie_mesiacov: "3",
    datum_zacatia: today(), zastupena_meno: "",
    pocet_rovnopisov: "2", kluče_ks: "", kluče_poznamka: "",
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [znizenieOpen, setZnizenieOpen] = useState(false);

  // Predvyplň z LV + náberák + klient pri otvorení
  useEffect(() => {
    if (!open) return;
    const prefill = initFromLv(lvData, naberData, klientData);
    setData(prev => ({ ...prev, ...prefill }));
    setZnizenieOpen(false);
    setTab("zaujemcovia");
    setErr("");
  }, [open, lvData, naberData, klientData]);

  // Načítaj existujúcu zmluvu ak existuje
  useEffect(() => {
    if (!open) return;
    const src = naberId ? `naber_id=${naberId}` : klientId ? `klient_id=${klientId}` : null;
    if (!src) return;
    fetch(`/api/vyhradna-zmluva?${src}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(existing => {
        if (!existing || Array.isArray(existing) && !existing[0]) return;
        const z = Array.isArray(existing) ? existing[0] : existing;
        if (!z?.id) return;
        setData(prev => ({
          ...prev,
          ...z,
          majitelia: z.majitelia?.length ? z.majitelia : prev.majitelia,
          stavby: z.stavby?.length ? z.stavby : prev.stavby,
          pozemky: z.pozemky || prev.pozemky,
          trvanie_mesiacov: String(z.trvanie_mesiacov || 6),
          predlzenie_mesiacov: String(z.predlzenie_mesiacov || 3),
          pocet_rovnopisov: String(z.pocet_rovnopisov || 2),
          pozadovana_cena: z.pozadovana_cena ? String(z.pozadovana_cena) : prev.pozadovana_cena,
          datum_zacatia: z.datum_zacatia || prev.datum_zacatia,
        }));
        setZnizenieOpen(!!(z.moznost_znizenia_dni || z.suma_znizenia));
      })
      .catch(() => {});
  }, [open, naberId, klientId]);

  function setField(key: keyof ZvsData, val: string) {
    setData(prev => ({ ...prev, [key]: val }));
  }

  function setMajitel(i: number, key: keyof Majitel, val: string) {
    setData(prev => {
      const m = [...prev.majitelia];
      m[i] = { ...m[i], [key]: val };
      return { ...prev, majitelia: m };
    });
  }

  function setStavba(i: number, key: keyof Stavba, val: string) {
    setData(prev => {
      const s = [...prev.stavby];
      s[i] = { ...s[i], [key]: val };
      return { ...prev, stavby: s };
    });
  }

  function setPozemok(i: number, key: keyof Pozemok, val: string) {
    setData(prev => {
      const p = [...prev.pozemky];
      p[i] = { ...p[i], [key]: val };
      return { ...prev, pozemky: p };
    });
  }

  async function saveZmluva(): Promise<string | null> {
    setSaving(true); setErr("");
    try {
      const body = {
        ...data,
        id: data.id || undefined,
        klient_id: klientId || undefined,
        naber_id: naberId || undefined,
        pozadovana_cena: data.pozadovana_cena ? Number(data.pozadovana_cena) : null,
        moznost_znizenia_dni: data.moznost_znizenia_dni ? Number(data.moznost_znizenia_dni) : null,
        suma_znizenia: data.suma_znizenia ? Number(data.suma_znizenia) : null,
        provizna_suma: null,
        trvanie_mesiacov: Number(data.trvanie_mesiacov) || 6,
        predlzenie_mesiacov: Number(data.predlzenie_mesiacov) || 3,
        pocet_rovnopisov: Number(data.pocet_rovnopisov) || 2,
        kluče_ks: data.kluče_ks ? Number(data.kluče_ks) : null,
      };
      const method = data.id ? "PATCH" : "POST";
      const r = await fetch("/api/vyhradna-zmluva", {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const saved = await r.json();
      setData(prev => ({ ...prev, id: saved.id }));
      return saved.id as string;
    } catch (e) {
      setErr((e as Error).message.slice(0, 200));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    const id = data.id || (await saveZmluva());
    if (!id) return;
    const r = await fetch("/api/vyhradna-zmluva/pdf", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) { setErr("Chyba PDF"); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vyhradna-zmluva.pdf"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  const isPodpisana = !!data.podpisane_at;
  const tabStyle = (t: typeof tab): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", border: "none",
    background: tab === t ? "var(--accent)" : "transparent",
    color: tab === t ? "#fff" : "var(--text-muted)",
    transition: "all 0.15s",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
      <div style={{ background: "var(--bg-surface)", borderRadius: "16px", width: "100%", maxWidth: "760px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)" }}>Výhradná zmluva o sprostredkovaní</div>
              {isPodpisana && (
                <div style={{ fontSize: "12px", color: "#059669", marginTop: "3px" }}>
                  ✓ Podpísaná {new Date(data.podpisane_at!).toLocaleDateString("sk")}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>×</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", marginTop: "12px", background: "var(--bg-elevated)", borderRadius: "10px", padding: "4px" }}>
            <button style={tabStyle("zaujemcovia")} onClick={() => setTab("zaujemcovia")}>Záujemcovia</button>
            <button style={tabStyle("nehnutelnost")} onClick={() => setTab("nehnutelnost")}>Nehnuteľnosť</button>
            <button style={tabStyle("podmienky")} onClick={() => setTab("podmienky")}>Podmienky</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>

          {/* ── TAB: ZÁUJEMCOVIA ── */}
          {tab === "zaujemcovia" && (
            <div>
              {data.majitelia.map((m, i) => (
                <div key={i} style={{ ...SEC, background: "var(--bg-elevated)", borderRadius: "12px", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={SECTITLE}>Záujemca {data.majitelia.length > 1 ? i + 1 : ""}</div>
                    {data.majitelia.length > 1 && (
                      <button onClick={() => setData(prev => ({ ...prev, majitelia: prev.majitelia.filter((_, j) => j !== i) }))}
                        style={{ background: "none", border: "none", color: "#ef4444", fontSize: "12px", cursor: "pointer" }}>
                        Odstrániť
                      </button>
                    )}
                  </div>
                  <div style={GRID2}>
                    <div><label style={LBL}>Meno a priezvisko *</label><input style={INP} value={m.meno} onChange={e => setMajitel(i, "meno", e.target.value)} /></div>
                    <div><label style={LBL}>Dátum narodenia</label><input style={INP} value={m.datum_narodenia} onChange={e => setMajitel(i, "datum_narodenia", e.target.value)} placeholder="DD.MM.RRRR" /></div>
                    <div><label style={LBL}>Rodné číslo</label><input style={INP} value={m.rc} onChange={e => setMajitel(i, "rc", e.target.value)} /></div>
                    <div><label style={LBL}>Trvalý pobyt</label><input style={INP} value={m.bydlisko} onChange={e => setMajitel(i, "bydlisko", e.target.value)} /></div>
                    <div><label style={LBL}>Email</label><input style={INP} type="email" value={m.email} onChange={e => setMajitel(i, "email", e.target.value)} /></div>
                    <div><label style={LBL}>Telefón</label><input style={INP} value={m.telefon} onChange={e => setMajitel(i, "telefon", e.target.value)} /></div>
                  </div>
                </div>
              ))}
              {data.majitelia.length < 3 && (
                <button onClick={() => setData(prev => ({ ...prev, majitelia: [...prev.majitelia, { ...EMPTY_MAJITEL }] }))}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer", width: "100%", marginTop: "4px" }}>
                  + Pridať záujemcu
                </button>
              )}
            </div>
          )}

          {/* ── TAB: NEHNUTEĽNOSŤ ── */}
          {tab === "nehnutelnost" && (
            <div>
              <div style={SEC}>
                <div style={SECTITLE}>Lokalita</div>
                <div style={GRID3}>
                  <div><label style={LBL}>Okres</label><input style={INP} value={data.okres} onChange={e => setField("okres", e.target.value)} /></div>
                  <div><label style={LBL}>Obec</label><input style={INP} value={data.obec} onChange={e => setField("obec", e.target.value)} /></div>
                  <div><label style={LBL}>Katastrálne územie</label><input style={INP} value={data.kat_uzemie} onChange={e => setField("kat_uzemie", e.target.value)} /></div>
                </div>
              </div>

              <div style={SEC}>
                <div style={SECTITLE}>Stavby</div>
                {data.stavby.map((s, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: "8px", marginBottom: "8px", alignItems: "end" }}>
                    <div><label style={LBL}>Druh</label><input style={INP} value={s.druh} onChange={e => setStavba(i, "druh", e.target.value)} /></div>
                    <div><label style={LBL}>Súpisné č.</label><input style={INP} value={s.supisne_cislo} onChange={e => setStavba(i, "supisne_cislo", e.target.value)} /></div>
                    <div><label style={LBL}>Byt</label><input style={INP} value={s.cislo_bytu} onChange={e => setStavba(i, "cislo_bytu", e.target.value)} /></div>
                    <div><label style={LBL}>LV č.</label><input style={INP} value={s.lv_cislo} onChange={e => setStavba(i, "lv_cislo", e.target.value)} /></div>
                    <div><label style={LBL}>Podiel</label><input style={INP} value={s.podiel} onChange={e => setStavba(i, "podiel", e.target.value)} /></div>
                    {data.stavby.length > 1 && <button onClick={() => setData(prev => ({ ...prev, stavby: prev.stavby.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", paddingBottom: "8px" }}>×</button>}
                  </div>
                ))}
                <button onClick={() => setData(prev => ({ ...prev, stavby: [...prev.stavby, { ...EMPTY_STAVBA }] }))}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", fontSize: "11px", cursor: "pointer" }}>
                  + Stavba
                </button>
              </div>

              <div style={SEC}>
                <div style={SECTITLE}>Pozemky</div>
                {data.pozemky.map((p, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr 1fr auto", gap: "8px", marginBottom: "8px", alignItems: "end" }}>
                    <div><label style={LBL}>Parcela</label><input style={INP} value={p.cislo_parcely} onChange={e => setPozemok(i, "cislo_parcely", e.target.value)} /></div>
                    <div><label style={LBL}>Výmera (m²)</label><input style={INP} value={p.vymera} onChange={e => setPozemok(i, "vymera", e.target.value)} /></div>
                    <div><label style={LBL}>Druh pozemku</label><input style={INP} value={p.druh} onChange={e => setPozemok(i, "druh", e.target.value)} /></div>
                    <div><label style={LBL}>LV č.</label><input style={INP} value={p.lv_cislo} onChange={e => setPozemok(i, "lv_cislo", e.target.value)} /></div>
                    <div><label style={LBL}>Podiel</label><input style={INP} value={p.podiel} onChange={e => setPozemok(i, "podiel", e.target.value)} /></div>
                    <button onClick={() => setData(prev => ({ ...prev, pozemky: prev.pozemky.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", paddingBottom: "8px" }}>×</button>
                  </div>
                ))}
                <button onClick={() => setData(prev => ({ ...prev, pozemky: [...prev.pozemky, { ...EMPTY_POZEMOK }] }))}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", fontSize: "11px", cursor: "pointer" }}>
                  + Pozemok
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: PODMIENKY ── */}
          {tab === "podmienky" && (
            <div>
              <div style={SEC}>
                <div style={SECTITLE}>Požadovaná cena</div>
                <div style={GRID2}>
                  <div>
                    <label style={LBL}>Požadovaná cena (EUR)</label>
                    <input style={INP} type="number" value={data.pozadovana_cena} onChange={e => setField("pozadovana_cena", e.target.value)} placeholder="napr. 149900" />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <label style={{ ...LBL, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: "6px", marginBottom: 0 }}>
                      <input type="checkbox" checked={znizenieOpen} onChange={e => setZnizenieOpen(e.target.checked)} />
                      Možnosť zníženia ceny
                    </label>
                  </div>
                </div>
                {znizenieOpen && (
                  <div style={{ ...GRID2, marginTop: "10px" }}>
                    <div><label style={LBL}>Po X dňoch znížiť</label><input style={INP} type="number" value={data.moznost_znizenia_dni} onChange={e => setField("moznost_znizenia_dni", e.target.value)} placeholder="napr. 30" /></div>
                    <div><label style={LBL}>O sumu (EUR)</label><input style={INP} type="number" value={data.suma_znizenia} onChange={e => setField("suma_znizenia", e.target.value)} placeholder="napr. 5000" /></div>
                  </div>
                )}
              </div>

              <div style={SEC}>
                <div style={SECTITLE}>Odmena</div>
                <div style={GRID2}>
                  <div>
                    <label style={LBL}>Provízia (text do zmluvy)</label>
                    <input style={INP} value={data.provizna_text} onChange={e => setField("provizna_text", e.target.value)} placeholder="napr. 3 % alebo 4 500" />
                  </div>
                  <div>
                    <label style={LBL}>Slovom</label>
                    <input style={INP} value={data.provizna_slovom} onChange={e => setField("provizna_slovom", e.target.value)} placeholder="napr. tri percentá" />
                  </div>
                  <div>
                    <label style={LBL}>Dodatočná provízia (% z rozdielu)</label>
                    <input style={INP} value={data.dodatocna_provizna} onChange={e => setField("dodatocna_provizna", e.target.value)} placeholder="napr. 50 %" />
                  </div>
                </div>
              </div>

              <div style={SEC}>
                <div style={SECTITLE}>Trvanie zmluvy</div>
                <div style={GRID3}>
                  <div>
                    <label style={LBL}>Trvanie (mesiacov)</label>
                    <input style={INP} type="number" value={data.trvanie_mesiacov} onChange={e => setField("trvanie_mesiacov", e.target.value)} />
                  </div>
                  <div>
                    <label style={LBL}>Predĺženie (mesiacov)</label>
                    <input style={INP} type="number" value={data.predlzenie_mesiacov} onChange={e => setField("predlzenie_mesiacov", e.target.value)} />
                  </div>
                  <div>
                    <label style={LBL}>Dátum začatia</label>
                    <input style={INP} type="date" value={data.datum_zacatia} onChange={e => setField("datum_zacatia", e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={SEC}>
                <div style={SECTITLE}>Ostatné</div>
                <div style={GRID2}>
                  <div>
                    <label style={LBL}>Zastúpená (maklér)</label>
                    <input style={INP} value={data.zastupena_meno} onChange={e => setField("zastupena_meno", e.target.value)} placeholder="Meno makléra" />
                  </div>
                  <div>
                    <label style={LBL}>Počet rovnopisov</label>
                    <input style={INP} type="number" value={data.pocet_rovnopisov} onChange={e => setField("pocet_rovnopisov", e.target.value)} />
                  </div>
                  <div>
                    <label style={LBL}>Počet kľúčov (ks)</label>
                    <input style={INP} type="number" value={data.kluče_ks} onChange={e => setField("kluče_ks", e.target.value)} />
                  </div>
                  <div>
                    <label style={LBL}>Poznámka ku kľúčom</label>
                    <input style={INP} value={data.kluče_poznamka} onChange={e => setField("kluče_poznamka", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {err && <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#FEF2F2", color: "#DC2626", fontSize: "12px", marginTop: "8px" }}>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleDownload}
            disabled={saving}
            style={{ padding: "9px 16px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            {saving ? "Ukladám..." : "📄 Stiahnuť PDF"}
          </button>

          {!isPodpisana && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={saveZmluva}
                disabled={saving}
                style={{ padding: "9px 16px", borderRadius: "9px", border: "none", background: "#374151", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                {saving ? "Ukladám..." : "Uložiť"}
              </button>
              {data.id && (
                <SmsSignButton
                  entityType="vyhradna_zmluva"
                  entityId={data.id}
                  defaultEmail={data.majitelia[0]?.email || klientEmail || ""}
                  userId={userId}
                  onSigned={() => setData(prev => ({ ...prev, podpisane_at: new Date().toISOString() }))}
                  buttonStyle={{
                    padding: "9px 16px", borderRadius: "9px", border: "none",
                    background: "#1d4ed8", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  }}
                  buttonLabel="📧 Podpísať — klient nie je tu"
                />
              )}
            </div>
          )}

          {isPodpisana && (
            <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>✓ Zmluva je podpísaná</span>
          )}

          <button onClick={onClose} style={{ marginLeft: "auto", padding: "9px 16px", borderRadius: "9px", border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer" }}>
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
}
