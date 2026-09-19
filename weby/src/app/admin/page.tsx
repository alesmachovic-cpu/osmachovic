"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PALETTES, SKIES, SECTIONS_MAKLER, SECTIONS_MANAZER, sectionOn, siteUrl, slugify, telFrom,
  type Listing, type MaklerData, type ManazerData, type Nastavenia, type PaletteId, type SectionId, type SiteData, type SkyId, type WebDopyt, type WebSite, type WebUser,
} from "@/lib/types";

type Site = WebSite & { canEdit: boolean };
type View = { kind: "site"; id: string } | { kind: "nastavenia" } | { kind: "dopyty" } | { kind: "pouzivatelia" } | { kind: "heslo" };

/* ─────────────────────────── API helpers ─────────────────────────── */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
  return d as T;
}

/** Zmenší obrázok v prehliadači (max 1600 px, JPEG) a nahrá ho do storage. */
async function uploadImage(file: File, siteId: string): Promise<string> {
  let blob: Blob = file;
  if (file.type !== "image/svg+xml") {
    blob = await new Promise<Blob>((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let { width: w, height: h } = img;
        const m = 1600;
        if (w > m) { h = Math.round(h * m / w); w = m; }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        c.toBlob(b => b ? res(b) : rej(new Error("Nepodarilo sa spracovať obrázok")), "image/jpeg", 0.85);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => rej(new Error("Nepodarilo sa načítať obrázok"));
      img.src = url;
    });
  }
  const fd = new FormData();
  fd.append("file", new File([blob], file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : ""), { type: blob.type }));
  fd.append("siteId", siteId);
  const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Upload zlyhal");
  return d.url as string;
}

/* ─────────────────────────── Kontrola ─────────────────────────── */
function issuesFor(d: SiteData): { errors: string[]; off: string[] } {
  const e: string[] = [];
  if (!d.name) e.push("Chýba meno.");
  if (!d.phone) e.push("Chýba telefón.");
  else if (!/^\+421\s?\d{3}\s?\d{3}\s?\d{3}$/.test(d.phone)) e.push("Telefón nie je vo formáte +421 9xx xxx xxx.");
  if (!d.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.push("E‑mail chýba alebo nie je platný.");
  if (d.typ === "makler") {
    if (!d.headline) e.push("Chýba hlavný titulok (hero).");
    if (sectionOn(d, "dovera") && d.trust.length !== 4) e.push(`Pás dôvery má mať presne 4 položky (má ${d.trust.length}).`);
    if (!d.portrait) e.push("Chýba portrét.");
  } else {
    if (sectionOn(d, "dovera") && d.facts.length !== 4) e.push("Fakty majú mať presne 4 položky.");
    if (sectionOn(d, "ako") && d.steps.length !== 3) e.push("„Ako pracujem“ má mať 3 kroky.");
  }
  if (sectionOn(d, "ponuky")) {
    if (!d.listings.length) e.push("Žiadne ponuky.");
    d.listings.forEach((l, i) => { if (!l.title || !l.price) e.push(`Ponuka ${i + 1}: chýba názov alebo cena.`); });
  }
  if (sectionOn(d, "referencie")) {
    d.reviews.forEach((r, i) => { if (!r.text) e.push(`Recenzia ${i + 1} je prázdna.`); });
    if (d.reviews.length !== 3) e.push(`Recenzie: šablóna je stavaná na 3 (má ${d.reviews.length}).`);
  }
  if (sectionOn(d, "videa") && d.videos.length !== 3) e.push(`Videá: 3 položky (má ${d.videos.length}).`);
  const list = d.typ === "makler" ? SECTIONS_MAKLER : SECTIONS_MANAZER;
  const off = list.filter(([k]) => !sectionOn(d, k)).map(([, l]) => l);
  return { errors: e, off };
}

/* ─────────────────────────── Generické polia ─────────────────────────── */
function Field({ label, value, onChange, hint, type = "text", placeholder, area }: { label: string; value: string; onChange: (v: string) => void; hint?: string; type?: string; placeholder?: string; area?: boolean }) {
  return (
    <div className="wa-f">
      <label>{label}</label>
      {area
        ? <textarea value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        : <input type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />}
      {hint && <div className="wa-hint">{hint}</div>}
    </div>
  );
}

function Tags({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [txt, setTxt] = useState("");
  const add = () => { const v = txt.trim(); if (v) { onChange([...(value || []), v]); setTxt(""); } };
  return (
    <div className="wa-f">
      <label>{label}</label>
      <div className="wa-tags">
        {(value || []).map((t, i) => (
          <span key={i} className="wa-tag">{t}<button type="button" title="Odstrániť" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button></span>
        ))}
        <input value={txt} placeholder="Napíš a stlač Enter" onChange={e => setTxt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } else if (e.key === "Backspace" && !txt && value?.length) onChange(value.slice(0, -1)); }}
          onBlur={add} />
      </div>
      <div className="wa-hint">{hint || "Enter pridá položku, × odstráni."}</div>
    </div>
  );
}

type Col<T> = { key: keyof T & string; label: string; full?: boolean; area?: boolean; placeholder?: string; photo?: boolean };
function Rows<T extends Record<string, string>>({ label, value, onChange, cols, blank, itemLabel, addLabel, hint, siteId }: {
  label: string; value: T[]; onChange: (v: T[]) => void; cols: Col<T>[]; blank: () => T; itemLabel: string; addLabel: string; hint?: string; siteId: string;
}) {
  const arr = value || [];
  const upd = (i: number, k: string, v: string) => onChange(arr.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const move = (i: number, d: number) => { const c = [...arr]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); onChange(c); };
  return (
    <div className="wa-f">
      <label>{label}</label>
      <div className="wa-rows">
        {arr.map((row, i) => (
          <div key={i} className="wa-rowcard">
            <div className="wa-rh">
              <span>{itemLabel} {i + 1}</span>
              <div className="wa-ops">
                <button type="button" title="Vyššie" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" title="Nižšie" disabled={i === arr.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" title="Duplikovať" onClick={() => onChange([...arr.slice(0, i + 1), { ...row }, ...arr.slice(i + 1)])}>⧉</button>
                <button type="button" title="Odstrániť" onClick={() => onChange(arr.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
            <div className="wa-grid">
              {cols.map(c => (
                <div key={c.key} className={c.full ? "full" : ""}>
                  <div className="wa-lbl">{c.label}</div>
                  {c.photo
                    ? <Photo value={row[c.key] || ""} onChange={v => upd(i, c.key, v)} siteId={siteId} compact />
                    : c.area
                      ? <textarea value={row[c.key] || ""} placeholder={c.placeholder} onChange={e => upd(i, c.key, e.target.value)} />
                      : <input value={row[c.key] || ""} placeholder={c.placeholder} onChange={e => upd(i, c.key, e.target.value)} />}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="wa-btn wa-btn-s" onClick={() => onChange([...arr, blank()])}>＋ {addLabel}</button>
      </div>
      {hint && <div className="wa-hint">{hint}</div>}
    </div>
  );
}

function Photo({ label, value, onChange, siteId, hint, compact }: { label?: string; value: string; onChange: (v: string) => void; siteId: string; hint?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inp = useRef<HTMLInputElement>(null);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr("");
    try { onChange(await uploadImage(f, siteId)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className={compact ? "" : "wa-f"}>
      {label && <label>{label}</label>}
      <div className="wa-photo">
        <div className="wa-thumb">{value ? <img src={value} alt="" /> : <span>bez fotky</span>}</div>
        <div className="wa-pin">
          <input value={value || ""} placeholder="URL fotky" onChange={e => onChange(e.target.value)} />
          <div className="wa-pops">
            <button type="button" className="wa-btn wa-btn-s" disabled={busy} onClick={() => inp.current?.click()}>{busy ? "Nahrávam…" : "Nahrať fotku"}</button>
            {value && <button type="button" className="wa-btn wa-btn-s wa-btn-d" onClick={() => onChange("")}>Odstrániť</button>}
            <input ref={inp} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
          </div>
          {err && <div className="wa-err">{err}</div>}
        </div>
      </div>
      {hint && <div className="wa-hint">{hint}</div>}
    </div>
  );
}

function Sections({ d, onChange }: { d: SiteData; onChange: (s: SiteData["sections"]) => void }) {
  const list = d.typ === "makler" ? SECTIONS_MAKLER : SECTIONS_MANAZER;
  return (
    <div className="wa-f">
      <label>Sekcie webu (menu)</label>
      <div className="wa-secs">
        {list.map(([k, l]) => {
          const on = sectionOn(d, k);
          return (
            <label key={k} className={"wa-sec" + (on ? " on" : "")}>
              <input type="checkbox" checked={on} onChange={e => onChange({ ...(d.sections || {}), [k]: e.target.checked })} />
              <span className="wa-sw" />{l}
            </label>
          );
        })}
      </div>
      <div className="wa-hint">Vypnutá sekcia sa na webe nezobrazí, zmizne z menu aj z tlačidiel, ktoré na ňu odkazujú. Obsah v admine ostáva uložený.</div>
    </div>
  );
}

const H2 = ({ children, off }: { children: React.ReactNode; off?: boolean }) => <h2 className="wa-h2">{children}{off && <span className="wa-offtag">vypnutá na webe</span>}</h2>;

const LISTING_COLS: Col<Listing>[] = [
  { key: "type", label: "Typ (štítok)", placeholder: "Byt / Dom / Pozemok / Prenájom" }, { key: "price", label: "Cena", placeholder: "289 990 €" },
  { key: "title", label: "Názov", full: true, placeholder: "2-izbový byt s parkovaním, Nivy" }, { key: "meta", label: "Doplnok (výmera, stav)", full: true, placeholder: "66 m² · moderný" },
  { key: "url", label: "Odkaz na ponuku (vianemareal.eu)", full: true }, { key: "photo", label: "Fotka", full: true, photo: true },
];
const SOLD_COLS = [
  { key: "type", label: "Čo sa predalo", placeholder: "2-izbový byt" }, { key: "loc", label: "Lokalita", placeholder: "Ružinov, Jégeho alej" },
  { key: "days", label: "Za koľko dní", placeholder: "14 dní" }, { key: "year", label: "Rok", placeholder: "2026" },
] as Col<{ type: string; loc: string; days: string; year: string }>[];
const REVIEW_COLS = [
  { key: "text", label: "Text recenzie (bez úvodzoviek)", full: true, area: true }, { key: "author", label: "Autor · zdroj", full: true, placeholder: "Jana K. · Google recenzia" },
] as Col<{ text: string; author: string }>[];
const PAIR_COLS = [{ key: "b", label: "Veľké (číslo/heslo)", placeholder: "2025" }, { key: "s", label: "Malé (vysvetlenie)", placeholder: "Obchodníčka roka Vianema" }] as Col<{ b: string; s: string }>[];
const STEP_COLS = [{ key: "n", label: "Číslo", placeholder: "01" }, { key: "h", label: "Nadpis" }, { key: "p", label: "Text", full: true, area: true }] as Col<{ n: string; h: string; p: string }>[];

/* ─────────────────────────── Editor webu ─────────────────────────── */
function SiteEditor({ site, isManager, accounts, onDraft, onMeta, onPublish, onDelete, onDuplicate, saveState }: {
  site: Site; isManager: boolean; accounts: Array<{ id: string; name: string }>;
  onDraft: (d: SiteData) => void; onMeta: (m: { slug?: string; domain?: string | null; user_id?: string | null }) => Promise<void>;
  onPublish: (unpublish?: boolean) => Promise<void>; onDelete: () => void; onDuplicate: () => void; saveState: string;
}) {
  const d = site.draft;
  const set = (patch: Partial<SiteData>) => onDraft({ ...d, ...patch } as SiteData);
  const [slug, setSlug] = useState(site.slug);
  const [domain, setDomain] = useState(site.domain || "");
  const [metaErr, setMetaErr] = useState("");
  const { errors, off } = issuesFor(d);
  const unpublished = !!site.published && JSON.stringify(site.published) !== JSON.stringify(d);
  const ro = !site.canEdit;

  return (
    <div className={"wa-editor" + (ro ? " wa-ro" : "")}>
      <h1>{d.name}</h1>
      <p className="wa-sub">{d.typ === "manazer" ? "Web manažéra pobočky · vlastná šablóna" : "Web makléra · šablóna Vianema"} · <span className="wa-save">{saveState}</span></p>

      <div className="wa-status">
        {site.published
          ? <span className="wa-pill ok">Publikovaný {new Date(site.published_at!).toLocaleDateString("sk-SK")}</span>
          : <span className="wa-pill warn">Nepublikovaný — verejná adresa zatiaľ nefunguje</span>}
        {unpublished && <span className="wa-pill warn">Nepublikované zmeny</span>}
        {site.published && <a className="wa-link" href={siteUrl(site)} target="_blank" rel="noreferrer">{site.domain ? site.domain : `/s/${site.slug}`} ↗</a>}
      </div>

      {!ro && (
        <div className="wa-actions">
          <button className="wa-btn wa-btn-p" onClick={() => { if (!errors.length || window.confirm("Kontrola hlási problémy (viď nižšie). Publikovať aj tak?")) onPublish(); }}>Publikovať web</button>
          {site.published && <button className="wa-btn" onClick={() => { if (window.confirm("Stiahnuť web z verejnosti? Adresa prestane fungovať, obsah ostane v admine.")) onPublish(true); }}>Stiahnuť z webu</button>}
          {isManager && d.typ === "makler" && <button className="wa-btn" onClick={onDuplicate}>Duplikovať</button>}
          {isManager && d.typ === "makler" && <button className="wa-btn wa-btn-d" onClick={onDelete}>Odstrániť web</button>}
        </div>
      )}
      {ro && <div className="wa-note">Tento web môžeš len prezerať.</div>}

      <div className={"wa-issues " + (errors.length ? "bad" : "good")}>
        <b>{errors.length ? `Kontrola: ${errors.length} ${errors.length === 1 ? "vec na doriešenie" : errors.length < 5 ? "veci na doriešenie" : "vecí na doriešenie"}` : "Kontrola: všetko v poriadku."}</b>
        {!!errors.length && <ul>{errors.map((s, i) => <li key={i}>{s}</li>)}</ul>}
        {!!off.length && <div className="wa-hint" style={{ marginTop: 6 }}>Vypnuté sekcie: {off.join(", ")}.</div>}
      </div>

      <Sections d={d} onChange={s => set({ sections: s })} />

      {isManager && (
        <>
          <H2>Doména a prístup</H2>
          <div className="wa-row2">
            <div className="wa-f">
              <label>Vlastná doména makléra</label>
              <input value={domain} placeholder="napr. silviahurova.sk" onChange={e => setDomain(e.target.value)} onBlur={async () => { const d = domain.trim().toLowerCase(); if (d !== (site.domain || "")) { try { setMetaErr(""); await onMeta({ domain: d || null }); } catch (e) { setMetaErr((e as Error).message); setDomain(site.domain || ""); } } }} />
              <div className="wa-hint">Doménu pridaj aj vo Vercel projekte (Settings → Domains) a nasmeruj DNS. Web sa potom zobrazí na koreni domény.</div>
            </div>
            <div className="wa-f">
              <label>Záložná adresa</label>
              <div className="wa-slug"><span>/s/</span><input value={slug} onChange={e => setSlug(e.target.value)} onBlur={async () => { if (slug !== site.slug) { try { setMetaErr(""); await onMeta({ slug }); setSlug(slugify(slug)); } catch (e) { setMetaErr((e as Error).message); setSlug(site.slug); } } }} /></div>
              <div className="wa-hint">Funguje na hlavnej doméne aj bez vlastnej domény.</div>
            </div>
          </div>
          {metaErr && <div className="wa-err" style={{ marginBottom: 10 }}>{metaErr}</div>}
          <div className="wa-f">
            <label>Maklér, ktorý si web spravuje sám</label>
            <select value={site.user_id || ""} onChange={e => onMeta({ user_id: e.target.value || null })}>
              <option value="">— nikto (spravuje len správca) —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="wa-hint">Po prihlásení na svojej doméne (/admin) vidí a upravuje len tento web a jeho dopyty. Účty sú v sekcii Používatelia.</div>
          </div>
        </>
      )}

      <H2>Identita a kontakt</H2>
      <div className="wa-row2">
        <Field label="Meno (s titulom)" value={d.name} onChange={v => set({ name: v })} />
        <Field label="Rola" value={d.role} onChange={v => set({ role: v })} placeholder="Realitná maklérka" />
      </div>
      <div className="wa-row2">
        <Field label="Telefón (zobrazený)" type="tel" value={d.phone} onChange={v => set({ phone: v })} placeholder="+421 9xx xxx xxx" hint={d.phone ? `Volanie: ${telFrom(d.phone)}` : undefined} />
        <Field label="E‑mail (sem chodia dopyty)" type="email" value={d.email} onChange={v => set({ email: v })} />
      </div>
      <div className="wa-row2">
        <Field label="Instagram (URL)" type="url" value={d.ig} onChange={v => set({ ig: v })} />
        <Field label="Google recenzie (URL)" type="url" value={d.googleUrl} onChange={v => set({ googleUrl: v })} placeholder="odkaz na hodnotenie v Google" />
      </div>
      <Field label="Odkaz „Všetky ponuky →“" type="url" value={d.listingsUrl} onChange={v => set({ listingsUrl: v })} placeholder="https://www.vianemareal.eu/makler/…" />
      <Photo label="Portrét (4:5)" value={d.portrait} onChange={v => set({ portrait: v })} siteId={site.id} />

      {d.typ === "makler" ? <MaklerFields d={d} set={set as (p: Partial<MaklerData>) => void} siteId={site.id} /> : <ManazerFields d={d} set={set as (p: Partial<ManazerData>) => void} siteId={site.id} />}
    </div>
  );
}

function MaklerFields({ d, set, siteId }: { d: MaklerData; set: (p: Partial<MaklerData>) => void; siteId: string }) {
  return (
    <>
      <H2>Vzhľad</H2>
      <div className="wa-f">
        <label>Farebná paleta</label>
        <div className="wa-pal">
          {(Object.keys(PALETTES) as PaletteId[]).map(k => (
            <label key={k} className={"wa-palopt" + (d.palette === k ? " on" : "")}>
              <input type="radio" name="pal" checked={d.palette === k} onChange={() => set({ palette: k })} />
              <span className="wa-dot" style={{ background: PALETTES[k].acc }} />{PALETTES[k].label}
            </label>
          ))}
        </div>
      </div>
      <div className="wa-f">
        <label>Panoráma (silueta mesta)</label>
        <select value={d.sky} onChange={e => set({ sky: e.target.value as SkyId })}>{(Object.keys(SKIES) as SkyId[]).map(k => <option key={k} value={k}>{SKIES[k]}</option>)}</select>
      </div>
      <Photo label="Hlavná fotka alebo záber (16:9, voliteľné)" value={d.hero} onChange={v => set({ hero: v })} siteId={siteId} hint="Ak je prázdne, web ukáže ilustrovanú panorámu vo farbách palety." />

      <H2>Hero</H2>
      <Field label="Hlavný titulok" value={d.headline} onChange={v => set({ headline: v })} hint="Jedna veta. Čo maklér robí inak." />
      <Field label="Podtitulok" value={d.sub} onChange={v => set({ sub: v })} area />

      <H2 off={!sectionOn(d, "dovera")}>Pás dôvery</H2>
      <Rows label={"Pás dôvery (4 položky)" + (sectionOn(d, "dovera") ? "" : " — sekcia vypnutá")} value={d.trust} onChange={v => set({ trust: v })} cols={PAIR_COLS} blank={() => ({ b: "", s: "" })} itemLabel="Položka" addLabel="Pridať položku" siteId={siteId} />

      <H2 off={!sectionOn(d, "omne")}>O mne</H2>
      <Field label="Odsek 1" value={d.bio1} onChange={v => set({ bio1: v })} area />
      <Field label="Odsek 2 (voliteľný)" value={d.bio2} onChange={v => set({ bio2: v })} area />
      <Tags label="Štítky pod textom" value={d.chips} onChange={v => set({ chips: v })} />

      <H2 off={!sectionOn(d, "ponuky")}>Ponuky</H2>
      <Rows label="Aktuálne ponuky" value={d.listings} onChange={v => set({ listings: v })} cols={LISTING_COLS} blank={() => ({ type: "Byt", title: "", price: "", meta: "", photo: "", url: "" })} itemLabel="Ponuka" addLabel="Pridať ponuku" siteId={siteId} hint="Šablóna zobrazuje po 3 v rade. Odkaz spraví z karty klikateľný link na vianemareal.eu." />

      <H2 off={!sectionOn(d, "predane")}>Predané</H2>
      <Rows label="Vybrané predané nehnuteľnosti" value={d.sold} onChange={v => set({ sold: v })} cols={SOLD_COLS} blank={() => ({ type: "", loc: "", days: "", year: "2026" })} itemLabel="Predaj" addLabel="Pridať predaj" siteId={siteId} />

      <H2 off={!sectionOn(d, "referencie") && !sectionOn(d, "videa")}>Referencie a videá</H2>
      <Rows label={"Google recenzie (3)" + (sectionOn(d, "referencie") ? "" : " — sekcia vypnutá")} value={d.reviews} onChange={v => set({ reviews: v })} cols={REVIEW_COLS} blank={() => ({ text: "", author: "" })} itemLabel="Recenzia" addLabel="Pridať recenziu" siteId={siteId} />
      <Tags label={"Názvy 3 videí (Reels)" + (sectionOn(d, "videa") ? "" : " — sekcia vypnutá")} value={d.videos} onChange={v => set({ videos: v })} hint="Zatiaľ len popisky placeholderov — 3 položky." />

      <H2 off={!sectionOn(d, "lokality") && !sectionOn(d, "tim")}>Lokality a tím</H2>
      <Tags label={"Lokality (prvé 3 sa ukážu na karte v tíme)" + (sectionOn(d, "lokality") ? "" : " — sekcia vypnutá")} value={d.areas} onChange={v => set({ areas: v })} />
      <div className="wa-f">
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={d.team !== false} onChange={e => set({ team: e.target.checked })} />Je súčasťou tímu pobočky Bratislava</label>
        <div className="wa-hint">Ak vypnuté: web nemá sekciu Tím, neodkazuje na manažéra a v pätičke použije vlastný text pobočky.</div>
      </div>
      <Field label="Vlastný text pobočky v pätičke (len mimo tímu)" value={d.branch} onChange={v => set({ branch: v })} placeholder="Vianema s.r.o. · Martin, Žilina, Vrútky a okolie" />
    </>
  );
}

function ManazerFields({ d, set, siteId }: { d: ManazerData; set: (p: Partial<ManazerData>) => void; siteId: string }) {
  return (
    <>
      <div className="wa-row2">
        <Field label="Instagram handle" value={d.igHandle} onChange={v => set({ igHandle: v })} placeholder="@alesmachovic" />
        <Field label="YouTube (URL)" type="url" value={d.yt} onChange={v => set({ yt: v })} />
      </div>
      <Field label="Adresa v pätičke" value={d.address} onChange={v => set({ address: v })} />
      <Photo label="Logo (SVG/PNG)" value={d.logo} onChange={v => set({ logo: v })} siteId={siteId} />

      <H2>Hero</H2>
      <Field label="Riadok nad titulkom" value={d.eyebrow} onChange={v => set({ eyebrow: v })} />
      <div className="wa-row2">
        <Field label="Titulok, 1. riadok" value={d.h1} onChange={v => set({ h1: v })} />
        <Field label="Titulok, 2. riadok (zvýraznený)" value={d.h1em} onChange={v => set({ h1em: v })} />
      </div>
      <Field label="Úvodný odsek" value={d.lede} onChange={v => set({ lede: v })} area />

      <H2 off={!sectionOn(d, "dovera")}>Fakty</H2>
      <Rows label={"Fakty (4)" + (sectionOn(d, "dovera") ? "" : " — sekcia vypnutá")} value={d.facts} onChange={v => set({ facts: v })} cols={PAIR_COLS} blank={() => ({ b: "", s: "" })} itemLabel="Fakt" addLabel="Pridať fakt" siteId={siteId} />

      <H2 off={!sectionOn(d, "ako")}>Ako pracujem</H2>
      <Field label="Nadpis sekcie" value={d.stepsTitle} onChange={v => set({ stepsTitle: v })} />
      <Rows label="Tri kroky" value={d.steps} onChange={v => set({ steps: v })} cols={STEP_COLS} blank={() => ({ n: "", h: "", p: "" })} itemLabel="Krok" addLabel="Pridať krok" siteId={siteId} />

      <H2 off={!sectionOn(d, "omne")}>O mne</H2>
      <Field label="Veľká veta" value={d.big} onChange={v => set({ big: v })} area />
      <Field label="Odsek 1" value={d.bio1} onChange={v => set({ bio1: v })} area />
      <Field label="Odsek 2" value={d.bio2} onChange={v => set({ bio2: v })} area />

      <H2 off={!sectionOn(d, "ponuky")}>Ponuky</H2>
      <Rows label="Aktuálne ponuky" value={d.listings} onChange={v => set({ listings: v })} cols={LISTING_COLS} blank={() => ({ type: "Byt", title: "", price: "", meta: "", photo: "", url: "" })} itemLabel="Ponuka" addLabel="Pridať ponuku" siteId={siteId} />

      <H2 off={!sectionOn(d, "predane")}>Predané</H2>
      <Rows label="Vybrané predané" value={d.sold} onChange={v => set({ sold: v })} cols={SOLD_COLS} blank={() => ({ type: "", loc: "", days: "", year: "2026" })} itemLabel="Predaj" addLabel="Pridať predaj" siteId={siteId} />
      <Field label="Poznámka pod tabuľkou" value={d.soldNote} onChange={v => set({ soldNote: v })} />

      <H2 off={!sectionOn(d, "referencie") && !sectionOn(d, "videa")}>Referencie a videá</H2>
      <Rows label={"Google recenzie (3)" + (sectionOn(d, "referencie") ? "" : " — sekcia vypnutá")} value={d.reviews} onChange={v => set({ reviews: v })} cols={REVIEW_COLS} blank={() => ({ text: "", author: "" })} itemLabel="Recenzia" addLabel="Pridať recenziu" siteId={siteId} />
      <Tags label={"Názvy 3 videí (Reels)" + (sectionOn(d, "videa") ? "" : " — sekcia vypnutá")} value={d.videos} onChange={v => set({ videos: v })} />

      <H2 off={!sectionOn(d, "ocenenie") && !sectionOn(d, "tim")}>Ocenenie a tím</H2>
      <Field label="Text pri výzve „Koľko stojí vaša nehnuteľnosť“" value={d.valText} onChange={v => set({ valText: v })} area />
      <Field label="Text po odoslaní dopytu" value={d.doneText} onChange={v => set({ doneText: v })} />
      <Field label="Nadpis boxu Tím" value={d.teamTitle} onChange={v => set({ teamTitle: v })} />
      <Field label="Text boxu Tím" value={d.teamText} onChange={v => set({ teamText: v })} area />
      <Tags label={"Lokality" + (sectionOn(d, "lokality") ? "" : " — sekcia vypnutá")} value={d.areas} onChange={v => set({ areas: v })} />
    </>
  );
}

/* ─────────────────────────── Nastavenia pobočky ─────────────────────────── */
function NastaveniaEditor({ value, sites, onSave, onReorder }: { value: Nastavenia; sites: Site[]; onSave: (n: Nastavenia) => Promise<void>; onReorder: (ids: string[]) => Promise<void> }) {
  const [n, setN] = useState(value);
  const [state, setState] = useState("");
  const set = (p: Partial<Nastavenia>) => setN(s => ({ ...s, ...p }));
  const makleri = sites.filter(s => s.typ === "makler");
  return (
    <div className="wa-editor">
      <h1>Pobočka a šablóna</h1>
      <p className="wa-sub">Spoločné texty, ktoré sa vkladajú do všetkých webov.</p>
      <H2>Pobočka</H2>
      <Field label="Riadok pobočky v pätičke maklérov" value={n.line} onChange={v => set({ line: v })} hint="Za ním sa automaticky doplní „· manažér pobočky [meno]“ s odkazom na web manažéra." />
      <Field label="Odkaz na pobočku na vianemareal.eu" type="url" value={n.url} onChange={v => set({ url: v })} />
      <div className="wa-f">
        <label>Web manažéra pobočky</label>
        <select value={n.manazerSlug} onChange={e => set({ manazerSlug: e.target.value })}>
          {sites.filter(s => s.typ === "manazer").map(s => <option key={s.id} value={s.slug}>{s.draft.name} (/web/{s.slug})</option>)}
        </select>
        <div className="wa-hint">Weby maklérov naň odkazujú v sekcii Tím a v pätičke.</div>
      </div>
      <Field label="Dátum stavu ponúk" value={n.asOf} onChange={v => set({ asOf: v })} placeholder="18. 9. 2026" />
      <H2>Texty šablóny</H2>
      <Field label="Súhlas vo formulári" value={n.gdpr} onChange={v => set({ gdpr: v })} />
      <Field label="Poznámka pod videami (weby maklérov)" value={n.videosNote} onChange={v => set({ videosNote: v })} area />
      <Field label="Poznámka pod lokalitami" value={n.areasNote} onChange={v => set({ areasNote: v })} area />
      <div className="wa-actions">
        <button className="wa-btn wa-btn-p" onClick={async () => { setState("Ukladám…"); try { await onSave(n); setState("Uložené"); } catch (e) { setState((e as Error).message); } }}>Uložiť nastavenia</button>
        <span className="wa-save">{state}</span>
      </div>
      <H2>Poradie maklérov</H2>
      <div className="wa-rows">
        {makleri.map((s, i) => (
          <div key={s.id} className="wa-rowcard">
            <div className="wa-rh" style={{ marginBottom: 0 }}>
              <span><span className="wa-dot" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8, background: PALETTES[(s.draft as MaklerData).palette]?.acc }} /><b style={{ color: "var(--text-primary)" }}>{s.draft.name}</b>{(s.draft as MaklerData).team === false ? " · mimo tímu" : ""}</span>
              <div className="wa-ops">
                <button type="button" disabled={i === 0} onClick={() => { const ids = makleri.map(x => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; onReorder(ids); }}>↑</button>
                <button type="button" disabled={i === makleri.length - 1} onClick={() => { const ids = makleri.map(x => x.id); [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; onReorder(ids); }}>↓</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="wa-hint">Poradie určuje karty v sekcii Tím na weboch maklérov a poradie v ľavom zozname.</div>
    </div>
  );
}

/* ─────────────────────────── Dopyty ─────────────────────────── */
function Dopyty({ sites }: { sites: Site[] }) {
  const [rows, setRows] = useState<WebDopyt[] | null>(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const load = () => setTick(t => t + 1);
  useEffect(() => {
    api<{ dopyty: WebDopyt[] }>("/api/dopyty").then(d => setRows(d.dopyty)).catch(e => setErr(e.message));
  }, [tick]);
  const name = (r: WebDopyt) => (sites.find(s => s.id === r.site_id) || sites.find(s => s.slug === r.site_slug))?.draft.name || r.site_slug;
  return (
    <div className="wa-editor">
      <h1>Dopyty z webov</h1>
      <p className="wa-sub">Formulár „Koľko stojí vaša nehnuteľnosť“. Každý dopyt ide aj e‑mailom maklérovi.</p>
      {err && <div className="wa-err">{err}</div>}
      {rows === null ? <div className="wa-note">Načítavam…</div> : !rows.length ? <div className="wa-note">Zatiaľ žiadne dopyty.</div> : (
        <div className="wa-table">
          <table>
            <thead><tr><th>Dátum</th><th>Web</th><th>Meno · telefón</th><th>Nehnuteľnosť</th><th>Kedy</th><th>Vybavené</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={r.vybavene ? "done" : ""}>
                  <td>{new Date(r.created_at).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{name(r)}</td>
                  <td><b>{r.data.meno}</b><br /><a href={`tel:${telFrom(r.data.tel)}`}>{r.data.tel}</a></td>
                  <td>{r.data.typ} · {r.data.adresa} · {r.data.m2} m²{r.data.stav ? ` · ${r.data.stav}` : ""}{r.data.izby ? ` · ${r.data.izby} izb.` : ""}</td>
                  <td>{r.data.kedy || "—"}</td>
                  <td><input type="checkbox" checked={r.vybavene} onChange={async e => { const v = e.target.checked; setRows(rs => rs!.map(x => x.id === r.id ? { ...x, vybavene: v } : x)); await api("/api/dopyty", { method: "PATCH", body: JSON.stringify({ id: r.id, vybavene: v }) }).catch(() => load()); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Používatelia ─────────────────────────── */
function Users({ users, setUsers, me }: { users: WebUser[]; setUsers: (u: WebUser[]) => void; me: WebUser | null }) {
  const [f, setF] = useState({ name: "", email: "", role: "makler", password: "" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  async function add() {
    setErr(""); setMsg("");
    try { const r = await api<{ user: WebUser }>("/api/users", { method: "POST", body: JSON.stringify(f) }); setUsers([...users, r.user]); setF({ name: "", email: "", role: "makler", password: "" }); setMsg("Používateľ vytvorený."); }
    catch (e) { setErr((e as Error).message); }
  }
  async function reset(u: WebUser) {
    const pw = window.prompt(`Nové heslo pre ${u.name} (min. 8 znakov):`);
    if (!pw) return;
    try { await api(`/api/users/${u.id}`, { method: "PUT", body: JSON.stringify({ password: pw }) }); setMsg(`Heslo pre ${u.name} zmenené.`); } catch (e) { setErr((e as Error).message); }
  }
  async function role(u: WebUser, role: string) {
    try { const r = await api<{ user: WebUser }>(`/api/users/${u.id}`, { method: "PUT", body: JSON.stringify({ role }) }); setUsers(users.map(x => x.id === u.id ? r.user : x)); } catch (e) { setErr((e as Error).message); }
  }
  async function del(u: WebUser) {
    if (!window.confirm(`Zmazať účet ${u.name}? Jeho web ostane, len sa odpojí.`)) return;
    try { await api(`/api/users/${u.id}`, { method: "DELETE" }); setUsers(users.filter(x => x.id !== u.id)); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="wa-editor">
      <h1>Používatelia</h1>
      <p className="wa-sub">Každý maklér sa prihlasuje vlastným e‑mailom a heslom na svojej doméne (/admin) a vidí len svoj web. Správca vidí všetko.</p>
      {err && <div className="wa-err" style={{ marginBottom: 10 }}>{err}</div>}
      {msg && <div className="wa-note">{msg}</div>}
      <div className="wa-table">
        <table>
          <thead><tr><th>Meno</th><th>E‑mail</th><th>Rola</th><th>Posledné prihlásenie</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><b>{u.name}</b>{me?.id === u.id ? " (ty)" : ""}</td>
                <td>{u.email}</td>
                <td><select value={u.role} disabled={me?.id === u.id} onChange={e => role(u, e.target.value)}><option value="makler">maklér</option><option value="admin">správca</option></select></td>
                <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                <td><div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}><button className="wa-btn wa-btn-s" onClick={() => reset(u)}>Nastaviť heslo</button>{me?.id !== u.id && <button className="wa-btn wa-btn-s wa-btn-d" onClick={() => del(u)}>Zmazať</button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H2>Nový používateľ</H2>
      <div className="wa-row2">
        <Field label="Meno" value={f.name} onChange={v => setF({ ...f, name: v })} />
        <Field label="E‑mail (prihlasovacie meno)" type="email" value={f.email} onChange={v => setF({ ...f, email: v })} />
      </div>
      <div className="wa-row2">
        <div className="wa-f"><label>Rola</label><select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="makler">maklér (len svoj web)</option><option value="admin">správca (všetky weby)</option></select></div>
        <Field label="Počiatočné heslo (min. 8 znakov)" value={f.password} onChange={v => setF({ ...f, password: v })} />
      </div>
      <div className="wa-actions"><button className="wa-btn wa-btn-p" onClick={add}>Vytvoriť účet</button></div>
      <div className="wa-hint">Po vytvorení priraď maklérovi jeho web v editore webu (Doména a prístup → Maklér, ktorý si web spravuje sám).</div>
    </div>
  );
}

function PasswordForm() {
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  async function save() {
    setErr(""); setMsg("");
    if (f.next !== f.again) { setErr("Nové heslá sa nezhodujú."); return; }
    try { await api("/api/auth/password", { method: "POST", body: JSON.stringify({ current: f.current, next: f.next }) }); setMsg("Heslo zmenené."); setF({ current: "", next: "", again: "" }); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="wa-editor" style={{ maxWidth: 460 }}>
      <h1>Moje heslo</h1>
      <p className="wa-sub">Zmena hesla pre prihlásenie do správy webu.</p>
      <Field label="Súčasné heslo" type="password" value={f.current} onChange={v => setF({ ...f, current: v })} />
      <Field label="Nové heslo (min. 8 znakov)" type="password" value={f.next} onChange={v => setF({ ...f, next: v })} />
      <Field label="Nové heslo znova" type="password" value={f.again} onChange={v => setF({ ...f, again: v })} />
      {err && <div className="wa-err">{err}</div>}
      {msg && <div className="wa-note">{msg}</div>}
      <div className="wa-actions"><button className="wa-btn wa-btn-p" onClick={save}>Zmeniť heslo</button></div>
    </div>
  );
}

/* ─────────────────────────── Hlavná stránka ─────────────────────────── */
function WebyAdmin() {
  const [user, setUser] = useState<WebUser | null>(null);
  const [users, setUsers] = useState<WebUser[]>([]);
  const params = useSearchParams();
  const [sites, setSites] = useState<Site[]>([]);
  const [nastavenia, setNastavenia] = useState<Nastavenia | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [view, setView] = useState<View>(params.get("tab") === "dopyty" ? { kind: "dopyty" } : { kind: "site", id: "" });
  const [loadErr, setLoadErr] = useState("");
  const [saveState, setSaveState] = useState("Uložené");
  const [prevKey, setPrevKey] = useState(0);
  const [prevDark, setPrevDark] = useState(false);
  const [prevW, setPrevW] = useState("100%");
  const [mobilePrev, setMobilePrev] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, SiteData>>({});

  useEffect(() => {
    api<{ user: WebUser }>("/api/auth/me")
      .then(async me => {
        setUser(me.user);
        const d = await api<{ sites: Site[]; nastavenia: Nastavenia; isAdmin: boolean }>("/api/sites");
        setSites(d.sites); setNastavenia(d.nastavenia); setIsManager(d.isAdmin);
        setView(v => (v.kind === "site" && !v.id) ? { kind: "site", id: (d.sites.find(s => s.user_id === me.user.id) || d.sites[0])?.id || "" } : v);
        if (d.isAdmin) api<{ users: WebUser[] }>("/api/users").then(u => setUsers(u.users)).catch(() => {});
      })
      .catch(e => {
        if (/prihlásenie/i.test((e as Error).message)) { window.location.href = "/login"; return; }
        setLoadErr((e as Error).message);
      });
  }, []);

  const current = view.kind === "site" ? sites.find(s => s.id === view.id) : undefined;
  const ordered = useMemo(() => [...sites].sort((a, b) => (a.typ === b.typ ? a.poradie - b.poradie : a.typ === "manazer" ? -1 : 1)), [sites]);

  /** Lokálna zmena draftu + debounce autosave (800 ms). */
  function onDraft(id: string, draft: SiteData) {
    setSites(ss => ss.map(s => s.id === id ? { ...s, draft } : s));
    pending.current[id] = draft;
    setSaveState("Neuložené zmeny…");
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const d = pending.current[id];
      delete pending.current[id];
      setSaveState("Ukladám…");
      try {
        await api(`/api/sites/${id}`, { method: "PUT", body: JSON.stringify({ draft: d }) });
        setSaveState("Uložené " + new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }));
        setPrevKey(k => k + 1);
      } catch (e) { setSaveState("Chyba: " + (e as Error).message); }
    }, 800);
  }
  async function onMeta(id: string, m: { slug?: string; domain?: string | null; user_id?: string | null; poradie?: number }) {
    const d = await api<{ site: Site }>(`/api/sites/${id}`, { method: "PUT", body: JSON.stringify(m) });
    setSites(ss => ss.map(s => s.id === id ? { ...s, ...d.site, draft: s.draft } : s));
  }
  async function onPublish(id: string, unpublish?: boolean) {
    clearTimeout(timers.current[id]);
    const d = pending.current[id];
    if (d) { delete pending.current[id]; await api(`/api/sites/${id}`, { method: "PUT", body: JSON.stringify({ draft: d }) }); }
    const r = await api<{ site: Site }>(`/api/sites/${id}/publish`, { method: "POST", body: JSON.stringify({ unpublish: !!unpublish }) });
    setSites(ss => ss.map(s => s.id === id ? { ...s, ...r.site } : s));
    setPrevKey(k => k + 1);
  }
  async function addSite(copyOf?: string) {
    const r = await api<{ site: Site }>("/api/sites", { method: "POST", body: JSON.stringify({ copyOf }) });
    setSites(ss => [...ss, r.site]); setView({ kind: "site", id: r.site.id });
  }
  async function delSite(s: Site) {
    if (!window.confirm(`Naozaj odstrániť web ${s.draft.name}? Verejná adresa prestane fungovať a obsah sa zmaže.`)) return;
    await api(`/api/sites/${s.id}`, { method: "DELETE" });
    setSites(ss => ss.filter(x => x.id !== s.id));
    setView({ kind: "site", id: sites.find(x => x.id !== s.id)?.id || "" });
  }
  async function reorder(ids: string[]) {
    await Promise.all(ids.map((id, i) => api(`/api/sites/${id}`, { method: "PUT", body: JSON.stringify({ poradie: i + 1 }) })));
    setSites(ss => ss.map(s => { const i = ids.indexOf(s.id); return i >= 0 ? { ...s, poradie: i + 1 } : s; }));
    setPrevKey(k => k + 1);
  }
  async function saveNastavenia(n: Nastavenia) {
    const d = await api<{ nastavenia: Nastavenia }>("/api/nastavenia", { method: "PUT", body: JSON.stringify(n) });
    setNastavenia(d.nastavenia); setPrevKey(k => k + 1);
  }

  const previewSrc = current ? `/nahlad/${current.id}?v=${prevKey}${prevDark ? "&dark=1" : ""}` : "";

  return (
    <div className={"wa" + (mobilePrev ? " show-prev" : "")}>
      <style>{ADMIN_CSS}</style>
      <aside className="wa-side">
        <div className="wa-side-head"><b>Správa webov</b><small>{user?.name}</small><button className="wa-btn wa-btn-s" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>Odhlásiť</button></div>
        <div className="wa-side-sec">Weby</div>
        <nav>
          {ordered.map(s => (
            <a key={s.id} className={view.kind === "site" && view.id === s.id ? "on" : ""} onClick={() => setView({ kind: "site", id: s.id })}>
              <span className="wa-dot" style={{ background: s.typ === "manazer" ? "#A87B1F" : PALETTES[(s.draft as MaklerData).palette]?.acc || "#888" }} />
              <span className="wa-nm">{s.draft.name}</span>
              <small>{s.typ === "manazer" ? "manažér" : !s.published ? "nepublikovaný" : (s.draft as MaklerData).team === false ? "mimo tímu" : ""}</small>
            </a>
          ))}
          {isManager && <a className="wa-add" onClick={() => addSite()}>＋ Nový maklér</a>}
        </nav>
        <div className="wa-side-sec">Spoločné</div>
        <nav>
          <a className={view.kind === "dopyty" ? "on" : ""} onClick={() => setView({ kind: "dopyty" })}>Dopyty z webov</a>
          {isManager && <a className={view.kind === "nastavenia" ? "on" : ""} onClick={() => setView({ kind: "nastavenia" })}>Pobočka a šablóna</a>}
          {isManager && <a className={view.kind === "pouzivatelia" ? "on" : ""} onClick={() => setView({ kind: "pouzivatelia" })}>Používatelia</a>}
          <a className={view.kind === "heslo" ? "on" : ""} onClick={() => setView({ kind: "heslo" })}>Moje heslo</a>
        </nav>
      </aside>

      <section className="wa-main">
        <div className="wa-mobile-tabs">
          <button className={"wa-btn wa-btn-s" + (!mobilePrev ? " wa-btn-p" : "")} onClick={() => setMobilePrev(false)}>Úprava</button>
          <button className={"wa-btn wa-btn-s" + (mobilePrev ? " wa-btn-p" : "")} onClick={() => setMobilePrev(true)}>Náhľad</button>
        </div>
        {loadErr && <div className="wa-err" style={{ padding: 20 }}>{loadErr}</div>}
        {view.kind === "site" && current && (
          <SiteEditor key={current.id} site={current} isManager={isManager} accounts={users.map(a => ({ id: a.id, name: `${a.name} (${a.email})` }))}
            saveState={saveState} onDraft={d => onDraft(current.id, d)} onMeta={m => onMeta(current.id, m)}
            onPublish={u => onPublish(current.id, u)} onDelete={() => delSite(current)} onDuplicate={() => addSite(current.id)} />
        )}
        {view.kind === "site" && !current && !loadErr && <div className="wa-note" style={{ margin: 20 }}>{user && !sites.length ? "Zatiaľ nemáš priradený žiadny web. Ozvi sa správcovi." : sites.length ? "Vyber web vľavo." : "Načítavam…"}</div>}
        {view.kind === "nastavenia" && nastavenia && <NastaveniaEditor value={nastavenia} sites={sites} onSave={saveNastavenia} onReorder={reorder} />}
        {view.kind === "dopyty" && <Dopyty sites={sites} />}
        {view.kind === "pouzivatelia" && isManager && <Users users={users} setUsers={setUsers} me={user} />}
        {view.kind === "heslo" && <PasswordForm />}
      </section>

      <section className="wa-preview">
        <div className="wa-prev-bar">
          <b>{current ? `Náhľad: ${current.draft.name}` : "Náhľad"}</b>
          <span style={{ flex: 1 }} />
          <label><input type="checkbox" checked={prevDark} onChange={e => setPrevDark(e.target.checked)} /> Tmavý režim</label>
          <select value={prevW} onChange={e => setPrevW(e.target.value)}><option value="100%">Desktop</option><option value="820px">Tablet</option><option value="390px">Mobil</option></select>
          <button className="wa-btn wa-btn-s" onClick={() => setPrevKey(k => k + 1)}>Obnoviť</button>
          {current && <a className="wa-btn wa-btn-s" href={previewSrc} target="_blank" rel="noreferrer">Otvoriť v okne</a>}
        </div>
        <div className="wa-prev-wrap">
          {current ? <iframe key={previewSrc} src={previewSrc} title="Náhľad webu" style={{ width: prevW }} /> : <div className="wa-note">Náhľad je dostupný pri webe makléra alebo manažéra.</div>}
        </div>
      </section>
    </div>
  );
}

export default function WebyPage() {
  return <Suspense fallback={null}><WebyAdmin /></Suspense>;
}

/* ─────────────────────────── Štýly adminu ─────────────────────────── */
const ADMIN_CSS = `
.wa{--border:var(--line);--border-subtle:var(--line);--bg-surface:var(--surface);--bg-base:var(--bg);--bg-hover:var(--accent-soft);--bg-elevated:var(--bg);--text-primary:var(--ink);--text-secondary:var(--muted);--text-muted:var(--muted);--accent-light:var(--accent-soft);--accent-hover:var(--accent-ink);--danger:var(--warn);--danger-light:var(--warn-soft);--success:var(--ok);--success-light:var(--ok-soft);--warning:#B0681A;--warning-light:#F6E9D6;
display:grid;grid-template-columns:240px minmax(380px,540px) 1fr;gap:0;height:100vh;height:100dvh;font-size:14px;color:var(--ink)}
.wa-side-head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wa-side-head b{font-size:15px}
.wa-side-head small{color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wa-f input[type=password]{width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface);color:var(--text-primary);font-size:14px}
.wa-side{background:var(--bg-surface);border-right:1px solid var(--border);overflow:auto;padding-bottom:20px;display:flex;flex-direction:column}
.wa-side-sec{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);font-weight:600;padding:16px 16px 6px}
.wa-side nav a{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;color:var(--text-primary);border-left:3px solid transparent;user-select:none;text-decoration:none}
.wa-side nav a:hover{background:var(--bg-hover)}
.wa-side nav a.on{border-left-color:var(--accent);background:var(--accent-light)}
.wa-side nav a .wa-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wa-side nav a small{color:var(--text-muted);margin-left:auto;font-size:11px;white-space:nowrap}
.wa-side nav a.wa-add{color:var(--accent);font-weight:600}
.wa-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto;border:1px solid rgba(0,0,0,.12)}
.wa-main{overflow:auto;border-right:1px solid var(--border);background:var(--bg-base)}
.wa-editor{padding:20px 22px 60px}
.wa-editor h1{font-size:20px;font-weight:700;margin:0 0 4px}
.wa-sub{color:var(--text-secondary);margin:0 0 14px;font-size:13px}
.wa-save{color:var(--text-muted)}
.wa-h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin:24px 0 10px;padding-top:14px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px}
.wa-f{margin-bottom:12px}
.wa-f>label{display:block;font-size:12px;font-weight:600;margin-bottom:4px}
.wa-hint{font-size:12px;color:var(--text-muted);margin-top:3px}
.wa-err{font-size:12px;color:var(--danger);margin-top:4px}
.wa-f input[type=text],.wa-f input[type=url],.wa-f input[type=email],.wa-f input[type=tel],.wa-f input:not([type]),.wa-f select,.wa-f textarea,.wa-rowcard input,.wa-rowcard textarea,.wa-rowcard select{width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface);color:var(--text-primary);font-size:14px}
.wa-f textarea,.wa-rowcard textarea{min-height:64px;resize:vertical}
.wa-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wa-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-surface);cursor:pointer;font-weight:600;font-size:13px;line-height:1.2;color:var(--text-primary);text-decoration:none}
.wa-btn:hover{border-color:var(--accent);color:var(--accent)}
.wa-btn:disabled{opacity:.5;cursor:not-allowed}
.wa-btn-p{background:var(--accent);border-color:var(--accent);color:#fff}
.wa-btn-p:hover{background:var(--accent-hover);color:#fff}
.wa-btn-d{color:var(--danger)}
.wa-btn-d:hover{border-color:var(--danger);color:var(--danger)}
.wa-btn-s{padding:5px 9px;font-size:12px;font-weight:500}
.wa-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.wa-status{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.wa-pill{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px}
.wa-pill.ok{background:var(--success-light);color:var(--success)}
.wa-pill.warn{background:var(--warning-light);color:var(--warning)}
.wa-link{font-size:13px;color:var(--accent);font-weight:600}
.wa-tags{display:flex;gap:6px;flex-wrap:wrap;padding:6px;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface);min-height:38px}
.wa-tag{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;background:var(--accent-light);color:var(--accent);border-radius:999px;font-size:12px}
.wa-tag button{border:0;background:none;cursor:pointer;padding:0;line-height:1;color:inherit;font-size:14px}
.wa-tags input{border:0!important;background:none!important;flex:1;min-width:120px;padding:4px!important;outline:none;box-shadow:none!important}
.wa-rows{display:grid;gap:10px}
.wa-rowcard{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--bg-surface)}
.wa-rh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12px;color:var(--text-muted)}
.wa-ops{display:flex;gap:4px}
.wa-ops button{border:1px solid var(--border);background:none;border-radius:6px;cursor:pointer;padding:2px 7px;font-size:12px;color:var(--text-muted)}
.wa-ops button:hover:not(:disabled){color:var(--text-primary);border-color:var(--text-primary)}
.wa-ops button:disabled{opacity:.4;cursor:default}
.wa-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.wa-grid .full{grid-column:1/-1}
.wa-lbl{font-size:11px;color:var(--text-muted);margin-bottom:2px}
.wa-photo{display:flex;gap:10px;align-items:flex-start}
.wa-thumb{width:64px;height:64px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);display:grid;place-items:center;font-size:10px;color:var(--text-muted);overflow:hidden;flex:0 0 auto;text-align:center}
.wa-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.wa-pin{flex:1;display:grid;gap:6px}
.wa-pops{display:flex;gap:6px;flex-wrap:wrap}
.wa-pal{display:flex;gap:6px;flex-wrap:wrap}
.wa-palopt{display:flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border);border-radius:999px;cursor:pointer;font-size:12px;background:var(--bg-surface)}
.wa-palopt.on{border-color:var(--accent);background:var(--accent-light)}
.wa-palopt input{display:none}
.wa-secs{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.wa-sec{display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;user-select:none;color:var(--text-muted);font-size:13px;font-weight:600;background:var(--bg-surface)}
.wa-sec.on{color:var(--text-primary);border-color:var(--accent);background:var(--accent-light)}
.wa-sec input{display:none}
.wa-sw{display:inline-block;width:28px;height:16px;border-radius:999px;background:var(--border);position:relative;flex:0 0 auto;transition:background .15s}
.wa-sw::after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.wa-sec.on .wa-sw{background:var(--accent)}
.wa-sec.on .wa-sw::after{left:14px}
.wa-offtag{font-size:10px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--warning);background:var(--warning-light);padding:2px 8px;border-radius:999px}
.wa-issues{border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin:0 0 16px;background:var(--bg-surface);font-size:13px}
.wa-issues.bad{border-color:var(--danger);background:var(--danger-light)}
.wa-issues.good{border-color:var(--success);background:var(--success-light)}
.wa-issues ul{margin:6px 0 0;padding-left:18px}
.wa-note{font-size:13px;color:var(--text-secondary);border-left:3px solid var(--border);padding:6px 10px;margin:10px 0}
.wa-slug{display:flex;align-items:center;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface);overflow:hidden}
.wa-slug span{padding:7px 0 7px 10px;color:var(--text-muted);font-size:13px}
.wa-slug input{border:0!important;background:none!important;flex:1;padding:7px 10px 7px 2px!important;box-shadow:none!important}
.wa-ro .wa-editor input,.wa-ro .wa-editor textarea,.wa-ro .wa-editor select,.wa-ro .wa-editor .wa-sec,.wa-ro .wa-editor .wa-ops,.wa-ro .wa-editor .wa-btn-s,.wa-ro .wa-tag button{pointer-events:none;opacity:.7}
.wa-preview{display:flex;flex-direction:column;min-width:0;background:var(--bg-base)}
.wa-prev-bar{display:flex;gap:10px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);background:var(--bg-surface);flex-wrap:wrap;font-size:12px}
.wa-prev-bar select{padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);font-size:12px}
.wa-prev-wrap{flex:1;overflow:auto;display:flex;justify-content:center;padding:12px}
.wa-prev-wrap iframe{border:1px solid var(--border);border-radius:10px;background:#fff;height:100%;max-width:100%;transition:width .2s}
.wa-table{overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--bg-surface)}
.wa-table table{width:100%;border-collapse:collapse;font-size:13px;table-layout:auto}
.wa-table td{word-break:break-word}
.wa-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);padding:10px 12px;border-bottom:1px solid var(--border)}
.wa-table td{padding:10px 12px;border-bottom:1px solid var(--border-subtle);vertical-align:top}
.wa-table tr.done td{color:var(--text-muted)}
.wa-mobile-tabs{display:none}
@media (max-width:1100px){
  .wa{grid-template-columns:230px 1fr}
  .wa-preview{display:none}
  .wa.show-prev .wa-preview{display:flex;grid-column:2}
  .wa.show-prev .wa-main{display:none}
  .wa-mobile-tabs{display:flex;gap:6px;padding:10px 16px 0}
}
@media (max-width:768px){
  .wa{grid-template-columns:1fr;grid-template-rows:auto 1fr;height:auto}
  .wa-side{border-right:0;border-bottom:1px solid var(--border);max-height:40vh}
  .wa.show-prev .wa-preview{grid-column:1;height:80vh}
  .wa-row2,.wa-secs{grid-template-columns:1fr}
}
`;
