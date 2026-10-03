import { applyAliases, cleanFacilityQuery, pickBestPlace, scorePlace, splitBrand, type PoiPlace } from '../shared/poi.ts';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'BASHOTORI/1.0 (https://bashotori.com)';
const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;

async function waitForTurn(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

interface NominatimItem {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    state?: string;
    province?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    city_district?: string;
    suburb?: string;
    quarter?: string;
    neighbourhood?: string;
    hamlet?: string;
    road?: string;
    house_number?: string;
  };
}

export interface ReversePlace {
  address: string;
  prefecture: string;
  latitude: number;
  longitude: number;
}

/** 連結された店名を、表記ゆれとブランド・地名を離した検索語に展開する。 */
export function nominatimQueries(facilityName: string, prefecture?: string): string[] {
  const cleaned = cleanFacilityQuery(facilityName).replace(/本店$/u, '');
  const aliased = applyAliases(facilityName).replace(/本店$/u, '');
  const forms = aliased === cleaned ? [cleaned] : [cleaned, aliased];
  const area = prefecture?.trim() || '';
  const queries: string[] = [];
  const add = (parts: string[]) => {
    const query = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (query.length >= 2 && !queries.includes(query)) queries.push(query);
  };
  for (const facility of forms) {
    if (facility.length < 2) continue;
    add([facility, area]);
    const { brand, location } = splitBrand(facility);
    if (brand && location.length >= 2) {
      add([brand, location, area]);
      if (location.length >= 4) add([brand, location.slice(0, 2), area]);
      if (location.length >= 6) add([brand, location.slice(0, 3), area]);
    }
  }
  return queries;
}

/** OpenPOI で店が決まらないときだけ使う。ブラウザからは呼ばない。 */
export async function locateByNominatim(
  facilityName: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<PoiPlace | null> {
  const queries = nominatimQueries(facilityName, prefecture);
  const places: PoiPlace[] = [];
  let best: PoiPlace | null = null;
  for (const query of queries) {
    places.push(...await fetchNominatim(query, signal));
    best = pickBestPlace(facilityName, prefecture, places);
    if (best && scorePlace(facilityName, prefecture, best) >= 140) return best;
  }
  return best;
}

async function fetchNominatim(query: string, signal?: AbortSignal): Promise<PoiPlace[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('countrycodes', 'jp');
  url.searchParams.set('accept-language', 'ja');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');

  await waitForTurn();
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ja',
      'User-Agent': USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status}`);
  }
  const items = (await response.json()) as NominatimItem[];
  return items.map(toPlace).filter((place): place is PoiPlace => place !== null);
}

function toPlace(item: NominatimItem): PoiPlace | null {
  const latitude = Number(item.lat);
  const longitude = Number(item.lon);
  const name = item.name?.trim() || '';
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = item.address ?? {};
  const display = (item.display_name || '').replace(/, 日本$/, '');
  const prefecture = address.state || address.province || display.match(/(.{2,3}[都道府県])/)?.[1] || '';
  const city = address.city || address.town || address.village || address.city_district || address.suburb || '';
  return {
    name,
    address: display,
    prefecture,
    city,
    latitude,
    longitude,
    level: null,
    licenses: ['ODbL-1.0'],
    attributions: ['© OpenStreetMap contributors'],
  };
}

/** 地図ピンから住所を返す。ブラウザからは Worker 経由でのみ呼ぶ。 */
export async function reversePlace(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReversePlace | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 24 || latitude > 46.5 || longitude < 122 || longitude > 154) return null;
  const url = new URL(REVERSE_URL);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('accept-language', 'ja');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');

  await waitForTurn();
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ja',
      'User-Agent': USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim reverse failed: ${response.status}`);
  }
  const item = (await response.json()) as NominatimItem;
  const address = item.address ?? {};
  const prefecture = address.state || address.province || '';
  const city = address.city || address.town || address.village || address.county || '';
  const ward = address.city_district || address.suburb || address.quarter || '';
  const town = address.neighbourhood || address.hamlet || '';
  const road = [address.road, address.house_number].filter(Boolean).join('');
  const line = [prefecture, city, ward, town, road].filter(Boolean).join('');
  const display = (item.display_name || '').replace(/, 日本$/, '').replace(/, /g, '');
  return {
    address: line || display,
    prefecture,
    latitude,
    longitude,
  };
}
