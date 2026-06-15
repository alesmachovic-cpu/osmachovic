import sharp from "sharp";

/**
 * VIANEMA vodotlač pre server-side dávkové spracovanie (sharp) — rovnaký vzhľad
 * ako client-canvas verzia v `inzeratFotky.ts`: biela "VIANEMA" v pravom hornom
 * rohu, ~45 % opacity, ~5 % výšky, jemný tmavý tieň pre čitateľnosť na svetlých
 * fotkách. Používa sa na spätné dávkové watermarkovanie existujúcich fotiek.
 *
 * SVG má rozmer celej fotky a text je umiestnený do pravého horného rohu s
 * paddingom; composite cez celú plochu (top:0,left:0) dá presnú pozíciu rovnako
 * ako canvas `fillText` s `textAlign:"right"`.
 */
function watermarkSvg(w: number, h: number): Buffer {
  const fontPx = Math.max(11, Math.round(h * 0.05));
  const x = w - Math.round(w * 0.04);            // pravý okraj − padding
  const yBase = Math.round(h * 0.05) + fontPx;   // baseline = top padding + výška
  const off = Math.max(1, Math.round(fontPx * 0.06));  // posun tieňa
  const ls = (fontPx * 0.18).toFixed(1);          // letter-spacing v px (ako canvas)
  const font = "Helvetica, Arial, sans-serif";
  const svg =
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${x + off}" y="${yBase + off}" text-anchor="end" font-family="${font}" font-size="${fontPx}" font-weight="500" letter-spacing="${ls}" fill="#000000" fill-opacity="0.32">VIANEMA</text>` +
    `<text x="${x}" y="${yBase}" text-anchor="end" font-family="${font}" font-size="${fontPx}" font-weight="500" letter-spacing="${ls}" fill="#ffffff" fill-opacity="0.45">VIANEMA</text>` +
    `</svg>`;
  return Buffer.from(svg);
}

/**
 * Aplikuj VIANEMA vodotlač na JPEG buffer a vráť nový JPEG buffer (q 0.85).
 *
 * ⚠️ Idempotentné LEN ak je vstup čistý originál. Dávka preto MUSÍ čítať zo
 * zálohy `inzerat-fotky-orig`, nie z už-watermarkovaného `inzerat-fotky`
 * (inak by sa watermark vypálil dvakrát).
 */
export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const img = sharp(input);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("watermark: neznáme rozmery obrázka");
  return await img
    .composite([{ input: watermarkSvg(w, h), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}
