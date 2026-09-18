"use client";

import { useRef, useState } from "react";

interface Props {
  siteSlug: string;
  /** Vizuál: "makler" (Vianema šablóna) alebo "manazer" (čierno-mosadzná). */
  variant: "makler" | "manazer";
  valText: string;
  gdpr: string;
  doneText: string;
  doneMeta: string;
  preview?: boolean;
}

/**
 * Dvojkrokový formulár „Koľko stojí vaša nehnuteľnosť".
 * Odošle dopyt na /api/web/dopyt → uloží sa do CRM (weby_leads) a e‑mailom
 * ide maklérovi. V náhľade (preview) sa neodosiela.
 */
export default function LeadForm({ siteSlug, variant, valText, gdpr, doneText, doneMeta, preview }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [opt, setOpt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [v, setV] = useState({ typ: "", adresa: "", m2: "", stav: "", izby: "", meno: "", tel: "", kedy: "", gdpr: false, web: "" });
  const formRef = useRef<HTMLDivElement>(null);

  const solid = variant === "manazer" ? "btn btn-solid" : "btn btn-primary";
  const ghost = variant === "manazer" ? "btn" : "btn btn-ghost";

  function set<K extends keyof typeof v>(k: K, val: (typeof v)[K]) {
    setV(s => ({ ...s, [k]: val }));
    setErr(e => { const c = { ...e }; delete c[k as string]; return c; });
  }
  function show() {
    setOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }
  function next() {
    const e: Record<string, string> = {};
    if (!v.typ) e.typ = "Vyberte typ nehnuteľnosti.";
    if (!v.adresa.trim()) e.adresa = "Zadajte aspoň lokalitu.";
    if (!v.m2) e.m2 = "Zadajte výmeru v m².";
    setErr(e);
    if (Object.keys(e).length) return;
    setStep(2);
  }
  async function send() {
    const e: Record<string, string> = {};
    if (!v.meno.trim()) e.meno = "Zadajte meno.";
    if (!v.tel.trim()) e.tel = "Zadajte telefónne číslo.";
    if (!v.gdpr) e.gdpr = "Bez súhlasu vás nemôžeme kontaktovať.";
    setErr(e);
    if (Object.keys(e).length) return;
    if (preview) { setStep(3); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/dopyt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: siteSlug, ...v }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr({ send: d.error || "Odoslanie zlyhalo, skúste to prosím znova alebo zavolajte." });
        return;
      }
      setStep(3);
    } catch {
      setErr({ send: "Odoslanie zlyhalo, skúste to prosím znova alebo zavolajte." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="ocenenie">
      <div className="wrap">
        <div className="val">
          <div>
            <div className={"eyebrow" + (variant === "manazer" ? " brass" : "")}>Predávate?</div>
            <h2>Koľko stojí vaša nehnuteľnosť</h2>
            <p>{valText}</p>
          </div>
          <button className={solid} type="button" onClick={() => open ? setOpen(false) : show()}>Zistiť cenu</button>
        </div>
        {/* Skryté kotvy pre tlačidlá „Zistiť cenu" mimo formulára */}
        <button type="button" data-open-form hidden onClick={show} aria-hidden="true" tabIndex={-1} />
        {open && (
          <div className="form" ref={formRef}>
            <div className={variant === "manazer" ? "steps-bar" : "steps"}>
              <i className="on" /><i className={step >= 2 ? "on" : ""} />
            </div>
            {step === 1 && (
              <div>
                <div className="f"><label htmlFor="typ">Typ nehnuteľnosti</label>
                  <select id="typ" value={v.typ} onChange={e => set("typ", e.target.value)}>
                    <option value="">Vyberte</option><option>Byt</option><option>Dom</option><option>Pozemok</option>
                  </select>
                  {err.typ && <div className="err">{err.typ}</div>}
                </div>
                <div className="f"><label htmlFor="adresa">Adresa alebo lokalita</label>
                  <input id="adresa" type="text" placeholder="napr. Ružinov, Jégeho alej" value={v.adresa} onChange={e => set("adresa", e.target.value)} />
                  {err.adresa && <div className="err">{err.adresa}</div>}
                </div>
                <div className="f"><label htmlFor="m2">Výmera (m²)</label>
                  <input id="m2" type="number" placeholder="napr. 65" min={1} value={v.m2} onChange={e => set("m2", e.target.value)} />
                  {err.m2 && <div className="err">{err.m2}</div>}
                </div>
                <button className="opt-toggle" type="button" onClick={() => setOpt(o => !o)}>{opt ? "− skryť detaily" : "+ pridať detaily (voliteľné)"}</button>
                {opt && (
                  <div className="optional">
                    <div className="hint">Nepovinné — pomôže presnejšiemu rozboru. Zvyšok doladíme v telefonáte.</div>
                    <div className="f"><label htmlFor="stav">Stav nehnuteľnosti</label>
                      <select id="stav" value={v.stav} onChange={e => set("stav", e.target.value)}>
                        <option value="">Nevyplnené</option><option>Pôvodný stav</option><option>Čiastočná rekonštrukcia</option><option>Po kompletnej rekonštrukcii</option><option>Novostavba</option>
                      </select>
                    </div>
                    <div className="f"><label htmlFor="izby">Počet izieb</label>
                      <select id="izby" value={v.izby} onChange={e => set("izby", e.target.value)}>
                        <option value="">Nevyplnené</option><option>1</option><option>2</option><option>3</option><option>4 a viac</option>
                      </select>
                    </div>
                  </div>
                )}
                <button className={solid + " wide"} type="button" style={{ width: "100%", justifyContent: "center" }} onClick={next}>Pokračovať</button>
              </div>
            )}
            {step === 2 && (
              <div>
                <div className="f"><label htmlFor="meno">Meno</label>
                  <input id="meno" type="text" placeholder="Meno a priezvisko" value={v.meno} onChange={e => set("meno", e.target.value)} />
                  {err.meno && <div className="err">{err.meno}</div>}
                </div>
                <div className="f"><label htmlFor="tel">Telefón</label>
                  <input id="tel" type="tel" placeholder="+421 9xx xxx xxx" value={v.tel} onChange={e => set("tel", e.target.value)} />
                  {err.tel && <div className="err">{err.tel}</div>}
                </div>
                <div className="f"><label htmlFor="kedy">Kedy plánujete predávať? (voliteľné)</label>
                  <select id="kedy" value={v.kedy} onChange={e => set("kedy", e.target.value)}>
                    <option value="">Neviem ešte</option><option>Do 3 mesiacov</option><option>Neskôr</option><option>Len zisťujem cenu</option>
                  </select>
                </div>
                {/* honeypot */}
                <input type="text" name="web" value={v.web} onChange={e => set("web", e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
                <div className="f check">
                  <input id="gdpr" type="checkbox" checked={v.gdpr} onChange={e => set("gdpr", e.target.checked)} />
                  <label htmlFor="gdpr" style={{ fontWeight: 400, margin: 0 }}>{gdpr}</label>
                </div>
                {err.gdpr && <div className="err">{err.gdpr}</div>}
                {err.send && <div className="err">{err.send}</div>}
                <div className="actions" style={{ marginTop: 14 }}>
                  <button className={ghost} type="button" onClick={() => setStep(1)}>Späť</button>
                  <button className={solid} type="button" style={{ flex: 1, justifyContent: "center" }} disabled={busy} onClick={send}>{busy ? "Odosielam…" : "Odoslať dopyt"}</button>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="done">
                <span className="stars" style={{ fontSize: 26 }}>✓</span>
                <b>{doneText}</b>
                <div className="meta" style={{ marginTop: 6 }}>{doneMeta}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
