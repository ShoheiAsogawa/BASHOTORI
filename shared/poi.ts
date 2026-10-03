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
  return `${prefecture?.trim() || ''}|${cleanFacilityQuery(facilityName)}`;
}

/** 視察メモ用の接頭辞を外して、店舗名として検索できる文字列にする。 */
export function cleanFacilityQuery(name: string): string {
  let value = name.normalize('NFKC').trim();
  for (let i = 0; i < 4; i += 1) {
    const next = value
      .replace(/^[SABCD]より[)）]\s*/, '')
      .replace(/^日帰り[)）]\s*/, '')
      .replace(/^場所取る\s*/, '')
      .trim();
    if (next === value) break;
    value = next;
  }
  return value;
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
  const normalizedQuery = normalizeName(cleanFacilityQuery(query));
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
  const trimmed = cleanFacilityQuery(query);
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
  const direct = await suggestPlaces(facilityName, 8, signal);
  const best = pickBestPlace(facilityName, prefecture, direct);
  if (best) return best;

  // 「ヤマナカ小田井」のように店名と地名が連結されていると、そのままでは 0 件になる。
  // 間に空白を入れて再検索し、元の店舗名を含む候補だけを採用する。
  const query = cleanFacilityQuery(facilityName);
  let tried = 0;
  for (let index = 2; index <= query.length - 2 && tried < 6; index += 1) {
    tried += 1;
    const spaced = `${query.slice(0, index)} ${query.slice(index)}`;
    try {
      const places = await suggestPlaces(spaced, 8, signal);
      const picked = pickBestPlace(facilityName, prefecture, places);
      if (picked) return picked;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  return null;
}
