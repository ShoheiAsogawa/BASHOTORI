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
const SEARCH_URL = 'https://api.openpoiapi.com/v1/search';
const MIN_SCORE = 80;

/** 都道府県のおおよその範囲。OpenPOI の検索を県内に絞る。 */
const PREFECTURE_BBOX: Record<string, string> = {
  北海道: '139.30,41.30,145.90,45.60',
  青森県: '139.40,40.20,141.70,41.60',
  岩手県: '140.60,38.70,142.10,40.50',
  宮城県: '140.20,37.70,141.70,39.00',
  秋田県: '139.70,39.00,140.90,40.50',
  山形県: '139.50,37.70,140.70,39.20',
  福島県: '139.10,36.80,141.10,37.90',
  茨城県: '139.70,35.70,140.90,36.90',
  栃木県: '139.30,36.20,140.30,37.20',
  群馬県: '138.40,36.00,139.90,37.10',
  埼玉県: '138.70,35.70,139.90,36.30',
  千葉県: '139.70,34.90,140.90,36.10',
  東京都: '138.90,34.50,153.99,35.90',
  神奈川県: '138.90,35.10,139.80,35.70',
  新潟県: '137.60,36.70,139.90,38.60',
  富山県: '136.70,36.20,137.80,36.90',
  石川県: '136.20,36.20,137.40,37.90',
  福井県: '135.40,35.30,136.90,36.30',
  山梨県: '138.20,35.20,139.10,35.90',
  長野県: '137.30,35.20,138.80,37.10',
  岐阜県: '136.30,35.10,137.70,36.50',
  静岡県: '137.40,34.60,139.20,35.70',
  愛知県: '136.72,34.55,137.85,35.42',
  三重県: '135.80,33.70,136.99,35.30',
  滋賀県: '135.70,34.80,136.50,35.70',
  京都府: '134.80,34.70,136.10,35.80',
  大阪府: '135.05,34.25,135.78,34.90',
  兵庫県: '134.20,34.15,135.50,35.70',
  奈良県: '135.55,33.80,136.20,34.80',
  和歌山県: '135.00,33.40,136.05,34.40',
  鳥取県: '133.10,35.00,134.55,35.65',
  島根県: '131.60,34.30,133.40,36.40',
  岡山県: '133.25,34.30,134.45,35.35',
  広島県: '132.00,34.00,133.50,35.10',
  山口県: '130.80,33.70,132.20,34.80',
  徳島県: '133.60,33.50,134.85,34.30',
  香川県: '133.40,34.00,134.50,34.55',
  愛媛県: '132.00,32.90,133.75,34.35',
  高知県: '132.40,32.70,134.35,33.90',
  福岡県: '130.00,33.00,131.20,34.00',
  佐賀県: '129.70,32.90,130.55,33.65',
  長崎県: '128.60,32.55,130.40,34.75',
  熊本県: '130.10,32.10,131.35,33.20',
  大分県: '130.80,32.70,132.15,33.75',
  宮崎県: '130.70,31.35,131.90,32.90',
  鹿児島県: '128.40,27.00,131.20,32.30',
  沖縄県: '122.90,24.00,131.35,27.90',
};

const BRANDS = [
  'スーパーセンタートライアル',
  'スーパーセンターオークワ',
  'スーパーセンタープラント',
  'マックスバリュエクスプレス',
  'マックスバリューエクスプレス',
  'ホームセンターコーナン',
  'デイリーカナートイズミヤ',
  'ピアゴラフーズコア',
  'ナフコトミダ',
  'ライフガーデン',
  'マツヤスーパー',
  'ファニチャードーム',
  'ショッピングセンター',
  'パルティフジ',
  'フレンドマート',
  'イオンモール',
  'イオンスタイル',
  'イオンタウン',
  'マックスバリュ',
  'マックスバリュー',
  'カナートモール',
  '近商ストア',
  'スーパーストア',
  'コーナン',
  'ヤマナカ',
  'コノミヤ',
  'ニトリ',
  'マルナカ',
  'ナフコ',
  'そよら',
  '西友',
  'ダイエー',
  'オーケー',
  'イズミヤ',
  'フレスタ',
  'フレスポ',
  'ザビッグ',
  'オークワ',
  '平和堂',
  'トライアル',
  'アルク',
  'ピアゴ',
  'ハローズ',
  'グルメシティ',
  'DCM',
  'ディーシーエム',
  'トミダ',
  'フジ',
  'イオン',
].sort((left, right) => foldName(right).length - foldName(left).length);

const GENERIC_TAILS = new Set(['本町', '駅前', '中央', '西口', '東口', '南口', '北口', '新町']);

const BRAND_FAMILIES = [
  ['イオンモール', 'イオンタウン', 'イオンスタイル'],
];

const ALIASES: Array<[RegExp, string]> = [
  [/KINSHOストア/gi, '近商ストア'],
  [/KINSHO/gi, '近商'],
  [/金商ストア/g, '近商ストア'],
  [/不二家/g, '不二屋'],
  [/Mikawaya/gi, 'ミカワヤ'],
  [/pochette/gi, 'ポシェット'],
  [/Amity/gi, 'アミティ'],
  [/DCM/gi, 'ディーシーエム'],
  [/マックスバリュ(?!ー)/g, 'マックスバリュー'],
];

interface PoiItem {
  name?: string;
  address?: string;
  prefecture?: string;
  city?: string;
  lat?: number | string;
  lng?: number | string;
  level?: number | string | null;
  licenses?: unknown;
  attributions?: unknown;
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

/** 同じ商業施設の屋号違いを、検索と採点の両方で試す。 */
export function queryForms(name: string): string[] {
  const cleaned = cleanFacilityQuery(name);
  const aliased = applyAliases(name);
  const forms = new Set<string>([cleaned]);
  if (aliased !== cleaned) forms.add(aliased);
  for (const form of [...forms]) {
    for (const family of BRAND_FAMILIES) {
      const brand = family.find((item) => form.startsWith(item) && form.length - item.length >= 2);
      if (!brand) continue;
      const rest = form.slice(brand.length);
      for (const sibling of family) {
        if (sibling !== brand) forms.add(`${sibling}${rest}`);
      }
    }
  }
  return [...forms];
}

/** 店名のゆれ（KINSHO、不二家、ハイフン）を検索用に寄せる。 */
export function applyAliases(name: string): string {
  let value = cleanFacilityQuery(name);
  for (const [pattern, replacement] of ALIASES) value = value.replace(pattern, replacement);
  return value.replace(/街/g, '町');
}

function foldName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ーｰ－−‐\-・･\s]/g, '');
}

function foldLoose(value: string): string {
  return foldName(value).replace(/街/g, '町').replace(/ヶ/g, 'ケ');
}

function compactQuery(value: string): string {
  return value.normalize('NFKC').replace(/[\s・･]+/g, '').trim();
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

function inJapan(latitude: number, longitude: number): boolean {
  return latitude >= 24 && latitude <= 46.5 && longitude >= 122 && longitude <= 154;
}

function locationAfterFold(prepared: string, foldedBrand: string): string {
  const chars = [...prepared];
  let foldedCount = 0;
  let index = 0;
  for (; index < chars.length && foldedCount < foldedBrand.length; index += 1) {
    foldedCount += foldName(chars[index]).length;
  }
  while (index < chars.length && foldName(chars[index]).length === 0) index += 1;
  return chars.slice(index).join('');
}

function shortestBrand(query: string): string {
  const prepared = foldLoose(compactQuery(cleanFacilityQuery(query)));
  let best = '';
  for (const brand of BRANDS) {
    const folded = foldLoose(brand);
    if (folded.length < 2 || !prepared.startsWith(folded) || prepared.length - folded.length < 2) continue;
    if (!best || folded.length < foldLoose(best).length) best = brand;
  }
  return best;
}

function cleanLocation(location: string): string {
  return location.replace(/^[ーｰ－−‐\-]+/, '');
}

export function splitBrand(query: string): { brand: string; location: string } {
  const prepared = compactQuery(cleanFacilityQuery(query));
  const compact = foldName(prepared);
  let best: { brand: string; location: string } | null = null;
  for (const brand of BRANDS) {
    if (!prepared.startsWith(brand) || prepared.length - brand.length < 2) continue;
    if (!best || brand.length > best.brand.length) {
      best = { brand, location: cleanLocation(prepared.slice(brand.length)) };
    }
  }
  if (best) return best;

  for (const brand of BRANDS) {
    const folded = foldName(brand);
    if (!compact.startsWith(folded) || compact.length - folded.length < 2) continue;
    const location = cleanLocation(locationAfterFold(prepared, folded));
    if (location.length < 2) continue;
    if (!best || folded.length > foldName(best.brand).length) best = { brand, location };
  }
  return best ?? { brand: '', location: prepared };
}

function namedPrefecture(place: PoiPlace): string {
  const blob = `${place.prefecture}${place.city}${place.address}`;
  return blob.match(/(.{2,3}[都道府県])/)?.[1] ?? '';
}

function insideBBox(place: PoiPlace, bbox: string): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  return place.longitude >= minLng && place.longitude <= maxLng
    && place.latitude >= minLat && place.latitude <= maxLat;
}

function prefectureFit(expected: string | undefined, place: PoiPlace): 'match' | 'mismatch' | 'unknown' {
  if (!expected) return 'unknown';
  const blob = `${place.prefecture}${place.city}${place.address}`;
  if (place.prefecture) {
    return place.prefecture === expected || blob.includes(expected) ? 'match' : 'mismatch';
  }
  if (blob.includes(expected)) return 'match';
  const named = namedPrefecture(place);
  if (named && named !== expected) return 'mismatch';
  const bbox = PREFECTURE_BBOX[expected];
  if (!bbox) return 'unknown';
  return insideBBox(place, bbox) ? 'match' : 'mismatch';
}

function brandParts(query: string): string[] {
  const brands = [...BRANDS].sort((left, right) => foldLoose(left).length - foldLoose(right).length);
  const parts: string[] = [];
  let rest = foldLoose(cleanFacilityQuery(query));
  while (rest.length >= 2) {
    const brand = brands.find((item) => {
      const folded = foldLoose(item);
      return folded.length >= 2 && rest.startsWith(folded) && rest.length - folded.length >= 2;
    });
    if (!brand) {
      parts.push(rest);
      break;
    }
    const folded = foldLoose(brand);
    parts.push(folded);
    rest = rest.slice(folded.length);
  }
  return parts.filter((part) => part.length >= 2);
}

function containsToken(haystack: string, token: string): boolean {
  if (token.length < 2) return false;
  let from = 0;
  while (from <= haystack.length - token.length) {
    const index = haystack.indexOf(token, from);
    if (index < 0) return false;
    const previous = index > 0 ? haystack[index - 1] : '';
    if (!previous || !'東西南北'.includes(previous)) return true;
    from = index + token.length;
  }
  return false;
}

function occursAsBrand(brand: string, name: string): boolean {
  let from = 0;
  while (from <= name.length - brand.length) {
    const index = name.indexOf(brand, from);
    if (index < 0) return false;
    const previous = index > 0 ? name[index - 1] : '';
    const next = name[index + brand.length] ?? '';
    const continuesKana = brand.length <= 2 && /[ぁ-ゖァ-ヺー]/.test(next);
    if ((!previous || !'東西南北'.includes(previous)) && !continuesKana) return true;
    from = index + brand.length;
  }
  return false;
}

function brandInPlace(brand: string, name: string, area: string): boolean {
  return occursAsBrand(brand, name) || containsToken(area, brand);
}

const WEAK_PLACE_TOKENS = new Set(['中央', '本町', '駅前', '西口', '東口', '南口', '北口', '新町', '本店']);

function locationCovered(location: string, name: string, area: string): boolean {
  const haystack = `${name}${area}`;
  if (containsToken(haystack, location)) return true;
  if (location.length < 4) return false;
  const limit = Math.min(location.length - 2, 8);
  for (let index = 2; index <= limit; index += 1) {
    const head = location.slice(0, index);
    const tail = location.slice(index);
    if (head.length < 2 || tail.length < 2) continue;
    if (!containsToken(haystack, head) || !containsToken(haystack, tail)) continue;
    if (Math.max(head.length, tail.length) < 3 && (WEAK_PLACE_TOKENS.has(head) || WEAK_PLACE_TOKENS.has(tail))) continue;
    return true;
  }
  return false;
}

function partsMatch(query: string, name: string, area: string): boolean {
  const parts = brandParts(query);
  if (parts.length < 2) return false;
  const haystack = `${name}${area}`;
  return parts.every((part, index) => {
    const isBrand = index < parts.length - 1 && BRANDS.some((brand) => foldLoose(brand) === part);
    if (isBrand) return brandInPlace(part, name, area);
    return containsToken(haystack, part);
  });
}

function splitContained(query: string, name: string, area: string): boolean {
  if (query.length < 4) return false;
  const haystack = `${name}${area}`;
  const limit = Math.min(query.length - 2, 14);
  for (let index = 2; index <= limit; index += 1) {
    const head = query.slice(0, index);
    const tail = query.slice(index);
    if (head.length < 2 || tail.length < 2) continue;
    if (!containsToken(haystack, tail)) continue;
    const headIsBrand = BRANDS.some((brand) => foldLoose(brand) === head);
    if (headIsBrand ? brandInPlace(head, name, area) : containsToken(haystack, head)) return true;
  }
  return false;
}

function scoreOne(query: string, prefecture: string | undefined, place: PoiPlace): number {
  const normalizedQuery = foldLoose(cleanFacilityQuery(query));
  const name = foldLoose(place.name);
  const area = foldLoose(`${place.prefecture}${place.city}${place.address}`);
  if (normalizedQuery.length < 2 || (!name && !area)) return 0;
  if (!inJapan(place.latitude, place.longitude)) return 0;
  if (/移動スーパー|号車/.test(place.name) && !/移動スーパー|号車/.test(normalizedQuery)) return 0;

  const { brand, location } = splitBrand(query);
  const brandFold = foldLoose(brand);
  const locationFold = foldLoose(location);
  const extendsQuery = name.startsWith(normalizedQuery);
  const extra = extendsQuery ? name.slice(normalizedQuery.length) : '';
  if (extendsQuery && extra !== '' && extra !== '店' && extra !== '本店') return 0;
  let score = 0;
  let kind: 'name' | 'address' | 'tokens' | 'split' = 'name';
  if (name === normalizedQuery || name === `${normalizedQuery}店` || name === `${normalizedQuery}本店`) score = 230;
  else if (name.includes(normalizedQuery)) score = 170;
  else if (normalizedQuery.length >= 4 && area.includes(normalizedQuery)) {
    score = 130;
    kind = 'address';
  } else if (
    brandFold
    && locationFold.length >= 2
    && brandInPlace(brandFold, name, area)
    && (locationFold === '本店' || locationCovered(locationFold, name, area))
  ) {
    score = 110;
    kind = 'tokens';
  } else if (partsMatch(query, name, area)) {
    score = 110;
    kind = 'tokens';
  } else if (splitContained(normalizedQuery, name, area)) {
    score = 90;
    kind = 'split';
  } else {
    return 0;
  }

  const tail = locationFold || normalizedQuery;
  const generic = GENERIC_TAILS.has(tail) || brandParts(query).some((part) => GENERIC_TAILS.has(part));
  if (generic && kind !== 'name') return 0;

  const fit = prefectureFit(prefecture, place);
  if (fit === 'match') score += 30;
  else if (fit === 'mismatch') {
    const tail = locationFold || normalizedQuery;
    if (kind !== 'name' || tail.length < 2 || GENERIC_TAILS.has(tail)) return 0;
    score -= 50;
  } else if (kind === 'split') {
    return 0;
  }

  if (/出張所|パーキング|駐車場|ATM|従業員/i.test(place.name)) score -= 25;
  if (place.level !== null) score += Math.min(Math.max(place.level, 0), 10);
  return score;
}

export function scorePlace(query: string, prefecture: string | undefined, place: PoiPlace): number {
  return Math.max(...queryForms(query).map((form) => scoreOne(form, prefecture, place)));
}

export function placeGap(query: string, place: PoiPlace): number {
  const normalizedQuery = foldLoose(applyAliases(query));
  const name = foldLoose(place.name);
  const difference = Math.abs(name.length - normalizedQuery.length);
  if (name === normalizedQuery || name.startsWith(normalizedQuery) || normalizedQuery.startsWith(name)) return difference;
  return 1000 + difference;
}

export function pickBestPlace(query: string, prefecture: string | undefined, places: PoiPlace[]): PoiPlace | null {
  let best: { place: PoiPlace; score: number; gap: number } | null = null;
  for (const place of places) {
    const score = scorePlace(query, prefecture, place);
    if (score < MIN_SCORE) continue;
    const gap = placeGap(query, place);
    if (!best || score > best.score || (score === best.score && gap < best.gap)) {
      best = { place, score, gap };
    }
  }
  return best?.place ?? null;
}

function parsePlaces(items: PoiItem[]): PoiPlace[] {
  const places: PoiPlace[] = [];
  for (const item of items) {
    const latitude = toNumber(item.lat);
    const longitude = toNumber(item.lng);
    if (latitude === null || longitude === null || !item.name) continue;
    if (!inJapan(latitude, longitude)) continue;
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

  const data = (await response.json()) as { suggestions?: PoiItem[] };
  return parsePlaces(data.suggestions ?? []);
}

export function prefectureCenter(prefecture: string | undefined): { latitude: number; longitude: number } | null {
  if (!prefecture) return null;
  const bbox = PREFECTURE_BBOX[prefecture];
  if (!bbox) return null;
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  if (![minLng, minLat, maxLng, maxLat].every((value) => Number.isFinite(value))) return null;
  return { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 };
}

export async function searchPlaces(
  query: string,
  limit: number,
  bbox: string | undefined,
  signal?: AbortSignal,
): Promise<PoiPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', String(limit));
  if (bbox) url.searchParams.set('bbox', bbox);
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`OpenPOI search failed: ${response.status}`);
  }
  const data = (await response.json()) as { results?: PoiItem[] };
  return parsePlaces(data.results ?? []);
}

async function collect(signal: AbortSignal | undefined, run: () => Promise<PoiPlace[]>): Promise<PoiPlace[]> {
  try {
    return await run();
  } catch (error) {
    if (signal?.aborted) throw error;
    return [];
  }
}

export async function locateFacility(
  facilityName: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<PoiPlace | null> {
  const cleaned = cleanFacilityQuery(facilityName);
  if (cleaned.length < 2) return null;
  const aliased = applyAliases(facilityName);
  const places: PoiPlace[] = [];
  const seen = new Set<string>();

  const add = (list: PoiPlace[]) => {
    for (const place of list) {
      const key = `${place.latitude.toFixed(5)}|${place.longitude.toFixed(5)}|${foldName(place.name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(place);
    }
  };
  const best = () => pickBestPlace(facilityName, prefecture, places);
  const strong = () => {
    const place = best();
    return Boolean(place && scorePlace(facilityName, prefecture, place) >= 180);
  };

  add(await collect(signal, () => suggestPlaces(cleaned, 8, signal)));
  if (strong()) return best();

  const searchTerm = compactQuery(cleaned);
  add(await collect(signal, () => searchPlaces(searchTerm, 20, undefined, signal)));
  if (strong()) return best();

  const aliasTerm = compactQuery(aliased);
  if (foldName(aliasTerm) !== foldName(searchTerm)) {
    add(await collect(signal, () => searchPlaces(aliasTerm, 20, undefined, signal)));
    if (strong()) return best();
  }

  const split = splitBrand(cleaned);
  const aliasSplit = splitBrand(aliased);
  const brands = [...new Set([shortestBrand(cleaned), shortestBrand(aliased), split.brand, aliasSplit.brand].filter(Boolean))];
  const extraForms = queryForms(facilityName).filter((form) => foldName(form) !== foldName(cleaned) && foldName(form) !== foldName(aliased));
  for (const form of extraForms.slice(0, 2)) {
    add(await collect(signal, () => suggestPlaces(form, 5, signal)));
    add(await collect(signal, () => searchPlaces(compactQuery(form), 10, undefined, signal)));
    if (strong()) return best();
  }
  const location = split.location || aliasSplit.location;
  const bbox = prefecture ? PREFECTURE_BBOX[prefecture] : undefined;
  if (bbox) {
    for (const brand of brands.slice(0, 2)) {
      add(await collect(signal, () => searchPlaces(brand, 200, bbox, signal)));
      if (strong()) return best();
    }
  }

  const locationHead = location.slice(0, Math.min(3, location.length));
  const suggestBrand = split.brand || aliasSplit.brand;
  if (suggestBrand && locationHead.length >= 2) {
    const prefix = `${suggestBrand}${locationHead}`;
    if (foldName(prefix) !== foldName(searchTerm) && foldName(prefix) !== foldName(aliasTerm)) {
      add(await collect(signal, () => suggestPlaces(prefix, 8, signal)));
      if (strong()) return best();
    }
  }

  if (location.length >= 2 && foldName(location) !== foldName(searchTerm) && foldName(location) !== foldName(aliasTerm)) {
    add(await collect(signal, () => searchPlaces(location, 80, undefined, signal)));
  }

  return best();
}
