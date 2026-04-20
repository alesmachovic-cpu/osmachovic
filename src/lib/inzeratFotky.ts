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
 * Resize na dve varianty (1600px veľká, 400px thumbnail) a upload cez
 * server-side endpoint `/api/fotky/upload` (service role obchádza RLS,
 * keďže CRM používa custom auth, nie Supabase auth session).
 *
 * Cesta v bucketi: {userId}/{inzeratId-or-draft}/{timestamp}-{random}.jpg
 */
export async function uploadFoto(
  file: File,
  opts: { userId: string; inzeratId?: string | null },
): Promise<UploadedPhoto> {
  const [largeBlob, thumbBlob] = await Promise.all([
    resizeToBlob(file, 1600, 0.85),
    resizeToBlob(file, 400, 0.8),
  ]);

  const fd = new FormData();
  fd.append("large", new File([largeBlob], "large.jpg", { type: "image/jpeg" }));
  fd.append("thumb", new File([thumbBlob], "thumb.jpg", { type: "image/jpeg" }));
  fd.append("userId", opts.userId);
  fd.append("inzeratId", opts.inzeratId || "draft");
  fd.append("name", file.name);

  const res = await fetch("/api/fotky/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({ error: "Neplatná odpoveď zo servera" }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

  return {
    name: file.name,
    url: data.url,
    thumb: data.thumb,
    path: data.path,
    size: data.size,
  };
}

/** Zmaže fotku zo Storage (veľkú aj thumb) cez server endpoint. */
export async function deleteFoto(path: string): Promise<void> {
  await fetch(`/api/fotky/upload?path=${encodeURIComponent(path)}`, { method: "DELETE" });
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
