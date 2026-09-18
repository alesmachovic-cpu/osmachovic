/**
 * CSS šablón webov. Píše sa „normálne" (body, header, .card …) a pri načítaní
 * modulu sa každý selektor prefixne `.mw` (wrapper verejného webu), aby sa
 * štýly nebili s globals.css CRM-ka (ktoré definuje --accent, header, main …).
 *
 * Mapovanie: `body` → `.mw`, `:root` → `.mw`.
 */

function scope(css: string, root = ".mw"): string {
  let out = "";
  let i = 0;
  const n = css.length;
  let buf = "";
  const stack: Array<"at" | "rule"> = [];
  while (i < n) {
    const c = css[i];
    if (c === "{") {
      const sel = buf.trim();
      buf = "";
      if (sel.startsWith("@")) {
        stack.push("at");
        out += sel + "{";
      } else {
        stack.push("rule");
        const prefixed = sel.split(",").map(s => {
          s = s.trim();
          if (!s) return s;
          if (s === "body" || s === ":root") return root;
          if (s.startsWith("body")) return root + s.slice(4);
          if (s.startsWith(":root")) return root + s.slice(5);
          return root + " " + s;
        }).join(",");
        out += prefixed + "{";
      }
      i++;
      continue;
    }
    if (c === "}") {
      out += buf + "}";
      buf = "";
      stack.pop();
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  return out + buf;
}

const SKY_AND_FORM = `
.sky{display:block;width:100%;color:var(--muted);fill:currentColor;opacity:.32}
.err{color:#B3261E;font-size:14px;margin-top:4px}
.check{display:flex;gap:10px;align-items:flex-start;font-size:15px}
.check input{margin-top:5px}
.done{text-align:center;padding:10px 0}
`;

export const MAKLER_CSS = scope(`
:root{--p-acc-l:#4F6F52;--p-ink-l:#34503A;--p-soft-l:#E2EBE1;--p-acc-d:#9CC49E;--p-ink-d:#CFE6D0;--p-soft-d:#22302A;--sky1:#16261C;--sky2:#0F1B14;--skyline:#2E4A36;--wave:#3B5E44;--sun:#F1E1B0;--ground:#F2F4F1;--surface:#FFFFFF;--band:#E7E9E3;--ink:#14202A;--muted:#5B6770;--line:#D6DBD7;--accent:var(--p-acc-l);--accent-ink:var(--p-ink-l);--accent-soft:var(--p-soft-l);--ok:#2E6B3F;--ok-soft:#E1EFE4;--radius:10px;--display:var(--font-fraunces),Georgia,'Times New Roman',serif;--body:var(--font-source-sans),'Segoe UI',Helvetica,Arial,sans-serif}
:root[data-palette="dunaj"]{--p-acc-l:#1B5E7B;--p-ink-l:#0F3D52;--p-soft-l:#DDEAF1;--p-acc-d:#6FB3D2;--p-ink-d:#BFE0EE;--p-soft-d:#1D3543;--sky1:#0E2A3A;--sky2:#0A1F2C;--skyline:#1C4C66;--wave:#1F5A76;--sun:#F0D9A6}
:root[data-palette="hrad"]{--p-acc-l:#9B3B2E;--p-ink-l:#6F271E;--p-soft-l:#F3E1DC;--p-acc-d:#E08A7A;--p-ink-d:#F5C9BF;--p-soft-d:#3A2220;--sky1:#2A1714;--sky2:#1C100E;--skyline:#5A2E27;--wave:#6E3A31;--sun:#F3D9A0}
:root[data-palette="park"]{--p-acc-l:#4F6F52;--p-ink-l:#34503A;--p-soft-l:#E2EBE1;--p-acc-d:#9CC49E;--p-ink-d:#CFE6D0;--p-soft-d:#22302A;--sky1:#16261C;--sky2:#0F1B14;--skyline:#2E4A36;--wave:#3B5E44;--sun:#F1E1B0}
:root[data-palette="piesky"]{--p-acc-l:#B0681A;--p-ink-l:#7A4710;--p-soft-l:#F6E9D6;--p-acc-d:#E6A957;--p-ink-d:#F5D8AE;--p-soft-d:#3A2C1A;--sky1:#2B1E10;--sky2:#1D140A;--skyline:#5E4322;--wave:#75552C;--sun:#FFE7B0}
:root[data-palette="kamzik"]{--p-acc-l:#2F5D3A;--p-ink-l:#1F3F27;--p-soft-l:#DFEBE1;--p-acc-d:#8CC79A;--p-ink-d:#C5E5CC;--p-soft-d:#1F2F24;--sky1:#10221A;--sky2:#0A1710;--skyline:#244734;--wave:#2F5A42;--sun:#EFE3B5}
:root[data-palette="mesto"]{--p-acc-l:#157A7A;--p-ink-l:#0E5252;--p-soft-l:#DAEFEF;--p-acc-d:#6FCACA;--p-ink-d:#BFE9E9;--p-soft-d:#183535;--sky1:#0C2626;--sky2:#071A1A;--skyline:#1C4E4E;--wave:#226060;--sun:#F0DFA8}
:root[data-palette="fatra"]{--p-acc-l:#8A6A1E;--p-ink-l:#5C4612;--p-soft-l:#F1EAD6;--p-acc-d:#D8B860;--p-ink-d:#EEDDA6;--p-soft-d:#332B18;--sky1:#1B1F24;--sky2:#111418;--skyline:#363C45;--wave:#4A525C;--sun:#E7C466}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0F171E;--surface:#16222B;--band:#1B2831;--ink:#E8ECEF;--muted:#9AA7B1;--line:#27353F;--accent:var(--p-acc-d);--accent-ink:var(--p-ink-d);--accent-soft:var(--p-soft-d);--ok:#8FCB9F;--ok-soft:#1E3327}}
:root[data-theme="dark"]{--ground:#0F171E;--surface:#16222B;--band:#1B2831;--ink:#E8ECEF;--muted:#9AA7B1;--line:#27353F;--accent:var(--p-acc-d);--accent-ink:var(--p-ink-d);--accent-soft:var(--p-soft-d);--ok:#8FCB9F;--ok-soft:#1E3327}
body{margin:0;min-height:100vh;background:var(--ground);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;padding-bottom:84px;color-scheme:light dark}
*{box-sizing:border-box}
a{color:var(--accent);text-decoration:none}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.wrap{max-width:1040px;margin:0 auto;padding-inline:20px}
h1,h2,h3{font-family:var(--display);font-weight:500;line-height:1.1;text-wrap:balance;margin:0}
h2{font-size:clamp(26px,3.2vw,34px);margin-bottom:6px}
h3{font-size:19px}
.eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.lede{color:var(--muted);max-width:60ch;margin:0}
section{padding-block:56px;border-top:1px solid var(--line)}
.sec-head{display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-bottom:26px}
.example{font-size:12px;color:var(--muted);margin-top:14px}
.mw-header{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--ground) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;height:64px}
.brand{font-family:var(--display);font-size:20px;font-weight:600;color:var(--ink);letter-spacing:.01em}
.brand span{color:var(--muted);font-family:var(--body);font-weight:400;font-size:15px;margin-left:8px}
.menu{display:flex;gap:22px;align-items:center;font-size:15px}
.menu a{color:var(--ink)}
.menu a.tel{color:var(--accent);font-weight:600;font-variant-numeric:tabular-nums}
@media (max-width:720px){.menu a:not(.tel){display:none}.brand span{display:none}}
.hero{padding-block:36px 56px;border-top:0}
.hero-media{position:relative;border-radius:14px;overflow:hidden;aspect-ratio:16/9;max-width:100%;background:var(--sky1);color:#fff}
.hero-media svg{position:absolute;inset:0;width:100%;height:100%}
.hero-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-copy{position:absolute;left:0;right:0;bottom:0;padding:clamp(20px,4vw,44px);background:linear-gradient(to top,rgba(8,14,20,.86),rgba(8,14,20,0))}
.hero h1{font-size:clamp(30px,5vw,56px);color:#fff;max-width:18ch}
.hero p{color:rgba(255,255,255,.86);margin:12px 0 20px;max-width:52ch;font-size:clamp(15px,1.6vw,18px)}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:var(--radius);font-weight:600;font-size:16px;border:1.5px solid transparent;cursor:pointer;font-family:var(--body);line-height:1.2;background:none;text-decoration:none}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-ink)}
.btn-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.btn-ghost:hover{background:var(--surface)}
.hero .btn-ghost{color:#fff;border-color:rgba(255,255,255,.55)}
.hero .btn-ghost:hover{background:rgba(255,255,255,.12)}
.actions{display:flex;gap:10px;flex-wrap:wrap}
.trust{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--line);border-radius:14px;background:var(--surface);margin-top:22px;overflow:hidden}
.trust div{padding:18px 20px;border-left:1px solid var(--line)}
.trust div:first-child{border-left:0}
.trust b{display:block;font-family:var(--display);font-size:26px;font-weight:500;line-height:1.1;margin-bottom:6px;font-variant-numeric:tabular-nums}
.trust small{color:var(--muted);font-size:14px}
@media (max-width:720px){.trust{grid-template-columns:1fr 1fr}.trust div:nth-child(3){border-left:0}.trust div:nth-child(n+3){border-top:1px solid var(--line)}}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
@media (max-width:720px){.grid3{grid-template-columns:1fr}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;color:inherit;display:block}
.ph{background:var(--band);aspect-ratio:4/3;max-width:100%;display:grid;place-items:center;color:var(--muted);font-size:13px;position:relative}
.ph.portrait{aspect-ratio:9/16}
.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ph .tag{position:absolute;left:12px;top:12px;font-size:12px;font-weight:600;background:var(--surface);color:var(--ink);padding:4px 9px;border-radius:999px;border:1px solid var(--line);z-index:1}
.card-body{padding:16px 18px 18px}
.card-body h3{font-size:19px;margin-bottom:4px}
.price{font-weight:600;font-variant-numeric:tabular-nums}
.meta{color:var(--muted);font-size:14px}
.about{display:grid;grid-template-columns:260px 1fr;gap:36px;align-items:start}
@media (max-width:720px){.about{grid-template-columns:1fr}}
.about .ph{aspect-ratio:4/5;border-radius:14px;overflow:hidden}
.about .ph img{object-position:50% 15%}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.chip{font-size:14px;padding:6px 12px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--ink)}
.about p{max-width:62ch;margin:0 0 12px}
.teamline{margin-top:18px;padding:12px 16px;border-radius:12px;background:var(--accent-soft);font-size:15px}
.teamline a{font-weight:600}
.team{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:860px){.team{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.team{grid-template-columns:1fr}}
.member{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:10px}
.member.lead{border-color:var(--accent)}
.member .top{display:flex;gap:12px;align-items:center}
.avatar{width:46px;height:46px;border-radius:50%;background:var(--accent-soft);color:var(--accent-ink);display:grid;place-items:center;font-weight:600;font-size:15px;flex:0 0 auto;overflow:hidden;position:relative}
.avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.member h3{font-size:18px}
.member .role{font-size:14px;color:var(--muted)}
.member .areas-s{font-size:14px;color:var(--muted)}
.member .go{margin-top:auto;display:flex;gap:8px;flex-wrap:wrap}
.member .go .btn{padding:8px 14px;font-size:14px}
.badge{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink)}
.quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
@media (max-width:720px){.quotes{grid-template-columns:1fr}}
blockquote{margin:0;padding:22px;background:var(--surface);border:1px solid var(--line);border-radius:14px;font-family:var(--display);font-size:19px;line-height:1.45}
blockquote footer{font-family:var(--body);font-size:14px;color:var(--muted);margin-top:14px}
.stars{color:#C9962B;letter-spacing:2px;font-size:14px}
.sold{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.sold-row{display:grid;grid-template-columns:1fr 64px 190px;gap:18px;padding:14px 20px;border-top:1px solid var(--line);align-items:center}
.sold-row:first-child{border-top:0}
.sold-row .days{font-variant-numeric:tabular-nums;font-weight:600;color:var(--ok);background:var(--ok-soft);padding:4px 12px;border-radius:999px;font-size:14px;white-space:nowrap;justify-self:end;text-align:center;min-width:170px}
.sold-row .loc{color:var(--muted);font-size:14px}
.sold-row>.loc:nth-child(2){text-align:right}
@media (max-width:560px){.sold-row{grid-template-columns:1fr 150px}.sold-row>.loc:nth-child(2){display:none}.sold-row .days{min-width:0}}
.val{background:var(--accent-soft);border-radius:16px;padding:28px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.val h2{margin:0 0 4px}
.val p{margin:0;color:var(--muted)}
.form{margin-top:18px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:26px;max-width:520px}
.form label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}
.form .f{margin-bottom:16px}
.form input[type=text],.form input[type=tel],.form input[type=number],.form select{width:100%;padding:12px 14px;font-size:16px;font-family:var(--body);border:1.5px solid var(--line);border-radius:var(--radius);background:var(--ground);color:var(--ink)}
.steps{display:flex;gap:8px;margin-bottom:22px}
.steps i{height:4px;flex:1;border-radius:4px;background:var(--line)}
.steps i.on{background:var(--accent)}
.opt-toggle{background:none;border:0;color:var(--accent);font:inherit;font-weight:600;padding:0;cursor:pointer;margin-bottom:16px}
.optional{border-top:1px dashed var(--line);padding-top:14px;margin-bottom:8px}
.optional .hint{font-size:13px;color:var(--muted);margin-bottom:12px}
.done b{display:block;font-family:var(--display);font-size:22px;font-weight:500;margin-top:10px}
.areas{display:flex;gap:10px;flex-wrap:wrap}
.areas a{padding:10px 16px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--ink);font-weight:600;font-size:15px}
.areas a:hover{border-color:var(--accent);color:var(--accent)}
.sky-head{height:56px;margin-bottom:22px}
.sky-foot{height:64px;margin-top:28px;opacity:.22}
.mw-footer{border-top:1px solid var(--line);padding-block:40px;color:var(--muted);font-size:14px}
.foot{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:center}
.foot .brand{font-size:18px}
.bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:var(--surface);border-top:1px solid var(--line);z-index:30}
.bar .btn{flex:1;justify-content:center}
.btn-wa{background:#1F8F4E;color:#fff;border-color:transparent}
.btn-wa:hover{background:#176E3C}
@media (min-width:721px){.bar{left:auto;right:24px;bottom:calc(24px + env(safe-area-inset-bottom,0px));border:1px solid var(--line);border-radius:999px;padding:8px;box-shadow:0 8px 24px rgba(10,20,28,.14)}.bar .btn{flex:0 0 auto;border-radius:999px}body{padding-bottom:96px}}
.preview-tag{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;background:#B3261E;color:#fff;font-family:var(--body)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
${SKY_AND_FORM}
`);

export const MANAZER_CSS = scope(`
:root{--paper:#F3F2EE;--surface:#FFFFFF;--ink:#111111;--muted:#66655F;--line:#D8D6CF;--band:#111111;--band-ink:#F3F2EE;--brass:#A87B1F;--brass-soft:#F1E7CF;--ok:#2E6B3F;--ok-soft:#E1EFE4;--display:var(--font-bricolage),'Helvetica Neue',Arial,sans-serif;--body:var(--font-plex),'Segoe UI',Helvetica,Arial,sans-serif;--logo-filter:none}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#121212;--surface:#1B1B1A;--ink:#F1F0EC;--muted:#A3A29B;--line:#2E2E2B;--band:#F1F0EC;--band-ink:#111111;--brass:#D6B25E;--brass-soft:#2E2816;--ok:#8FCB9F;--ok-soft:#1E3327;--logo-filter:invert(1)}}
:root[data-theme="dark"]{--paper:#121212;--surface:#1B1B1A;--ink:#F1F0EC;--muted:#A3A29B;--line:#2E2E2B;--band:#F1F0EC;--band-ink:#111111;--brass:#D6B25E;--brass-soft:#2E2816;--ok:#8FCB9F;--ok-soft:#1E3327;--logo-filter:invert(1)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;color-scheme:light dark}
a{color:inherit}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--brass);outline-offset:2px}
.wrap{max-width:1080px;margin:0 auto;padding-inline:20px}
h1,h2,h3{font-family:var(--display);line-height:1.02;text-wrap:balance;margin:0;letter-spacing:-.01em}
h2{font-size:clamp(30px,4vw,44px);font-weight:700}
h3{font-size:20px;font-weight:700}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600}
.eyebrow.brass{color:var(--brass)}
section{padding-block:72px}
.sec-head{display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-bottom:30px}
.example{font-size:12px;color:var(--muted);margin-top:14px}
.rule{height:1px;background:var(--line)}
.mw-header{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--paper) 90%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;height:72px}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--display);font-weight:800;font-size:20px}
.logo img{height:42px;width:auto;filter:var(--logo-filter)}
.brandgroup{display:flex;align-items:center;gap:16px}
.brandgroup .sep{width:1px;height:28px;background:var(--line)}
.vianema-mark{display:block;height:15px;width:86px;color:var(--ink);fill:currentColor}
.vianema-link{display:flex;flex-direction:column;gap:3px;text-decoration:none;color:var(--muted);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
@media (max-width:480px){.brandgroup .sep,.vianema-link{display:none}}
.menu{display:flex;gap:24px;align-items:center;font-size:15px;font-weight:500}
.menu a{text-decoration:none}
.menu a.tel{color:var(--brass);font-variant-numeric:tabular-nums}
@media (max-width:760px){.menu a:not(.tel){display:none}}
.hero{padding-block:56px 40px}
.hero-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:40px;align-items:center}
@media (max-width:820px){.hero-grid{grid-template-columns:1fr}}
.hero h1{font-size:clamp(46px,8vw,104px);font-weight:800;line-height:.95}
.hero h1 em{font-style:normal;color:var(--brass)}
.hero .lede{font-size:clamp(17px,1.7vw,21px);color:var(--muted);max-width:52ch;margin:24px 0 28px}
.mark{width:100%;max-width:360px;margin:0 auto;color:var(--ink);display:block}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 22px;border-radius:999px;font-weight:600;font-size:16px;border:1.5px solid var(--ink);cursor:pointer;font-family:var(--body);line-height:1.2;text-decoration:none;background:transparent;color:var(--ink)}
.btn:hover{background:var(--ink);color:var(--paper)}
.btn-solid{background:var(--ink);color:var(--paper)}
.btn-solid:hover{background:var(--brass);border-color:var(--brass);color:#111}
.actions{display:flex;gap:10px;flex-wrap:wrap}
.facts{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--ink);border-bottom:1px solid var(--ink)}
.facts div{padding:22px 18px 22px 0;border-left:1px solid var(--line);padding-left:18px}
.facts div:first-child{border-left:0;padding-left:0}
.facts b{display:block;font-family:var(--display);font-size:38px;font-weight:800;line-height:1;margin-bottom:6px;font-variant-numeric:tabular-nums}
.facts small{color:var(--muted);font-size:14px}
@media (max-width:760px){.facts{grid-template-columns:1fr 1fr}.facts div{padding-left:18px}.facts div:nth-child(odd){border-left:0;padding-left:0}.facts div:nth-child(n+3){border-top:1px solid var(--line)}}
.band{background:var(--band);color:var(--band-ink);position:relative;overflow:hidden;padding-bottom:150px}
.band .wrap{position:relative;z-index:1}
.band .eyebrow{color:color-mix(in srgb,var(--band-ink) 60%,transparent)}
.band .muted{color:color-mix(in srgb,var(--band-ink) 70%,transparent)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
@media (max-width:760px){.steps{grid-template-columns:1fr}}
.step{border-top:2px solid var(--brass);padding-top:16px}
.step .n{font-family:var(--display);font-size:14px;font-weight:700;color:var(--brass);letter-spacing:.1em}
.step h3{margin:8px 0 8px;font-size:22px}
.step p{margin:0;font-size:15.5px;color:color-mix(in srgb,var(--band-ink) 72%,transparent)}
.band .sky-bg{position:absolute;left:50%;transform:translateX(-50%);bottom:-2px;width:min(620px,86%);height:auto;aspect-ratio:1200/220;color:var(--brass);fill:currentColor;opacity:.18;pointer-events:none}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
@media (max-width:760px){.grid3{grid-template-columns:1fr}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:4px;overflow:hidden;text-decoration:none;color:inherit;display:block}
.ph{background:color-mix(in srgb,var(--ink) 6%,var(--surface));aspect-ratio:4/3;max-width:100%;display:grid;place-items:center;color:var(--muted);font-size:13px;position:relative}
.ph.portrait{aspect-ratio:9/16}
.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ph .tag{position:absolute;left:12px;top:12px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;background:var(--ink);color:var(--paper);padding:4px 9px;z-index:1}
.card-body{padding:16px 18px 18px}
.price{font-family:var(--display);font-weight:700;font-size:20px;font-variant-numeric:tabular-nums;margin-top:4px}
.meta{color:var(--muted);font-size:14px}
.about{display:grid;grid-template-columns:300px 1fr;gap:44px;align-items:start}
@media (max-width:760px){.about{grid-template-columns:1fr}}
.about .ph{aspect-ratio:4/5;border-radius:4px;overflow:hidden}
.about .ph img{object-position:50% 20%}
.about p{max-width:62ch;margin:0 0 14px;font-size:17px}
.about .big{font-family:var(--display);font-size:clamp(22px,2.4vw,28px);font-weight:700;line-height:1.25;margin-bottom:18px}
.quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
@media (max-width:760px){.quotes{grid-template-columns:1fr}}
blockquote{margin:0;padding:24px;border:1px solid var(--line);background:var(--surface);font-size:17px;line-height:1.5}
blockquote footer{font-size:14px;color:var(--muted);margin-top:14px}
.stars{color:var(--brass);letter-spacing:2px;font-size:13px}
.sold{border-top:1px solid var(--ink)}
.sold-row{display:grid;grid-template-columns:1fr 64px 190px;gap:18px;padding:16px 0;border-bottom:1px solid var(--line);align-items:center}
.sold-row .days{font-variant-numeric:tabular-nums;font-weight:600;color:var(--ok);background:var(--ok-soft);padding:4px 12px;border-radius:999px;font-size:14px;white-space:nowrap;justify-self:end;text-align:center;min-width:170px}
.sold-row .loc{color:var(--muted);font-size:14px}
.sold-row>.loc:nth-child(2){text-align:right;font-variant-numeric:tabular-nums}
@media (max-width:560px){.sold-row{grid-template-columns:1fr 150px}.sold-row>.loc:nth-child(2){display:none}.sold-row .days{min-width:0}}
.val{border:1.5px solid var(--ink);padding:32px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;border-radius:4px}
.val h2{margin:0 0 6px}
.val p{margin:0;color:var(--muted);max-width:56ch}
.form{margin-top:18px;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:26px;max-width:540px}
.form label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}
.form .f{margin-bottom:16px}
.form input[type=text],.form input[type=tel],.form input[type=number],.form select{width:100%;padding:12px 14px;font-size:16px;font-family:var(--body);border:1.5px solid var(--line);border-radius:4px;background:var(--paper);color:var(--ink)}
.steps-bar{display:flex;gap:8px;margin-bottom:22px}
.steps-bar i{height:3px;flex:1;background:var(--line)}
.steps-bar i.on{background:var(--ink)}
.opt-toggle{background:none;border:0;color:var(--brass);font:inherit;font-weight:600;padding:0;cursor:pointer;margin-bottom:16px}
.optional{border-top:1px dashed var(--line);padding-top:14px;margin-bottom:8px}
.optional .hint{font-size:13px;color:var(--muted);margin-bottom:12px}
.done b{display:block;font-family:var(--display);font-size:24px;font-weight:700;margin-top:10px}
.wide{width:100%;justify-content:center}
.areas{display:flex;gap:10px;flex-wrap:wrap}
.areas a{padding:10px 16px;border:1px solid var(--line);color:var(--ink);font-weight:500;font-size:15px;text-decoration:none;background:var(--surface)}
.areas a:hover{border-color:var(--ink)}
.teambox{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;padding:28px;border:1px solid var(--line);background:var(--surface);border-radius:4px}
.mw-footer{border-top:1px solid var(--ink);padding-block:40px 120px;color:var(--muted);font-size:14px}
.foot{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start}
.foot .logo img{height:56px}
.foot a{color:var(--ink);text-decoration:none}
.sky{width:min(460px,80%);height:auto;aspect-ratio:1200/220;color:var(--brass);opacity:.22;margin:30px auto 0}
.sky-head{display:block;width:min(460px,80%);height:auto;aspect-ratio:1200/220;color:var(--brass);fill:currentColor;opacity:.22;margin:0 auto 26px}
.bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:var(--surface);border-top:1px solid var(--line);z-index:30}
.bar .btn{flex:1;justify-content:center}
.btn-wa{background:#1F8F4E;color:#fff;border-color:#1F8F4E}
.btn-wa:hover{background:#176E3C;border-color:#176E3C;color:#fff}
@media (min-width:761px){.bar{left:auto;right:24px;bottom:calc(24px + env(safe-area-inset-bottom,0px));border:1px solid var(--line);border-radius:999px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.14)}.bar .btn{flex:0 0 auto}}
@media (max-width:760px){body{padding-bottom:84px}}
.preview-tag{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;font-size:12px;font-weight:600;padding:4px 12px;border-radius:999px;background:#B3261E;color:#fff;font-family:var(--body)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
${SKY_AND_FORM}
`);
