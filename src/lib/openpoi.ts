export interface PoiPlace {
  name: string;
  address: string;
  prefecture: string;
  city: string;
  latitude: number;
  longitude: number;
  level: number | null;
  licenses: string[];
  attributions: string[];
}

const SUGGEST_URL = 'https://api.openpoiapi.com/v1/suggest';
const CACHE_KEY = 'bashotori-openpoi-v1';
const MIN_SCORE = 70;

interface SuggestResponse {
  suggestions?: Array<{
    name?: string;
    address?: string;
    prefecture?: string;
    city?: string;
    lat?: number | string;
    lng?: number | string;
    level?: number | string | null;
    licenses?: unknown;
    attributions?: unknown;
  }>;
}

export function locationKey(facilityName: string, prefecture?: string): string {
  return `${prefecture?.trim() || ''}|${facilityName.trim()}`;
}

function normalizeName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s・･]+/g, '');
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function toNumber(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toLevel(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function scorePlace(query: string, prefecture: string | undefined, place: PoiPlace): number {
  const normalizedQuery = normalizeName(query);
  const name = normalizeName(place.name);
  if (!normalizedQuery || !name) return 0;

  let score = 0;
  if (name === normalizedQuery) score = 200;
  else if (name.startsWith(normalizedQuery) || normalizedQuery.startsWith(name)) score = 140;
  else if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) score = 70;
  else return 0;

  if (prefecture) {
    const haystack = `${place.prefecture}${place.city}${place.address}`;
    if (haystack.includes(prefecture)) score += 30;
    else if (place.prefecture && place.prefecture !== prefecture) score -= 100;
  }

  if (place.level !== null) score += place.level;
  return score;
}

export function pickBestPlace(query: string, prefecture: string | undefined, places: PoiPlace[]): PoiPlace | null {
  let best: { place: PoiPlace; score: number } | null = null;
  for (const place of places) {
    const score = scorePlace(query, prefecture, place);
    if (score < MIN_SCORE) continue;
    if (!best || score > best.score) best = { place, score };
  }
  return best?.place ?? null;
}

export async function suggestPlaces(query: string, limit = 8, signal?: AbortSignal): Promise<PoiPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(SUGGEST_URL);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`OpenPOI API request failed: ${response.status}`);
  }

  const data = (await response.json()) as SuggestResponse;
  const places: PoiPlace[] = [];
  for (const item of data.suggestions ?? []) {
    const latitude = toNumber(item.lat);
    const longitude = toNumber(item.lng);
    if (latitude === null || longitude === null || !item.name) continue;
    places.push({
      name: item.name,
      address: item.address || '',
      prefecture: item.prefecture || '',
      city: item.city || '',
      latitude,
      longitude,
      level: toLevel(item.level),
      licenses: stringList(item.licenses),
      attributions: stringList(item.attributions),
    });
  }
  return places;
}

export async function locateFacility(
  facilityName: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<PoiPlace | null> {
  const cached = readPoiCache(facilityName, prefecture);
  if (cached) return cached;

  const places = await suggestPlaces(facilityName, 8, signal);
  const best = pickBestPlace(facilityName, prefecture, places);
  if (best) writePoiCache(facilityName, prefecture, best);
  return best;
}

function cacheMap(): Record<string, PoiPlace> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PoiPlace>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function readPoiCache(facilityName: string, prefecture?: string): PoiPlace | null {
  const hit = cacheMap()[locationKey(facilityName, prefecture)];
  if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
  return hit;
}

export function writePoiCache(facilityName: string, prefecture: string | undefined, place: PoiPlace): void {
  try {
    const next = cacheMap();
    next[locationKey(facilityName, prefecture)] = place;
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // 保存できない環境でも検索結果の表示は続ける
  }
}
