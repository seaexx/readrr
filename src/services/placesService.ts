// City search — Photon (https://photon.komoot.io), a free OpenStreetMap geocoder.
// Worldwide, no API key. Used for the city autocomplete in Edit Profile.

export interface CityResult {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
  label: string; // "Manchester, England, United Kingdom"
  latitude: number;
  longitude: number;
}

const PHOTON_API = 'https://photon.komoot.io/api/';
const REQUEST_TIMEOUT_MS = 6000;

// Returns [] on any failure so the UI can simply show no suggestions.
export async function searchCities(query: string): Promise<CityResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${PHOTON_API}?q=${encodeURIComponent(q)}&limit=6&layer=city&lang=en`;
    const res = await fetch(url, { signal: controller.signal });
    const json = await res.json();
    const seen = new Set<string>();
    const results: CityResult[] = [];
    for (const f of (json?.features as any[]) || []) {
      const p = f?.properties || {};
      const [longitude, latitude] = f?.geometry?.coordinates || [];
      if (!p.name || typeof latitude !== 'number') continue;
      const label = [p.name, p.state, p.country].filter(Boolean).join(', ');
      if (seen.has(label)) continue;
      seen.add(label);
      results.push({
        id: `${p.osm_type}${p.osm_id}`,
        name: p.name,
        region: p.state ?? null,
        country: p.country ?? null,
        label,
        latitude,
        longitude,
      });
    }
    return results;
  } catch (e: any) {
    console.log('City search failed:', e?.message || e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Short form saved on the profile, e.g. "Manchester, United Kingdom".
export function cityDisplayName(c: CityResult): string {
  return [c.name, c.country].filter(Boolean).join(', ');
}
