/**
 * Verejný web makléra / manažéra — server-renderované React komponenty.
 * Dáta prichádzajú z weby_sites (published alebo draft pre náhľad).
 * Štýly sú scoped pod `.mw` (viď src/lib/styles.ts).
 */
import type { CSSProperties } from "react";
import type { MaklerData, ManazerData, Nastavenia, SiteData, WebSite } from "@/lib/types";
import { initials, sectionOn, telFrom } from "@/lib/types";
import { MAKLER_CSS, MANAZER_CSS } from "@/lib/styles";
import LeadForm from "./LeadForm";
import OpenFormLink from "./OpenFormLink";

/** Zoznam ostatných webov (na prelinkovanie tímu) — len to, čo verejný web potrebuje. */
export interface SiteRef {
  id: string;
  slug: string;
  url: string;
  typ: "makler" | "manazer";
  data: SiteData;
  isPublished: boolean;
}

export interface SiteViewProps {
  site: WebSite;
  data: SiteData;
  refs: SiteRef[];
  nastavenia: Nastavenia;
  preview?: boolean;
  dark?: boolean;
}

/* ── SVG symboly (panorámy, logo AM, Vianema wordmark) ── */
function Symbols() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="ba" viewBox="0 0 1200 220">
        <rect x="95" y="186" width="50" height="14" /><polygon points="111,186 129,186 127,72 113,72" /><rect x="114" y="62" width="12" height="10" /><circle cx="120" cy="57" r="5" />
        <rect x="226" y="40" width="8" height="160" /><path d="M230 40 V12" stroke="currentColor" strokeWidth="3" fill="none" /><ellipse cx="230" cy="96" rx="26" ry="8" /><ellipse cx="230" cy="72" rx="14" ry="5" />
        <polygon points="296,200 332,152 522,152 562,200" /><rect x="360" y="112" width="130" height="46" />
        <rect x="350" y="92" width="18" height="70" /><polygon points="350,92 359,78 368,92" /><rect x="392" y="98" width="12" height="64" /><polygon points="392,98 398,86 404,98" />
        <rect x="446" y="98" width="12" height="64" /><polygon points="446,98 452,86 458,98" /><rect x="482" y="92" width="18" height="70" /><polygon points="482,92 491,78 500,92" />
        <rect x="600" y="120" width="40" height="80" /><rect x="612" y="60" width="16" height="62" /><polygon points="607,60 620,8 633,60" /><circle cx="620" cy="7" r="4" />
        <rect x="680" y="100" width="22" height="100" /><ellipse cx="691" cy="98" rx="13" ry="10" /><polygon points="687,90 691,68 695,90" /><circle cx="691" cy="66" r="3" />
        <path d="M740 172 L1060 166" stroke="currentColor" strokeWidth="5" fill="none" /><path d="M877 62 L800 170 M877 62 L1000 168" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path d="M905 200 L866 64 M935 200 L888 64" stroke="currentColor" strokeWidth="9" fill="none" strokeLinecap="round" /><rect x="860" y="58" width="34" height="8" /><ellipse cx="877" cy="50" rx="46" ry="12" /><rect x="865" y="30" width="24" height="18" rx="5" />
      </symbol>
      <symbol id="zl" viewBox="0 0 1200 220">
        <polygon opacity=".55" points="0,200 90,140 180,165 300,80 420,150 520,105 620,160 740,95 860,150 960,110 1060,155 1200,90 1200,200" />
        <rect x="290" y="112" width="40" height="88" /><polygon points="282,112 310,66 338,112" /><path d="M310 66 V48" stroke="currentColor" strokeWidth="3" fill="none" />
        <rect x="570" y="132" width="90" height="68" />
        <rect x="558" y="84" width="24" height="116" /><ellipse cx="570" cy="82" rx="14" ry="9" /><polygon points="564,76 570,52 576,76" />
        <rect x="648" y="84" width="24" height="116" /><ellipse cx="660" cy="82" rx="14" ry="9" /><polygon points="654,76 660,52 666,76" />
        <rect x="692" y="98" width="18" height="102" /><polygon points="688,98 701,74 714,98" />
        <rect x="780" y="150" width="220" height="10" />
        <rect x="790" y="160" width="10" height="40" /><rect x="830" y="160" width="10" height="40" /><rect x="870" y="160" width="10" height="40" /><rect x="910" y="160" width="10" height="40" /><rect x="950" y="160" width="10" height="40" /><rect x="990" y="160" width="10" height="40" />
        <polygon points="780,150 835,118 890,150" /><polygon points="890,150 945,118 1000,150" />
        <rect x="1080" y="122" width="40" height="78" /><rect x="1092" y="72" width="16" height="50" /><polygon points="1088,72 1100,32 1112,72" />
      </symbol>
      <symbol id="am-mark" viewBox="0 0 62.07 60.96">
        <circle cx="19.68" cy="58.07" r="1.69" /><circle cx="14.96" cy="55.59" r="1.69" /><circle cx="10.77" cy="52.2" r="1.69" />
        <path d="M29.56.03C13.78.77.92,13.5.05,29.28c-.38,6.88,1.49,13.3,4.95,18.61.51.78,1.55,1,2.33.5h0c.81-.51,1.04-1.58.51-2.39-3.04-4.69-4.7-10.35-4.39-16.4C4.15,15.82,15.15,4.53,28.91,3.49c16.18-1.22,29.74,11.61,29.74,27.54,0,11.37-6.91,21.16-16.75,25.39-.64.28-1.12.88-1.12,1.59-.01,1.24,1.25,2.07,2.39,1.59,11.1-4.73,18.9-15.75,18.9-28.56C62.07,13.43,47.34-.79,29.56.03Z" />
        <path d="M31.02,60.96c-.97,0-1.75-.79-1.75-1.75v-15.44c-4.16-.87-7.15-4.52-7.15-8.79,0-4.96,4.03-8.99,8.99-8.99s8.99,4.03,8.99,8.99c0,4.27-2.99,7.93-7.15,8.79v9.34h2.42c.97,0,1.75.79,1.75,1.75v4.34c0,.97-.79,1.75-1.75,1.75h-4.34ZM31.1,29.67c-2.93,0-5.32,2.39-5.32,5.32s2.39,5.32,5.32,5.32,5.32-2.39,5.32-5.32-2.39-5.32-5.32-5.32Z" />
        <path d="M49.84,32.05c-.45,0-.88-.16-1.22-.46l-17.32-15.4-17.72,15.41c-.33.29-.76.45-1.2.45-.53,0-1.04-.23-1.39-.63-.32-.37-.48-.84-.45-1.33s.26-.94.63-1.26L30.1,12.36c.33-.29.76-.45,1.2-.45s.88.16,1.22.46l10.85,9.65v-3.23h3.67v6.5l4,3.56c.37.33.58.77.61,1.26.03.49-.13.96-.46,1.33-.35.39-.85.62-1.37.62h0Z" />
      </symbol>
      <symbol id="vianema" viewBox="0 0 800 140">
        <rect x="10" y="50" width="70" height="10" fill="#2BB3B8" /><rect x="10" y="80" width="70" height="10" fill="#2BB3B8" />
        <text x="400" y="95" fontFamily="Helvetica, Arial, sans-serif" fontSize="80" fontWeight="300" letterSpacing="14" textAnchor="middle" fill="currentColor">VIANEMA</text>
        <rect x="720" y="50" width="70" height="10" fill="#2BB3B8" /><rect x="720" y="80" width="70" height="10" fill="#2BB3B8" />
      </symbol>
    </svg>
  );
}

const Sky = ({ id, className, style }: { id: string; className?: string; style?: CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><use href={`#${id}`} /></svg>
);

function Listings({ d, note }: { d: SiteData; note: string }) {
  return (
    <>
      <div className="grid3">
        {d.listings.map((l, i) => {
          const inner = (
            <>
              <div className="ph"><span className="tag">{l.type}</span>Fotografia z ponuky{l.photo && <img src={l.photo} alt="" />}</div>
              <div className="card-body"><h3>{l.title}</h3><div className="price">{l.price}</div><div className="meta">{l.meta}</div></div>
            </>
          );
          return l.url
            ? <a key={i} className="card" href={l.url}>{inner}</a>
            : <article key={i} className="card">{inner}</article>;
        })}
      </div>
      <div className="example">{note}</div>
    </>
  );
}

function Reviews({ d, note, btnClass }: { d: SiteData; note: React.ReactNode; btnClass: string }) {
  return (
    <section id="referencie"><div className="wrap">
      <div className="sec-head"><div><div className="eyebrow">Referencie</div><h2>Čo hovoria klienti</h2></div><a className={btnClass} href={d.googleUrl || "#"}>★ Ohodnoť ma na Google</a></div>
      <div className="quotes">
        {d.reviews.map((r, i) => <blockquote key={i}>„{r.text}“<footer><span className="stars">★★★★★</span><br />{r.author}</footer></blockquote>)}
      </div>
      <div className="example">{note}</div>
    </div></section>
  );
}

function Sold({ d, note, bold }: { d: SiteData; note: string; bold?: boolean }) {
  return (
    <div>
      <div className="sold">
        {d.sold.map((s, i) => (
          <div key={i} className="sold-row">
            <div>{bold ? <b>{s.type}</b> : s.type}<div className="loc">{s.loc}</div></div>
            <div className="loc">{s.year}</div>
            <span className="days">predané za {s.days}</span>
          </div>
        ))}
      </div>
      <div className="example">{note}</div>
    </div>
  );
}

/* ══════════════════════ WEB MAKLÉRA ══════════════════════ */
function MaklerSite({ site, data: b, refs, nastavenia: BR, preview, dark }: SiteViewProps & { data: MaklerData }) {
  const manager = refs.find(r => r.typ === "manazer" && r.slug === BR.manazerSlug) || refs.find(r => r.typ === "manazer");
  const M = manager?.data as ManazerData | undefined;
  const mUrl = manager ? manager.url : "#";
  const team = refs.filter(r => r.typ === "makler" && r.id !== site.id && (r.data as MaklerData).team !== false);
  const inTeam = b.team !== false && sectionOn(b, "tim");
  const oc = sectionOn(b, "ocenenie");
  const tel = telFrom(b.phone);
  const wa = "https://wa.me/" + tel.replace("+", "");
  const sky = b.sky || "ba";

  return (
    <div className="mw" data-palette={b.palette || "park"} data-theme={dark ? "dark" : undefined}>
      <style dangerouslySetInnerHTML={{ __html: MAKLER_CSS }} />
      <Symbols />
      {preview && <div className="preview-tag">Náhľad rozpracovanej verzie</div>}
      <div className="mw-header"><div className="wrap nav">
        <a className="brand" href="#top">VIANEMA<span>{b.name}</span></a>
        <nav className="menu" aria-label="Hlavné menu">
          {sectionOn(b, "ponuky") && <a href="#ponuky">Ponuky</a>}
          {sectionOn(b, "omne") && <a href="#o-mne">O mne</a>}
          {sectionOn(b, "partneri") && <a href="#partneri">Partneri</a>}
          {inTeam && <a href="#tim">Tím</a>}
          {sectionOn(b, "lokality") && <a href="#lokality">Lokality</a>}
          <a className="tel" href={`tel:${tel}`}>{b.phone}</a>
        </nav>
      </div></div>

      <div className="mw-main" id="top">
        <section className="hero"><div className="wrap">
          <div className="hero-media" role="img" aria-label={b.name}>
            <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect width="1600" height="900" style={{ fill: "var(--sky1)" }} />
              <circle cx="1290" cy="200" r="52" style={{ fill: "var(--sun)" }} opacity=".9" />
              <use href={`#${sky}`} x="-40" y="420" width="1700" height="312" style={{ color: "var(--skyline)", fill: "currentColor" }} />
              <rect y="730" width="1600" height="170" style={{ fill: "var(--sky2)" }} />
              <path d="M0 760 Q200 748 400 760 T800 760 T1200 760 T1600 760" style={{ stroke: "var(--wave)" }} strokeWidth="3" fill="none" opacity=".7" />
              <path d="M0 800 Q200 788 400 800 T800 800 T1200 800 T1600 800" style={{ stroke: "var(--wave)" }} strokeWidth="3" fill="none" opacity=".45" />
            </svg>
            {b.hero && <img src={b.hero} alt="" />}
            <div className="hero-copy">
              <h1>{b.headline}</h1>
              <p>{b.sub}</p>
              <div className="actions">
                {sectionOn(b, "ponuky") && <a className="btn btn-primary" href="#ponuky">Pozrieť ponuky</a>}
                {oc
                  ? <OpenFormLink className={"btn " + (sectionOn(b, "ponuky") ? "btn-ghost" : "btn-primary")}>Zistiť cenu nehnuteľnosti</OpenFormLink>
                  : <a className="btn btn-ghost" href={`tel:${tel}`}>Zavolať</a>}
              </div>
            </div>
          </div>
          {sectionOn(b, "dovera") && (
            <div className="trust" aria-label="Dôvera">
              {b.trust.map((t, i) => <div key={i}><b>{t.b}</b><small>{t.s}</small></div>)}
            </div>
          )}
        </div></section>

        {sectionOn(b, "ponuky") && (
          <section id="ponuky"><div className="wrap">
            <div className="sec-head"><div><div className="eyebrow">Aktuálne</div><h2>Ponuky</h2></div><a href={b.listingsUrl || BR.url}>Všetky ponuky →</a></div>
            <Listings d={b} note={`Aktuálne ponuky makléra z vianemareal.eu (ponukové ceny, stav k ${BR.asOf}). Na živom webe sa aktualizujú automaticky.`} />
          </div></section>
        )}

        {sectionOn(b, "omne") && (
          <section id="o-mne"><div className="wrap about">
            <div className="ph">Portrét{b.portrait && <img src={b.portrait} alt={b.name} />}</div>
            <div>
              <div className="eyebrow">O mne</div>
              <h2>{b.name}</h2>
              <p className="lede">{b.role}</p>
              <p style={{ marginTop: 16 }}>{b.bio1}</p>
              {b.bio2 && <p>{b.bio2}</p>}
              <div className="chips">{b.chips.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>
              {inTeam && M && <div className="teamline">Som súčasťou tímu Vianema Bratislava. Pobočku vedie <a href={mUrl}>{M.name}</a> — <a href="#tim">celý tím</a>.</div>}
            </div>
          </div></section>
        )}

        {sectionOn(b, "partneri") && (
          <section id="partneri"><div className="wrap">
            <div className="sec-head">
              <div><div className="eyebrow">S kým pracujem</div><h2>Celý predaj cez jedného človeka</h2></div>
              <div className="lede" style={{ maxWidth: "40ch" }}>Odborníkov okolo predaja mám overených rokmi. Koordinujem ich ja — vy riešite jedno telefónne číslo.</div>
            </div>
            <div className="grid3">
              <div className="partner"><h3>Profesionálny fotograf a dron</h3><p>Fotky a video, ktoré predávajú. Prvý dojem z inzerátu rozhoduje, či vám kupujúci vôbec zavolá.</p></div>
              <div className="partner"><h3>Home staging</h3><p>Príprava nehnuteľnosti pred fotením a obhliadkami — vyššia cena a rýchlejší predaj.</p></div>
              <div className="partner"><h3>Advokátska kancelária</h3><p>Kúpna zmluva, úschova kúpnej ceny a návrh na vklad do katastra. Peniaze aj papiere v poriadku skôr, než čokoľvek podpíšete.</p></div>
              <div className="partner"><h3>Súdny znalec</h3><p>Znalecký posudok, ktorý kupujúci potrebuje k hypotéke — bez týždňov čakania, ktoré obchod zdržia.</p></div>
              <div className="partner"><h3>Geodet</h3><p>Geometrický plán, zameranie a vytýčenie hraníc pri domoch a pozemkoch. Kataster bez prekvapení.</p></div>
              <div className="partner"><h3>Hypotekárny špecialista</h3><p>Financovanie pre kupujúceho vybavené vopred, aby obchod nespadol na úvere v poslednej chvíli.</p></div>
            </div>
          </div></section>
        )}

        {inTeam && (
          <section id="tim"><div className="wrap">
            <div className="sec-head"><div><div className="eyebrow">Vianema · pobočka Bratislava</div><h2>Tím, s ktorým pracujem</h2></div><a href={BR.url}>Pobočka na vianema.eu →</a></div>
            <div className="team">
              {M && (
                <div className="member lead">
                  <div className="top"><div className="avatar">{initials(M.name)}{M.portrait && <img src={M.portrait} alt="" />}</div><div><h3>{M.name}</h3><div className="role">{M.role}</div></div></div>
                  <div className="areas-s">{M.areas.slice(0, 3).join(" · ")}</div>
                  <div><span className="badge">Manažér pobočky</span></div>
                  <div className="go"><a className="btn btn-primary" href={mUrl}>Web manažéra →</a><a className="btn btn-ghost" href={`tel:${telFrom(M.phone)}`}>Zavolať</a></div>
                </div>
              )}
              {team.map(r => {
                const m = r.data as MaklerData;
                return (
                  <div key={r.id} className="member">
                    <div className="top"><div className="avatar">{initials(m.name)}{m.portrait && <img src={m.portrait} alt="" />}</div><div><h3>{m.name}</h3><div className="role">{m.role}</div></div></div>
                    <div className="areas-s">{m.areas.slice(0, 3).join(" · ")}</div>
                    <div className="go">
                      {r.isPublished && <a className="btn btn-primary" href={r.url}>Web makléra →</a>}
                      <a className="btn btn-ghost" href={`tel:${telFrom(m.phone)}`}>Zavolať</a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div></section>
        )}

        {sectionOn(b, "videa") && (
          <section id="videa"><div className="wrap">
            <div className="sec-head"><div><div className="eyebrow">Z Instagramu</div><h2>Videá</h2></div><a href={b.ig || "#"}>Sledovať na Instagrame →</a></div>
            <div className="grid3">{b.videos.slice(0, 3).map((v, i) => <div key={i} className="card"><div className="ph portrait"><span className="tag">Reel</span>{v}</div></div>)}</div>
            <div className="example">{BR.videosNote}</div>
          </div></section>
        )}

        {sectionOn(b, "referencie") && <Reviews d={b} btnClass="btn btn-ghost" note="Recenzie z Google (s odkazom na originál)." />}

        {sectionOn(b, "predane") && (
          <section id="predane"><div className="wrap">
            <div className="sec-head"><div><div className="eyebrow">Výsledky</div><h2>Vybrané predané nehnuteľnosti</h2></div></div>
            <Sold d={b} note="Pri nových ponukách sa počet dní počíta automaticky zo zmeny stavu na vianema.eu." />
          </div></section>
        )}

        {oc && <LeadForm siteSlug={site.slug} variant="makler" preview={preview}
          valText="Rozbor od makléra do 24 hodín — nie automatické číslo. Vyplnenie zaberie 2 minúty, nič nepodpisujete."
          gdpr={BR.gdpr} doneText="Ďakujeme. Ozveme sa do 24 hodín." doneMeta={`Dopyt ide priamo maklérovi: ${b.email}`} />}

        {sectionOn(b, "lokality") && (
          <section id="lokality"><div className="wrap">
            <Sky id={sky} className="sky sky-head" />
            <div className="sec-head"><div><div className="eyebrow">Kde predávam</div><h2>Lokality</h2></div></div>
            <div className="areas">{b.areas.map((a, i) => <a key={i} href="#">{a}</a>)}</div>
            <div className="example">{BR.areasNote}</div>
          </div></section>
        )}
      </div>

      <div className="mw-footer" id="kontakt">
        <div className="wrap foot">
          <div>
            <div className="brand">{b.name}</div><span>{b.role}</span><br />
            <span>{b.branch ? b.branch : <>{BR.line}{M && <> · manažér pobočky <a href={mUrl}>{M.name}</a></>}</>}</span>
          </div>
          <div className="actions">
            <a className="btn btn-ghost" href={`tel:${tel}`}>Zavolať</a>
            <a className="btn btn-ghost" href={wa}>WhatsApp</a>
            <a className="btn btn-ghost" href={`mailto:${b.email}`}>E‑mail</a>
          </div>
        </div>
        <div className="wrap"><Sky id={sky} className="sky sky-foot" /></div>
      </div>

      <div className="bar" aria-label="Rýchly kontakt">
        <a className="btn btn-wa" href={wa}>WhatsApp</a>
        {oc ? <OpenFormLink className="btn btn-primary">Zistiť cenu</OpenFormLink> : <a className="btn btn-primary" href={`tel:${tel}`}>Zavolať</a>}
      </div>
    </div>
  );
}

/* ══════════════════════ WEB MANAŽÉRA ══════════════════════ */
function ManazerSite({ site, data: M, refs, nastavenia: BR, preview, dark }: SiteViewProps & { data: ManazerData }) {
  const tel = telFrom(M.phone);
  const wa = "https://wa.me/" + tel.replace("+", "");
  const oc = sectionOn(M, "ocenenie");
  const team = refs.filter(r => r.typ === "makler" && (r.data as MaklerData).team !== false && r.isPublished);
  const teamUrl = team.length ? team[0].url : BR.url;
  const logo = M.logo ? <img src={M.logo} alt={M.name} /> : M.name;

  return (
    <div className="mw" data-theme={dark ? "dark" : undefined}>
      <style dangerouslySetInnerHTML={{ __html: MANAZER_CSS }} />
      <Symbols />
      {preview && <div className="preview-tag">Náhľad rozpracovanej verzie</div>}
      <div className="mw-header"><div className="wrap nav">
        <div className="brandgroup">
          <a className="logo" href="#top" aria-label={`${M.name} — domov`}>{logo}</a>
          <span className="sep" aria-hidden="true" />
          <a className="vianema-link" href={BR.url} aria-label="Vianema, pobočka Bratislava"><svg className="vianema-mark" viewBox="0 0 800 140" aria-hidden="true"><use href="#vianema" /></svg><span>pobočka Bratislava</span></a>
        </div>
        <nav className="menu" aria-label="Hlavné menu">
          {sectionOn(M, "ponuky") && <a href="#ponuky">Ponuky</a>}
          {sectionOn(M, "omne") && <a href="#o-mne">O mne</a>}
          {sectionOn(M, "predane") && <a href="#predane">Predané</a>}
          {sectionOn(M, "tim") && <a href="#tim">Tím</a>}
          {sectionOn(M, "lokality") && <a href="#lokality">Lokality</a>}
          <a className="tel" href={`tel:${tel}`}>{M.phone}</a>
        </nav>
      </div></div>

      <div className="mw-main" id="top">
        <section className="hero"><div className="wrap">
          <div className="hero-grid">
            <div>
              <div className="eyebrow brass">{M.eyebrow}</div>
              <h1 style={{ marginTop: 14 }}>{M.h1}<br /><em>{M.h1em}</em></h1>
              <p className="lede">{M.lede}</p>
              <div className="actions">
                {oc ? <OpenFormLink className="btn btn-solid">Zistiť cenu nehnuteľnosti</OpenFormLink> : <a className="btn btn-solid" href={`tel:${tel}`}>Zavolať</a>}
                {sectionOn(M, "ponuky") && <a className="btn" href="#ponuky">Aktuálne ponuky</a>}
              </div>
            </div>
            <svg className="mark" viewBox="0 0 62.07 60.96" aria-hidden="true" style={{ fill: "currentColor" }}><use href="#am-mark" /></svg>
          </div>
          {sectionOn(M, "dovera") && (
            <div className="facts" style={{ marginTop: 56 }} aria-label="Fakty">
              {M.facts.map((f, i) => <div key={i}><b>{f.b}</b><small>{f.s}</small></div>)}
            </div>
          )}
        </div></section>

        {sectionOn(M, "ako") && (
          <section className="band" id="ako">
            <div className="wrap">
              <div className="sec-head"><div><div className="eyebrow">Ako pracujem</div><h2>{M.stepsTitle}</h2></div></div>
              <div className="steps">{M.steps.map((s, i) => <div key={i} className="step"><div className="n">{s.n}</div><h3>{s.h}</h3><p>{s.p}</p></div>)}</div>
            </div>
            <Sky id="ba" className="sky-bg" />
          </section>
        )}

        {sectionOn(M, "ponuky") && (
          <>
            <section id="ponuky"><div className="wrap">
              <div className="sec-head"><div><div className="eyebrow">Aktuálne</div><h2>Ponuky</h2></div><a href={M.listingsUrl} style={{ fontWeight: 600 }}>Všetky ponuky na vianema.eu →</a></div>
              <Listings d={M} note={`Moje aktuálne ponuky z vianemareal.eu (ponukové ceny, stav k ${BR.asOf}). Na živom webe sa aktualizujú automaticky.`} />
            </div></section>
            <div className="wrap"><div className="rule" /></div>
          </>
        )}

        {sectionOn(M, "omne") && (
          <section id="o-mne"><div className="wrap about">
            <div className="ph">Portrét{M.portrait && <img src={M.portrait} alt={M.name} />}</div>
            <div>
              <div className="eyebrow brass">O mne</div>
              <h2 style={{ margin: "10px 0 18px" }}>{M.name}</h2>
              <p className="big">{M.big}</p>
              <p>{M.bio1}</p>
              {M.bio2 && <p>{M.bio2}</p>}
            </div>
          </div></section>
        )}

        {sectionOn(M, "videa") && (
          <section className="band" id="videa"><div className="wrap">
            <div className="sec-head"><div><div className="eyebrow">Z Instagramu</div><h2>Videá</h2></div><a href={M.ig} style={{ fontWeight: 600 }}>{M.igHandle || "Instagram"} →</a></div>
            <div className="grid3">
              {M.videos.slice(0, 3).map((v, i) => (
                <div key={i} className="card" style={{ background: "transparent", borderColor: "color-mix(in srgb,var(--band-ink) 25%,transparent)" }}>
                  <div className="ph portrait" style={{ background: "color-mix(in srgb,var(--band-ink) 10%,transparent)", color: "var(--band-ink)" }}>
                    <span className="tag" style={{ background: "var(--band-ink)", color: "var(--band)" }}>Reel</span>{v}
                  </div>
                </div>
              ))}
            </div>
            <div className="example muted" style={{ color: "color-mix(in srgb,var(--band-ink) 60%,transparent)" }}>Vždy najnovšie 3 videá — načítavajú sa automaticky z Instagramu.</div>
          </div></section>
        )}

        {sectionOn(M, "referencie") && (
          <>
            <Reviews d={M} btnClass="btn" note={<>Recenzie z Google, kde ma klient spomína menom. <a href={M.googleUrl || "#"}>Všetky recenzie na Google →</a></>} />
            <div className="wrap"><div className="rule" /></div>
          </>
        )}

        {sectionOn(M, "predane") && (
          <section id="predane"><div className="wrap">
            <div className="sec-head"><div><div className="eyebrow brass">Výsledky</div><h2>Vybrané predané nehnuteľnosti</h2></div></div>
            <Sold d={M} bold note={M.soldNote} />
          </div></section>
        )}

        {oc && (
          <>
            <LeadForm siteSlug={site.slug} variant="manazer" preview={preview} valText={M.valText} gdpr={BR.gdpr} doneText={M.doneText} doneMeta={`Dopyt ide priamo na ${M.email}, nikam inam.`} />
            <div className="wrap"><div className="rule" /></div>
          </>
        )}

        {sectionOn(M, "lokality") && (
          <section id="lokality"><div className="wrap">
            <Sky id="ba" className="sky-head" />
            <div className="sec-head"><div><div className="eyebrow">Kde predávam</div><h2>Lokality</h2></div></div>
            <div className="areas">{M.areas.map((a, i) => <a key={i} href="#">{a}</a>)}</div>
            <div className="example">{BR.areasNote}</div>
          </div></section>
        )}

        {sectionOn(M, "tim") && (
          <section id="tim" style={{ paddingTop: 0 }}><div className="wrap">
            <div className="teambox">
              <div>
                <div className="eyebrow brass">Vianema · pobočka Bratislava</div>
                <h3 style={{ marginTop: 6, fontSize: 24 }}>{M.teamTitle}</h3>
                <div className="meta">{M.teamText}</div>
              </div>
              <a className="btn" href={teamUrl}>Spoznať tím →</a>
            </div>
          </div></section>
        )}
      </div>

      <div className="mw-footer" id="kontakt"><div className="wrap">
        <div className="foot">
          <div>
            <a className="logo" href="#top">{logo}</a>
            <div style={{ marginTop: 12 }}>{M.role} · realitný maklér<br />{M.address}</div>
            <a href="https://www.vianemareal.eu" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 16, color: "var(--muted)" }}>
              <svg className="vianema-mark" viewBox="0 0 800 140" aria-hidden="true" style={{ height: 18, width: 103 }}><use href="#vianema" /></svg><span style={{ fontSize: 13 }}>vianemareal.eu</span>
            </a>
          </div>
          <div style={{ display: "grid", gap: 6, fontSize: 15 }}>
            <a href={`tel:${tel}`}>{M.phone}</a>
            <a href={`mailto:${M.email}`}>{M.email}</a>
            {M.ig && <a href={M.ig}>Instagram {M.igHandle}</a>}
            {M.yt && <a href={M.yt}>YouTube</a>}
          </div>
        </div>
        <Sky id="ba" className="sky" style={{ display: "block", fill: "currentColor" }} />
      </div></div>

      <div className="bar" aria-label="Rýchly kontakt">
        <a className="btn btn-wa" href={wa}>WhatsApp</a>
        {oc ? <OpenFormLink className="btn btn-solid">Zistiť cenu</OpenFormLink> : <a className="btn btn-solid" href={`tel:${tel}`}>Zavolať</a>}
      </div>
    </div>
  );
}

export default function SiteView(props: SiteViewProps) {
  if (props.data.typ === "manazer") return <ManazerSite {...props} data={props.data} />;
  return <MaklerSite {...props} data={props.data} />;
}
