const SEARCH_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch';

interface GsiFeature {
  geometry?: { coordinates?: number[] };
  properties?: { title?: string };
}

export interface StreetPoint {
  address: string;
  prefecture: string;
  latitude: number;
  longitude: number;
}

function inJapan(latitude: number, longitude: number): boolean {
  return latitude >= 24 && latitude <= 46.5 && longitude >= 122 && longitude <= 154;
}

/** 番地まで書かれた住所だけを国土地理院で座標にする。町名どまりの結果は使わない。 */
export async function geocodeStreetAddress(
  query: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<StreetPoint | null> {
  const trimmed = query.normalize('NFKC').replace(/\s+/g, '').trim();
  if (trimmed.length < 4) return null;
  if (!/[0-9]/.test(trimmed) && !/丁目|番地|番/.test(trimmed)) return null;

  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', trimmed);
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const data = (await response.json()) as GsiFeature[];
  const title = data[0]?.properties?.title?.trim() || '';
  const coords = data[0]?.geometry?.coordinates;
  if (!title || !coords || coords.length < 2) return null;
  const [longitude, latitude] = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !inJapan(latitude, longitude)) return null;
  if (!/丁目|番地|[0-9]+番/.test(title)) return null;

  const named = title.match(/(.{2,3}[都道府県])/)?.[1] || '';
  if (prefecture && named && named !== prefecture) return null;
  if (prefecture && !named && !title.includes(prefecture)) return null;
  return { address: title, prefecture: named, latitude, longitude };
}
