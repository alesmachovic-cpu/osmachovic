import { supabase } from "./supabase";

/** Výstup uploadu jednej fotky — verejné URL-s z Supabase Storage. */
export type UploadedPhoto = {
  name: string;
  url: string;        // 1600px JPEG q 0.85
  thumb: string;      // 400px JPEG q 0.80
  path: string;       // Storage path (pre prípadné mazanie)
  size: number;       // bytes veľkej verzie
};

/** Resize bitmapy cez canvas. Vráti blob v požadovanej kvalite. */
async function resizeToBlob(file: File, maxW: number, quality: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return await new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      b => b ? res(b) : rej(new Error("toBlob failed")),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Resize na dve varianty (1600px veľká, 400px thumbnail) a upload do
 * Storage bucketu `inzerat-fotky`. Vráti verejné URL-s.
 *
 * Cesta v bucketi: {userId}/{inzeratId-or-draft}/{timestamp}-{random}.jpg
 */
export async function uploadFoto(
  file: File,
  opts: { userId: string; inzeratId?: string | null },
): Promise<UploadedPhoto> {
  const folder = opts.inzeratId || "draft";
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now();
  const baseName = `${opts.userId}/${folder}/${ts}-${rnd}`;
  const pathLarge = `${baseName}.jpg`;
  const pathThumb = `${baseName}-thumb.jpg`;

  const [large, thumb] = await Promise.all([
    resizeToBlob(file, 1600, 0.85),
    resizeToBlob(file, 400, 0.8),
  ]);

  const [upLarge, upThumb] = await Promise.all([
    supabase.storage.from("inzerat-fotky").upload(pathLarge, large, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    }),
    supabase.storage.from("inzerat-fotky").upload(pathThumb, thumb, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    }),
  ]);
  if (upLarge.error) throw upLarge.error;
  if (upThumb.error) throw upThumb.error;

  const { data: pubLarge } = supabase.storage.from("inzerat-fotky").getPublicUrl(pathLarge);
  const { data: pubThumb } = supabase.storage.from("inzerat-fotky").getPublicUrl(pathThumb);

  return {
    name: file.name,
    url: pubLarge.publicUrl,
    thumb: pubThumb.publicUrl,
    path: pathLarge,
    size: large.size,
  };
}

/** Zmaže fotku zo Storage (veľkú aj thumb podľa konvencie názvu). */
export async function deleteFoto(path: string): Promise<void> {
  const thumbPath = path.replace(/\.jpg$/i, "-thumb.jpg");
  await supabase.storage.from("inzerat-fotky").remove([path, thumbPath]);
}

/**
 * Parsuje YouTube alebo Vimeo URL a vráti embed-friendly link.
 * Vracia `null` ak to nie je podporovaný video link.
 */
export function normalizeVideoUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // YouTube (watch?v= / youtu.be / shorts / embed)
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://vimeo.com/${vm[1]}`;
  return null;
}

/**
 * Detekuje 3D tour link (Matterport, Kuula, ottohome, iDoma virtuálka).
 * Vráti normalizovaný URL alebo null.
 */
export function normalizeTour3D(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/matterport\.com|my\.matterport\.com|kuula\.co|ottohome|idomaplus|virtualka/i.test(url)) {
    return url;
  }
  return null;
}
