#!/usr/bin/env node
/**
 * Regresný + benchmark harness pre AI parsovanie dokumentov (F2).
 *
 * Rieši QA gapy: gold-standard očakávaný výstup (#1), regresný beh pri každej
 * zmene (#2), P50/P95 latencia (#3).
 *
 * Fixtúra = dvojica súborov v ./fixtures/:
 *   <name>.expected.json   — gold standard: polia ktoré MUSIA vyjsť (+ hodnoty)
 *   <name>.pdf             — reálny dokument (najmä skeny), ALEBO
 *   <name>.source.txt      — text ktorý harness vyrenderuje do PDF (syntetická fixtúra)
 *
 * Spustenie:
 *   node tools/parse-regression/run.mjs                 # proti dev.amgd.sk
 *   BASE_URL=http://localhost:3000 node ...run.mjs      # proti lokálu
 *   RUNS=3 node ...run.mjs                              # 3 behy/fixtúra pre latenciu
 *
 * Exit code 1 ak akákoľvek fixtúra spadne pod prah presnosti (ACCURACY_MIN).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");
const BASE_URL = process.env.BASE_URL || "https://dev.amgd.sk";
const ENDPOINT = process.env.ENDPOINT || "/api/parse-lv";
const RUNS = parseInt(process.env.RUNS || "1", 10);
const ACCURACY_MIN = parseFloat(process.env.ACCURACY_MIN || "0.90"); // 90 % polí (prísnejšie)
const LATENCY_P95_MAX_MS = parseInt(process.env.LATENCY_P95_MAX_MS || "30000", 10); // p95 < 30s
const AUTH_COOKIE = process.env.AUTH_COOKIE || ""; // pre multipart (parse-doc vyžaduje auth)

/** Normalizuj hodnotu na porovnanie (case/diakritika/medzery/čísla). */
function norm(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
function numClose(a, b) {
  const na = parseFloat(String(a).replace(",", ".")); const nb = parseFloat(String(b).replace(",", "."));
  if (Number.isNaN(na) || Number.isNaN(nb)) return false;
  return Math.abs(na - nb) <= Math.max(0.1, Math.abs(nb) * 0.02); // 2 % tolerancia
}
function fieldMatch(expected, actual) {
  if (actual === undefined || actual === null || norm(actual) === "") return "missing";
  if (typeof expected === "number" || /^\d+([.,]\d+)?$/.test(String(expected))) {
    return numClose(actual, expected) ? "ok" : "wrong";
  }
  const ne = norm(expected); const na = norm(actual);
  return (na.includes(ne) || ne.includes(na)) ? "ok" : "wrong";
}

/** Porovná vlastníkov (pole). Každý očakávaný vlastník musí mať match na meno + dátum nar. */
function scoreOwners(expOwners, actOwners) {
  const res = [];
  for (const eo of expOwners) {
    const hit = (actOwners || []).find(ao => fieldMatch(eo.meno, ao.meno) === "ok");
    if (!hit) { res.push({ owner: eo.meno, status: "missing" }); continue; }
    const dobOk = !eo.datum_narodenia || fieldMatch(eo.datum_narodenia, hit.datum_narodenia) === "ok";
    res.push({ owner: eo.meno, status: dobOk ? "ok" : "dob_wrong" });
  }
  return res;
}

async function renderPdf(sourceText) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 15;
  for (const line of sourceText.split("\n")) { doc.text(line, 10, y); y += 7; }
  return Buffer.from(doc.output("arraybuffer")).toString("base64");
}

async function callParse(pdfBase64) {
  const t0 = Date.now();
  const res = await fetch(BASE_URL + ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf_base64: pdfBase64, doc_type: "lv" }),
  });
  const ms = Date.now() - t0;
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, ms, json };
}

/** Multipart volanie (docx/pdf priamo na parse-doc, vyžaduje auth cookie). */
async function callMultipart(buffer, filename, mime, endpoint) {
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: mime }), filename);
  const t0 = Date.now();
  const res = await fetch(BASE_URL + endpoint, { method: "POST", headers: AUTH_COOKIE ? { Cookie: AUTH_COOKIE } : {}, body: fd });
  const ms = Date.now() - t0;
  let json = null; try { json = await res.json(); } catch { /* */ }
  return { ok: res.ok, status: res.status, ms, json };
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function main() {
  const names = [...new Set(fs.readdirSync(FIXTURES)
    .filter(f => f.endsWith(".expected.json"))
    .map(f => f.replace(".expected.json", "")))];
  if (!names.length) { console.error("Žiadne fixtúry v " + FIXTURES); process.exit(2); }

  console.log(`\nParse regression — ${BASE_URL}${ENDPOINT} | ${names.length} fixtúr | ${RUNS} beh/fixtúra\n`);
  const allLatencies = [];
  let anyFail = false;

  for (const name of names) {
    const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.expected.json`), "utf8"));
    // Režim fixtúry: default json-pdf (parse-lv). Pre docx daj <name>.meta.json
    // s {"mode":"multipart","endpoint":"/api/parse-doc"} + súbor <name>.docx.
    const metaPath = path.join(FIXTURES, `${name}.meta.json`);
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
    const mode = meta.mode || "json-pdf";
    let runOnce;
    if (mode === "multipart") {
      const docxPath = path.join(FIXTURES, `${name}.docx`);
      const pPath = path.join(FIXTURES, `${name}.pdf`);
      let buf, fname, mime;
      if (fs.existsSync(docxPath)) { buf = fs.readFileSync(docxPath); fname = `${name}.docx`; mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; }
      else if (fs.existsSync(pPath)) { buf = fs.readFileSync(pPath); fname = `${name}.pdf`; mime = "application/pdf"; }
      else { console.error(`  ✗ ${name}: multipart mód — chýba .docx/.pdf`); anyFail = true; continue; }
      if (!AUTH_COOKIE) { console.log(`  ⚠ ${name}: preskočené — multipart vyžaduje AUTH_COOKIE`); continue; }
      const endpoint = meta.endpoint || "/api/parse-doc";
      runOnce = () => callMultipart(buf, fname, mime, endpoint);
    } else {
      let pdfB64;
      const pdfPath = path.join(FIXTURES, `${name}.pdf`);
      const txtPath = path.join(FIXTURES, `${name}.source.txt`);
      if (fs.existsSync(pdfPath)) pdfB64 = fs.readFileSync(pdfPath).toString("base64");
      else if (fs.existsSync(txtPath)) pdfB64 = await renderPdf(fs.readFileSync(txtPath, "utf8"));
      else { console.error(`  ✗ ${name}: chýba .pdf aj .source.txt`); anyFail = true; continue; }
      runOnce = () => callParse(pdfB64);
    }

    // viac behov pre latenciu, posledný výsledok skórujeme
    let last = null; const lats = [];
    for (let i = 0; i < RUNS; i++) { last = await runOnce(); lats.push(last.ms); allLatencies.push(last.ms); }

    if (!last.ok || !last.json) {
      console.log(`  ✗ ${name}: HTTP ${last.status} (${last.ms}ms) — ${JSON.stringify(last.json)?.slice(0, 120)}`);
      anyFail = true; continue;
    }

    // skórovanie polí
    const scalarFields = Object.keys(expected).filter(k => k !== "majitelia" && !k.startsWith("_"));
    const detail = [];
    let ok = 0;
    for (const k of scalarFields) {
      const st = fieldMatch(expected[k], last.json[k]);
      if (st === "ok") ok++; else detail.push(`${k}=${st}(${last.json[k] ?? "—"})`);
    }
    let ownerLine = "";
    if (expected.majitelia) {
      const os = scoreOwners(expected.majitelia, last.json.majitelia);
      const ownersOk = os.filter(o => o.status === "ok").length;
      ownerLine = ` | vlastníci ${ownersOk}/${os.length}` + (ownersOk < os.length ? ` (${os.filter(o=>o.status!=="ok").map(o=>o.owner+":"+o.status).join(", ")})` : "");
      // vlastníci sa rátajú ako jedno pole do presnosti
      scalarFields.push("majitelia"); if (ownersOk === os.length) ok++;
    }
    const acc = ok / scalarFields.length;
    const p95 = percentile(lats, 95);
    const pass = acc >= ACCURACY_MIN;
    if (!pass) anyFail = true;
    console.log(`  ${pass ? "✓" : "✗"} ${name}: presnosť ${(acc * 100).toFixed(0)}% (${ok}/${scalarFields.length}) | p95 ${p95}ms${ownerLine}`);
    if (detail.length) console.log(`      chýba/zle: ${detail.join(", ")}`);
  }

  console.log(`\n── Latencia naprieč ${allLatencies.length} behmi: p50 ${percentile(allLatencies, 50)}ms | p95 ${percentile(allLatencies, 95)}ms | max ${Math.max(...allLatencies, 0)}ms`);
  if (percentile(allLatencies, 95) > LATENCY_P95_MAX_MS) { console.log(`  ✗ p95 prekročilo limit ${LATENCY_P95_MAX_MS}ms`); anyFail = true; }
  console.log(anyFail ? "\nVÝSLEDOK: ✗ FAIL\n" : "\nVÝSLEDOK: ✓ PASS\n");
  process.exit(anyFail ? 1 : 0);
}
main().catch(e => { console.error("Harness crash:", e); process.exit(2); });
