import { NextRequest, NextResponse } from "next/server";
import { searchStreets } from "@/lib/streets-db";

// In-memory cache for Overpass results (server-side)
const overpassCache = new Map<string, { streets: string[]; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Locality → city name mapping for Overpass queries
const LOKALITA_TO_CITY: Record<string, string> = {
  "Bratislava I": "Bratislava",
  "Bratislava II": "Bratislava",
  "Bratislava III": "Bratislava",
  "Bratislava IV": "Bratislava",
  "Bratislava V": "Bratislava",
  "Košice I": "Košice",
  "Košice II": "Košice",
  "Košice III": "Košice",
  "Košice IV": "Košice",
};

// Normalize for matching
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Try Overpass API for streets in a specific city (with cache)
async function fetchOverpassStreets(cityName: string): Promise<string[]> {
  const cached = overpassCache.get(cityName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.streets;

  try {
    const query = `[out:json][timeout:15];area["name"="${cityName}"]["boundary"="administrative"]->.city;way["highway"]["name"](area.city);out tags;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const streets = [...new Set(
      (data.elements || [])
        .map((el: { tags?: { name?: string } }) => el.tags?.name || "")
        .filter((n: string) => n.length > 1)
    )].sort() as string[];

    overpassCache.set(cityName, { streets, ts: Date.now() });
    return streets;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const lokalita = req.nextUrl.searchParams.get("lokalita") || "";
  if (q.length < 2) return NextResponse.json([]);

  const qNorm = normalize(q);

  // 1) Try local DB first (fast, instant)
  const localResults = searchStreets(q, lokalita || undefined);

  // 2) Also try Overpass for the city (async, cached)
  let overpassResults: { street: string; lokalita: string; city: string }[] = [];
  const cityName = LOKALITA_TO_CITY[lokalita] || lokalita || "";

  if (cityName) {
    try {
      const osStreets = await fetchOverpassStreets(cityName);
      const matched = osStreets
        .filter(s => {
          const sNorm = normalize(s);
          return sNorm.startsWith(qNorm) || sNorm.includes(qNorm) ||
            sNorm.split(/\s+/).some(w => w.startsWith(qNorm));
        })
        .slice(0, 10)
        .map(s => ({ street: s, lokalita: lokalita || cityName, city: cityName }));
      overpassResults = matched;
    } catch { /* silent */ }
  }

  // Merge: local first, then overpass (deduplicated)
  const seen = new Set<string>();
  const merged: { label: string; street: string; city: string; lokalita: string }[] = [];

  for (const entry of [...localResults, ...overpassResults]) {
    const key = normalize(entry.street);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        label: entry.city ? `${entry.street}, ${entry.city}` : entry.street,
        street: entry.street,
        city: entry.city,
        lokalita: entry.lokalita,
      });
    }
    if (merged.length >= 8) break;
  }

  return NextResponse.json(merged);
}
