"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ── Typy ── */
interface Inzerat {
  id: string;
  portal: string;
  external_id: string;
  url: string;
  nazov: string;
  typ: string;
  lokalita: string;
  cena: number;
  plocha: number;
  izby: number;
  foto_url: string;
  predajca_meno: string;
  predajca_telefon: string;
  predajca_typ: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

interface Filter {
  id: string;
  nazov: string;
  portal: string;
  typ: string | null;
  lokalita: string | null;
  cena_od: number | null;
  cena_do: number | null;
  plocha_od: number | null;
  plocha_do: number | null;
  izby_od: number | null;
  izby_do: number | null;
  search_url: string | null;
  notify_email: boolean;
  notify_telegram: boolean;
  is_active: boolean;
}

/* ── Konštanty ── */
const PORTALS = [
  { value: "vsetky", label: "Všetky portály" },
  { value: "nehnutelnosti.sk", label: "Nehnuteľnosti.sk" },
  { value: "reality.sk", label: "Reality.sk" },
  { value: "topreality.sk", label: "TopReality.sk" },
];

const TYPY = [
  { value: "", label: "Všetky typy" },
  { value: "byt", label: "Byt" },
  { value: "dom", label: "Dom" },
  { value: "pozemok", label: "Pozemok" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Najnovšie" },
  { value: "price_asc", label: "Najlacnejšie" },
  { value: "price_desc", label: "Najdrahšie" },
];

const PORTAL_DOT: Record<string, string> = {
  "nehnutelnosti.sk": "bg-blue-500",
  "reality.sk": "bg-emerald-500",
  "topreality.sk": "bg-violet-500",
};

/* ── Helpers ── */
const fmt = (n: number) => n.toLocaleString("sk-SK");
const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "práve teraz";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hod`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "deň" : days < 5 ? "dni" : "dní"}`;
};

/* ── Hlavná stránka ── */
export default function MonitorPage() {
  const [inzeraty, setInzeraty] = useState<Inzerat[]>([]);
  const [filtre, setFiltre] = useState<Filter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inzeraty" | "filtre">("inzeraty");
  const [showNewFilter, setShowNewFilter] = useState(false);

  // View filters
  const [viewPortal, setViewPortal] = useState("");
  const [viewTyp, setViewTyp] = useState("");
  const [viewCenaOd, setViewCenaOd] = useState("");
  const [viewCenaDo, setViewCenaDo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [lenSukromni, setLenSukromni] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  const loadInzeraty = useCallback(async () => {
    const params = new URLSearchParams();
    if (viewPortal) params.set("portal", viewPortal);
    if (viewTyp) params.set("typ", viewTyp);
    if (viewCenaOd) params.set("cena_od", viewCenaOd);
    if (viewCenaDo) params.set("cena_do", viewCenaDo);
    params.set("limit", "100");

    const res = await fetch(`/api/monitor?${params.toString()}`);
    const data = await res.json();
    setInzeraty(data.inzeraty || []);
    setTotal(data.total || 0);
  }, [viewPortal, viewTyp, viewCenaOd, viewCenaDo]);

  const loadFiltre = async () => {
    const res = await fetch("/api/monitor/filtre");
    const data = await res.json();
    setFiltre(data.filtre || []);
  };

  useEffect(() => {
    Promise.all([loadInzeraty(), loadFiltre()]).finally(() => setLoading(false));
  }, [loadInzeraty]);

  // Derived data
  const today = new Date().toISOString().split("T")[0];
  const noveDnes = inzeraty.filter(i => i.first_seen_at?.startsWith(today)).length;
  const sukromniCount = inzeraty.filter(i => i.predajca_typ === "sukromny").length;
  const aktivneFiltre = filtre.filter(f => f.is_active).length;

  // Client-side filtering + sorting
  const filtered = inzeraty
    .filter(i => {
      if (lenSukromni && i.predajca_typ !== "sukromny") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(i.nazov || "").toLowerCase().includes(q) && !(i.lokalita || "").toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return (a.cena || 999999999) - (b.cena || 999999999);
      if (sort === "price_desc") return (b.cena || 0) - (a.cena || 0);
      return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
    });

  // New filter form
  const [nf, setNf] = useState({
    nazov: "", portal: "vsetky", typ: "", lokalita: "",
    cena_od: "", cena_do: "", search_url: "",
    notify_email: true, notify_telegram: false,
  });

  const createFilter = async () => {
    const res = await fetch("/api/monitor/filtre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...nf,
        cena_od: nf.cena_od ? parseFloat(nf.cena_od) : null,
        cena_do: nf.cena_do ? parseFloat(nf.cena_do) : null,
        typ: nf.typ || null, lokalita: nf.lokalita || null,
        search_url: nf.search_url || null,
      }),
    });
    if (res.ok) {
      setShowNewFilter(false);
      setNf({ nazov: "", portal: "vsetky", typ: "", lokalita: "", cena_od: "", cena_do: "", search_url: "", notify_email: true, notify_telegram: false });
      loadFiltre();
      showToast("Filter vytvorený");
    }
  };

  const toggleFilter = async (f: Filter) => {
    await fetch("/api/monitor/filtre", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, is_active: !f.is_active }),
    });
    loadFiltre();
  };

  const deleteFilter = async (id: string) => {
    if (!confirm("Vymazať filter?")) return;
    await fetch(`/api/monitor/filtre?id=${id}`, { method: "DELETE" });
    loadFiltre();
    showToast("Filter vymazaný");
  };

  // Scrape
  const [scraping, setScraping] = useState(false);
  const runScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch("/api/cron/scrape");
      const data = await res.json();
      showToast(data.message || "Scrape dokončený");
      loadInzeraty();
    } catch {
      showToast("Chyba pri scrapovaní");
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Načítavam monitor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Toast */}
      {toast && (
        <div style={{ animation: "slideIn 0.3s ease" }} className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Monitor</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sledovanie nových inzerátov na slovenských portáloch</p>
        </div>
        <button
          onClick={runScrape}
          disabled={scraping}
          className="bg-gray-900 text-white h-9 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-all flex items-center gap-2"
        >
          {scraping ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scrapujem...
            </>
          ) : (
            "Spustiť scrape"
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Celkom inzerátov", value: total, color: "text-gray-900" },
          { label: "Nové dnes", value: noveDnes, color: noveDnes > 0 ? "text-blue-600" : "text-gray-900" },
          { label: "Súkromní predajcovia", value: sukromniCount, color: sukromniCount > 0 ? "text-orange-600" : "text-gray-900" },
          { label: "Aktívne filtre", value: aktivneFiltre, color: "text-gray-900" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
            <div className={`text-2xl font-bold ${s.color} tracking-tight`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100">
        {(["inzeraty", "filtre"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t === "inzeraty" ? "Inzeráty" : `Filtre (${filtre.length})`}
          </button>
        ))}
      </div>

      {/* ═══ TAB: INZERÁTY ═══ */}
      {tab === "inzeraty" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Hľadať názov, lokalitu..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition-all placeholder:text-gray-300" />
            </div>
            <select value={viewPortal} onChange={e => { setViewPortal(e.target.value); setTimeout(loadInzeraty, 50); }}
              className="h-9 bg-gray-50 border-0 rounded-lg px-3 text-sm text-gray-600 focus:ring-2 focus:ring-gray-200">
              <option value="">Všetky portály</option>
              {PORTALS.filter(p => p.value !== "vsetky").map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={viewTyp} onChange={e => { setViewTyp(e.target.value); setTimeout(loadInzeraty, 50); }}
              className="h-9 bg-gray-50 border-0 rounded-lg px-3 text-sm text-gray-600 focus:ring-2 focus:ring-gray-200">
              {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="h-9 bg-gray-50 border-0 rounded-lg px-3 text-sm text-gray-600 focus:ring-2 focus:ring-gray-200">
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={() => setLenSukromni(!lenSukromni)}
              className={`h-9 px-3 rounded-lg text-sm font-medium transition-all ${lenSukromni ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
              Len súkromní
            </button>
          </div>

          <div className="text-xs text-gray-400 mb-3">
            {filtered.length === total ? `${total} inzerátov` : `${filtered.length} z ${total} inzerátov`}
          </div>

          {/* Listings */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-2xl">
                🏠
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {total === 0 ? "Zatiaľ žiadne inzeráty" : "Nič nenájdené"}
              </h3>
              <p className="text-sm text-gray-400 mb-4 text-center max-w-xs">
                {total === 0 ? "Pridaj filter a spusti prvý scrape — nové inzeráty sa tu objavia automaticky." : "Skús zmeniť filtre alebo vyhľadávanie."}
              </p>
              {total === 0 && (
                <button onClick={() => { setTab("filtre"); setShowNewFilter(true); }}
                  className="bg-gray-900 text-white h-9 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
                  Pridať filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(i => (
                <a key={i.id} href={i.url} target="_blank" rel="noopener noreferrer"
                  className="group bg-white rounded-xl border border-gray-100 p-3.5 flex gap-3.5 hover:shadow-md hover:border-gray-200 transition-all duration-200">
                  {/* Photo */}
                  <div className="w-28 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                    {i.foto_url ? (
                      <img src={i.foto_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-gray-200">🏠</div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">
                        {i.nazov || "Bez názvu"}
                      </h3>
                      <span className="text-base font-bold text-gray-900 whitespace-nowrap tabular-nums">
                        {i.cena ? `${fmt(i.cena)} €` : "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${PORTAL_DOT[i.portal] || "bg-gray-300"}`} />
                        {i.portal}
                      </span>
                      {i.typ && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-400">{i.typ}</span></>}
                      {i.plocha > 0 && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-500 font-medium">{i.plocha} m²</span></>}
                      {i.izby > 0 && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-500 font-medium">{i.izby}-izb</span></>}
                      {i.lokalita && <><span className="text-xs text-gray-300">·</span><span className="text-xs text-gray-400">{i.lokalita}</span></>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] text-gray-300">{timeAgo(i.first_seen_at)}</span>
                      {i.predajca_typ === "sukromny" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          Súkromný predajca
                        </span>
                      )}
                      {i.predajca_typ && i.predajca_typ !== "sukromny" && (
                        <span className="text-[11px] text-gray-300">Realitka</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: FILTRE ═══ */}
      {tab === "filtre" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">Filtre určujú, ktoré inzeráty sa sledujú.</p>
            <button onClick={() => setShowNewFilter(!showNewFilter)}
              className="bg-gray-900 text-white h-9 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
              + Nový filter
            </button>
          </div>

          {/* New filter form */}
          {showNewFilter && (
            <div style={{ animation: "slideDown 0.2s ease" }} className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Nový filter</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Názov</label>
                  <input type="text" placeholder='napr. "Byty Petržalka do 150k"' value={nf.nazov}
                    onChange={e => setNf({ ...nf, nazov: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Portál</label>
                  <select value={nf.portal} onChange={e => setNf({ ...nf, portal: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200">
                    {PORTALS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Typ</label>
                  <select value={nf.typ} onChange={e => setNf({ ...nf, typ: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200">
                    {TYPY.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Lokalita</label>
                  <input type="text" placeholder="Bratislava, Petržalka..." value={nf.lokalita}
                    onChange={e => setNf({ ...nf, lokalita: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Cena od</label>
                    <input type="number" placeholder="50 000" value={nf.cena_od}
                      onChange={e => setNf({ ...nf, cena_od: e.target.value })}
                      className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Cena do</label>
                    <input type="number" placeholder="200 000" value={nf.cena_do}
                      onChange={e => setNf({ ...nf, cena_do: e.target.value })}
                      className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Priamy URL na výsledky <span className="normal-case font-normal">(voliteľné)</span>
                  </label>
                  <input type="url" placeholder="https://www.nehnutelnosti.sk/byty/predaj/..." value={nf.search_url}
                    onChange={e => setNf({ ...nf, search_url: e.target.value })}
                    className="w-full h-10 bg-gray-50 border-0 rounded-lg px-3 text-sm focus:ring-2 focus:ring-gray-200 focus:bg-white transition placeholder:text-gray-300" />
                  <p className="text-[11px] text-gray-300 mt-1">Tip: nastav si filter na portáli a skopíruj URL z prehliadača</p>
                </div>
                <div className="sm:col-span-2 flex items-center gap-5 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={nf.notify_email} onChange={e => setNf({ ...nf, notify_email: e.target.checked })}
                      className="rounded border-gray-300 text-gray-900 focus:ring-gray-300" />
                    Email notifikácia
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={nf.notify_telegram} onChange={e => setNf({ ...nf, notify_telegram: e.target.checked })}
                      className="rounded border-gray-300 text-gray-900 focus:ring-gray-300" />
                    Telegram
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-5 pt-4 border-t border-gray-50">
                <button onClick={createFilter} disabled={!nf.nazov}
                  className="bg-gray-900 text-white h-9 px-5 rounded-lg text-sm font-medium disabled:opacity-30 hover:bg-gray-800 transition">
                  Vytvoriť filter
                </button>
                <button onClick={() => setShowNewFilter(false)}
                  className="h-9 px-4 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
                  Zrušiť
                </button>
              </div>
            </div>
          )}

          {/* Filter list */}
          <div className="space-y-2">
            {filtre.length === 0 && !showNewFilter && (
              <div className="flex flex-col items-center py-16">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-3 text-xl">🔍</div>
                <p className="text-sm text-gray-400">Zatiaľ žiadne filtre</p>
              </div>
            )}
            {filtre.map(f => (
              <div key={f.id}
                className={`bg-white rounded-xl border border-gray-100 p-4 transition-all ${!f.is_active ? "opacity-40" : "hover:shadow-sm"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{f.nazov}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium ${
                        f.portal === "vsetky" ? "bg-gray-100 text-gray-500"
                        : f.portal === "nehnutelnosti.sk" ? "bg-blue-50 text-blue-600"
                        : f.portal === "reality.sk" ? "bg-emerald-50 text-emerald-600"
                        : "bg-violet-50 text-violet-600"
                      }`}>{f.portal === "vsetky" ? "Všetky portály" : f.portal}</span>
                      {f.typ && <span className="text-[11px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">{f.typ}</span>}
                      {f.lokalita && <span className="text-[11px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">{f.lokalita}</span>}
                      {(f.cena_od || f.cena_do) && (
                        <span className="text-[11px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">
                          {f.cena_od ? `${fmt(Number(f.cena_od))} €` : "0 €"} – {f.cena_do ? `${fmt(Number(f.cena_do))} €` : "∞"}
                        </span>
                      )}
                      {f.notify_email && <span className="text-[11px] text-blue-500">Email</span>}
                      {f.notify_telegram && <span className="text-[11px] text-cyan-500">Telegram</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <button onClick={() => toggleFilter(f)}
                      className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition ${
                        f.is_active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      }`}>
                      {f.is_active ? "Aktívny" : "Pauznutý"}
                    </button>
                    <button onClick={() => deleteFilter(f.id)}
                      className="h-7 w-7 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
