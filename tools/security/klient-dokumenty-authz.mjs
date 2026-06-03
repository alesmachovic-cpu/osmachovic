#!/usr/bin/env node
/**
 * Request-level authorization test pre /api/klient-dokumenty (F1 + #5).
 *
 * Testuje IZOLÁCIU MEDZI FIRMAMI priamo na úrovni HTTP requestu (nie cez UI):
 * maklér firmy B NESMIE čítať/mazať dokumenty klienta firmy A. Toto je presne
 * tá cross-tenant IDOR diera, ktorú sme zalepili (F1).
 *
 * Potrebuje (od CEO, cez env — heslá nikdy v skripte):
 *   COOKIE_A   — hodnota `Cookie` hlavičky prihláseného makléra FIRMY A
 *   COOKIE_B   — hodnota `Cookie` hlavičky prihláseného makléra FIRMY B
 *   KLIENT_A   — UUID klienta patriaceho FIRME A
 *   DOC_A      — (voliteľné) UUID dokumentu firmy A na test DELETE izolácie
 *   BASE_URL   — default https://dev.amgd.sk
 *
 * Ako získať cookie: prihlás sa v prehliadači → DevTools → Network → ktorýkoľvek
 * request → skopíruj hlavičku `Cookie` (obsahuje crm_session). 2 rôzne firmy =
 * 2 rôzni makléri.
 *
 * Spustenie:
 *   COOKIE_A='crm_session=...' COOKIE_B='crm_session=...' KLIENT_A='uuid' \
 *     node tools/security/klient-dokumenty-authz.mjs
 *
 * Exit 1 ak ktorýkoľvek izolačný invariant zlyhá.
 */
const BASE_URL = process.env.BASE_URL || "https://dev.amgd.sk";
const { COOKIE_A, COOKIE_B, KLIENT_A, DOC_A } = process.env;

if (!COOKIE_A || !COOKIE_B || !KLIENT_A) {
  console.error("Chýba COOKIE_A / COOKIE_B / KLIENT_A v env. Pozri hlavičku skriptu.");
  process.exit(2);
}

let failures = 0;
function check(name, pass, detail) {
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
}

async function req(method, path, cookie) {
  const res = await fetch(BASE_URL + path, { method, headers: cookie ? { Cookie: cookie } : {} });
  let body = null; try { body = await res.json(); } catch { /* */ }
  return { status: res.status, body };
}

async function main() {
  console.log(`\nAuthz test /api/klient-dokumenty — ${BASE_URL}\n`);

  // 1) Firma A vidí vlastného klienta — kontrola že test je platný (nie false negatív).
  const aOwn = await req("GET", `/api/klient-dokumenty?klientId=${KLIENT_A}`, COOKIE_A);
  check("Firma A vidí dokumenty vlastného klienta (200)", aOwn.status === 200, `dostal ${aOwn.status}`);

  // 2) ⭐ Firma B NESMIE vidieť klienta firmy A — musí dostať 404 (nie 200).
  const bCross = await req("GET", `/api/klient-dokumenty?klientId=${KLIENT_A}`, COOKIE_B);
  check("Firma B NEVIDÍ dokumenty klienta firmy A (404)", bCross.status === 404,
    bCross.status === 200 ? "🚨 LEAK — firma B dostala dáta!" : `dostal ${bCross.status}`);

  // 3) Bez cookie → 401 (žiadny anonymný prístup).
  const anon = await req("GET", `/api/klient-dokumenty?klientId=${KLIENT_A}`, null);
  check("Anonym (bez cookie) odmietnutý (401)", anon.status === 401, `dostal ${anon.status}`);

  // 4) Firma B NESMIE zmazať dokument firmy A (ak DOC_A zadaný).
  if (DOC_A) {
    const bDel = await req("DELETE", `/api/klient-dokumenty?id=${DOC_A}`, COOKIE_B);
    check("Firma B NEZMAŽE dokument firmy A (404/403)", bDel.status === 404 || bDel.status === 403,
      bDel.status === 200 ? "🚨 LEAK — firma B zmazala cudzí dokument!" : `dostal ${bDel.status}`);
  } else {
    console.log("  ⚠ DELETE izolačný test preskočený (zadaj DOC_A)");
  }

  console.log(failures ? `\nVÝSLEDOK: ✗ ${failures} zlyhanie(í)\n` : "\nVÝSLEDOK: ✓ izolácia OK\n");
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error("Test crash:", e); process.exit(2); });
