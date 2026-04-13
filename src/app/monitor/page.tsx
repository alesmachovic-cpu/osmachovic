"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
  { value: "nehnutelnosti.sk", label: "Nehnuteľnosti.sk" },
  { value: "reality.sk", label: "Reality.sk" },
  { value: "topreality.sk", label: "TopReality.sk" },
  { value: "vsetky", label: "Všetky portály" },
];

const TYPY = [
  { value: "", label: "Všetky" },
  { value: "byt", label: "Byt" },
  { value: "dom", label: "Dom" },
  { value: "pozemok", label: "Pozemok" },
];

const PORTAL_COLORS: Record<string, string> = {
  "nehnutelnosti.sk": "bg-blue-100 text-blue-700",
  "reality.sk": "bg-green-100 text-green-700",
  "topreality.sk": "bg-purple-100 text-purple-700",
};

/* ── Hlavná stránka ── */
export default function MonitorPage() {
  const [inzeraty, setInzeraty] = useState<Inzerat[]>([]);
  const [filtre, setFiltre] = useState<Filter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inzeraty" | "filtre">("inzeraty");
  const [showNewFilter, setShowNewFilter] = useState(false);

  // Filter panel pre inzeráty
  const [viewPortal, setViewPortal] = useState("");
  const [viewTyp, setViewTyp] = useState("");
  const [viewCenaOd, setViewCenaOd] = useState("");
  const [viewCenaDo, setViewCenaDo] = useState("");

  const loadInzeraty = useCallback(async () => {
    const params = new URLSearchParams();
    if (viewPortal) params.set("portal", viewPortal);
    if (viewTyp) params.set("typ", viewTyp);
    if (viewCenaOd) params.set("cena_od", viewCenaOd);
    if (viewCenaDo) params.set("cena_do", viewCenaDo);

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

  // ─── Nový filter form ───
  const [nf, setNf] = useState({
    nazov: "",
    portal: "nehnutelnosti.sk",
    typ: "",
    lokalita: "",
    cena_od: "",
    cena_do: "",
    search_url: "",
    notify_email: true,
    notify_telegram: false,
  });

  const createFilter = async () => {
    const res = await fetch("/api/monitor/filtre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...nf,
        cena_od: nf.cena_od ? parseFloat(nf.cena_od) : null,
        cena_do: nf.cena_do ? parseFloat(nf.cena_do) : null,
        typ: nf.typ || null,
        lokalita: nf.lokalita || null,
        search_url: nf.search_url || null,
      }),
    });
    if (res.ok) {
      setShowNewFilter(false);
      setNf({ nazov: "", portal: "nehnutelnosti.sk", typ: "", lokalita: "", cena_od: "", cena_do: "", search_url: "", notify_email: true, notify_telegram: false });
      loadFiltre();
    }
  };

  const toggleFilter = async (filter: Filter) => {
    await fetch("/api/monitor/filtre", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: filter.id, is_active: !filter.is_active }),
    });
    loadFiltre();
  };

  const deleteFilter = async (id: string) => {
    if (!confirm("Vymazať filter?")) return;
    await fetch(`/api/monitor/filtre?id=${id}`, { method: "DELETE" });
    loadFiltre();
  };

  // Manuálny scrape trigger
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);

  const runScrape = async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch("/api/cron/scrape");
      const data = await res.json();
      setScrapeResult(data.message || "Hotovo");
      loadInzeraty();
    } catch {
      setScrapeResult("Chyba pri scrapovaní");
    } finally {
      setScraping(false);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Načítavam monitor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600">
              ← CRM
            </Link>
            <h1 className="text-xl font-bold text-gray-900">
              Realitný Monitor
            </h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {total} inzerátov
            </span>
          </div>
          <button
            onClick={runScrape}
            disabled={scraping}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {scraping ? "Scrapujem..." : "Spustiť scrape"}
          </button>
        </div>
        {scrapeResult && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <div className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
              {scrapeResult}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("inzeraty")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === "inzeraty"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Inzeráty
          </button>
          <button
            onClick={() => setTab("filtre")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === "filtre"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Filtre ({filtre.length})
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* ═══ TAB: INZERÁTY ═══ */}
        {tab === "inzeraty" && (
          <>
            {/* Filtre pre zobrazenie */}
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={viewPortal}
                onChange={(e) => { setViewPortal(e.target.value); setTimeout(loadInzeraty, 50); }}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Všetky portály</option>
                {PORTALS.filter((p) => p.value !== "vsetky").map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <select
                value={viewTyp}
                onChange={(e) => { setViewTyp(e.target.value); setTimeout(loadInzeraty, 50); }}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {TYPY.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Cena od"
                value={viewCenaOd}
                onChange={(e) => setViewCenaOd(e.target.value)}
                onBlur={loadInzeraty}
                className="border rounded-lg px-3 py-2 text-sm bg-white w-28"
              />
              <input
                type="number"
                placeholder="Cena do"
                value={viewCenaDo}
                onChange={(e) => setViewCenaDo(e.target.value)}
                onBlur={loadInzeraty}
                className="border rounded-lg px-3 py-2 text-sm bg-white w-28"
              />
            </div>

            {/* Zoznam inzerátov */}
            {inzeraty.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <div className="text-4xl mb-3">🏠</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Zatiaľ žiadne inzeráty
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  Vytvor filter a spusti prvý scrape
                </p>
                <button
                  onClick={() => { setTab("filtre"); setShowNewFilter(true); }}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  + Nový filter
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {inzeraty.map((i) => (
                  <a
                    key={i.id}
                    href={i.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white rounded-xl border p-4 flex gap-4 hover:shadow-md transition group"
                  >
                    {/* Foto */}
                    <div className="w-24 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {i.foto_url ? (
                        <img
                          src={i.foto_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">
                          🏠
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600">
                          {i.nazov || "Bez názvu"}
                        </h3>
                        <span className="text-lg font-bold text-gray-900 whitespace-nowrap">
                          {i.cena
                            ? `${i.cena.toLocaleString("sk-SK")} €`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            PORTAL_COLORS[i.portal] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {i.portal}
                        </span>
                        {i.typ && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                            {i.typ}
                          </span>
                        )}
                        {i.plocha > 0 && <span>{i.plocha} m²</span>}
                        {i.izby > 0 && <span>{i.izby}-izb</span>}
                        {i.lokalita && <span>{i.lokalita}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>Pridaný {timeAgo(i.first_seen_at)} dozadu</span>
                        {i.predajca_typ && (
                          <span className={i.predajca_typ === "sukromny" ? "text-orange-500 font-medium" : ""}>
                            {i.predajca_typ === "sukromny" ? "Súkromný" : "Realitka"}
                          </span>
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
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">
                Filtre definujú, čo monitor sleduje. Cron beží každých 15 minút.
              </p>
              <button
                onClick={() => setShowNewFilter(!showNewFilter)}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                + Nový filter
              </button>
            </div>

            {/* Formulár nového filtra */}
            {showNewFilter && (
              <div className="bg-white rounded-xl border p-5 mb-4">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Nový filter
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Názov filtra
                    </label>
                    <input
                      type="text"
                      placeholder='napr. "Byty Petržalka do 150k"'
                      value={nf.nazov}
                      onChange={(e) => setNf({ ...nf, nazov: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Portál
                    </label>
                    <select
                      value={nf.portal}
                      onChange={(e) => setNf({ ...nf, portal: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {PORTALS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Typ
                    </label>
                    <select
                      value={nf.typ}
                      onChange={(e) => setNf({ ...nf, typ: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {TYPY.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Lokalita
                    </label>
                    <input
                      type="text"
                      placeholder="napr. Bratislava, Petržalka"
                      value={nf.lokalita}
                      onChange={(e) =>
                        setNf({ ...nf, lokalita: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">
                        Cena od
                      </label>
                      <input
                        type="number"
                        placeholder="50 000"
                        value={nf.cena_od}
                        onChange={(e) =>
                          setNf({ ...nf, cena_od: e.target.value })
                        }
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">
                        Cena do
                      </label>
                      <input
                        type="number"
                        placeholder="200 000"
                        value={nf.cena_do}
                        onChange={(e) =>
                          setNf({ ...nf, cena_do: e.target.value })
                        }
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Priamy URL na výsledky (voliteľné)
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.nehnutelnosti.sk/byty/predaj/bratislava/..."
                      value={nf.search_url}
                      onChange={(e) =>
                        setNf({ ...nf, search_url: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Tip: nastav si filter na portáli a skopíruj URL
                    </p>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={nf.notify_email}
                        onChange={(e) =>
                          setNf({ ...nf, notify_email: e.target.checked })
                        }
                        className="rounded"
                      />
                      Email notifikácia
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={nf.notify_telegram}
                        onChange={(e) =>
                          setNf({ ...nf, notify_telegram: e.target.checked })
                        }
                        className="rounded"
                      />
                      Telegram notifikácia
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={createFilter}
                    disabled={!nf.nazov}
                    className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Vytvoriť
                  </button>
                  <button
                    onClick={() => setShowNewFilter(false)}
                    className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Zrušiť
                  </button>
                </div>
              </div>
            )}

            {/* Zoznam filtrov */}
            <div className="grid gap-3">
              {filtre.length === 0 && !showNewFilter && (
                <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
                  Zatiaľ žiadne filtre. Pridaj prvý filter a monitor začne
                  sledovať inzeráty.
                </div>
              )}
              {filtre.map((f) => (
                <div
                  key={f.id}
                  className={`bg-white rounded-xl border p-4 ${
                    f.is_active ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {f.nazov}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500">
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            PORTAL_COLORS[f.portal] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {f.portal}
                        </span>
                        {f.typ && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                            {f.typ}
                          </span>
                        )}
                        {f.lokalita && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                            {f.lokalita}
                          </span>
                        )}
                        {(f.cena_od || f.cena_do) && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                            {f.cena_od ? `${Number(f.cena_od).toLocaleString("sk-SK")} €` : "0 €"}
                            {" – "}
                            {f.cena_do ? `${Number(f.cena_do).toLocaleString("sk-SK")} €` : "∞"}
                          </span>
                        )}
                        {f.notify_email && (
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            Email
                          </span>
                        )}
                        {f.notify_telegram && (
                          <span className="bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full">
                            Telegram
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFilter(f)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          f.is_active
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {f.is_active ? "Aktívny" : "Pozastavený"}
                      </button>
                      <button
                        onClick={() => deleteFilter(f.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
