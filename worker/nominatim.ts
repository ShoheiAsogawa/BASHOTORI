import { applyAliases, cleanFacilityQuery, pickBestPlace, type PoiPlace } from '../shared/poi.ts';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
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
    city_district?: string;
    suburb?: string;
  };
}

/** OpenPOI で店が決まらないときだけ使う。ブラウザからは呼ばない。 */
export async function locateByNominatim(
  facilityName: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<PoiPlace | null> {
  const facility = applyAliases(cleanFacilityQuery(facilityName)).replace(/本店$/u, '');
  if (facility.length < 2) return null;
  const query = [facility, prefecture?.trim() || ''].filter(Boolean).join(' ');
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
  return pickBestPlace(facilityName, prefecture, items.map(toPlace).filter((place): place is PoiPlace => place !== null));
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
