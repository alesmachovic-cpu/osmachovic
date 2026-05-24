/**
 * Geocoding helper cez OpenStreetMap Nominatim API.
 *
 * Nominatim je zdarma, žiadny API key. Limit: 1 req/s na user-agent.
 * Pre Vianemu (slovensko, ~100 nehnutelnosti/mes) viac než dosť.
 *
 * Použitie:
 *   const result = await geocodeAddress("Petržalka, Bratislava");
 *   if (result) { saveToDb({ lat: result.lat, lng: result.lng }); }
 *
 * Hranice (Slovensko, WGS84):
 *   lat 47.7–49.6, lng 16.8–22.6
 * — outside box odmietneme (Nominatim by ináč mohol vrátiť česky alebo poľský trefa).
 */

export type GeocodeResult = {
  lat: number;
  lng: number;
  display_name: string;
};

const SK_BBOX = { lat_min: 47.7, lat_max: 49.7, lng_min: 16.8, lng_max: 22.6 };

function isInSlovakia(lat: number, lng: number): boolean {
  return lat >= SK_BBOX.lat_min && lat <= SK_BBOX.lat_max
      && lng >= SK_BBOX.lng_min && lng <= SK_BBOX.lng_max;
}

/**
 * Geokóduj adresu cez Nominatim. Vráti null ak nenašiel alebo je mimo SR.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  if (!query || query.trim().length < 3) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Slovensko`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "sk");
  url.searchParams.set("accept-language", "sk");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim vyžaduje vlastný User-Agent (ich rule).
        "User-Agent": "VIANEMA-CRM/1.0 (vianema.amgd.sk)",
      },
      // 5s timeout je rozumné — Nominatim zvykne odpovedať pod 1s.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const arr = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const lat = parseFloat(arr[0].lat);
    const lng = parseFloat(arr[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!isInSlovakia(lat, lng)) return null;
    return { lat, lng, display_name: arr[0].display_name };
  } catch {
    return null;
  }
}

/**
 * Vzdialenosť medzi dvoma GPS bodmi v kilometroch (haversine formula).
 * Stačí pre matching algoritmus — presnosť ±0.5% pre vzdialenosti < 1000 km.
 */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
