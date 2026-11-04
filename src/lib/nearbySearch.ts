export interface Origin {
  latitude: number;
  longitude: number;
  label: string;
}

export interface SearchFacility {
  title: string;
  body: string;
  address: string;
}

export interface PlacedFacility extends SearchFacility {
  latitude: number | null;
  longitude: number | null;
  meters: number | null;
}

export interface NearbySearchResult {
  markdown: string;
  sorted: boolean;
  located: number;
  total: number;
}

/** 逆ジオコーディングの住所から、検索に使う「都道府県＋市区町村」を取り出す。 */
export function searchArea(address: string, prefecture: string): string {
  const source = address.replace(/\s+/g, '');
  const pref = prefecture.trim();
  const head = pref || source.match(/^.{2,3}[都道府県]/)?.[0] || '';
  const rest = head && source.startsWith(head) ? source.slice(head.length) : source;
  const city = rest.match(/^.+?[市区町村]/)?.[0] ?? '';
  return `${head}${city}`.trim();
}

export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earth = 6371000;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters / 1000)}km`;
}

export function parseSearchFacilities(markdown: string): { intro: string; facilities: SearchFacility[] } {
  const parts = markdown.replace(/\r\n/g, '\n').split(/\n(?=### )/);
  const intro: string[] = [];
  const facilities: SearchFacility[] = [];
  for (const part of parts) {
    if (!part.startsWith('### ')) {
      if (part.trim()) intro.push(part.trim());
      continue;
    }
    const newline = part.indexOf('\n');
    const rawTitle = (newline === -1 ? part.slice(4) : part.slice(4, newline)).replace(/\*\*/g, '').trim();
    const title = rawTitle.replace(/^\d+\s*[.、)]\s*/, '').trim();
    const body = newline === -1 ? '' : part.slice(newline + 1).trim();
    const addressMatch = body.match(/(?:\*\*)?住所(?:\*\*)?\s*[:：]\s*(.+)/);
    const address = geocodeQuery(addressMatch?.[1] ?? '');
    if (title) facilities.push({ title, body, address });
  }
  return { intro: intro.join('\n\n'), facilities };
}

export function geocodeQuery(address: string): string {
  return address
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[`*]/g, '')
    .split(/[。\n]/)[0]
    .trim();
}

export function buildStoreSearchPrompt(area: string, origin: Origin | null): string {
  const center = origin
    ? `検索の中心は現在地（緯度 ${origin.latitude.toFixed(5)}、経度 ${origin.longitude.toFixed(5)}、${origin.label}）です。この地点の近くにある施設を優先して調べてください。`
    : '指定された地域の施設を調べてください。';

  return `
ウェブ検索で確認できた実在の施設だけを答えてください。推測や創作は書かないでください。

${area} で、催事（買取イベント）に向く集客力のある商業施設を5件出してください。
${center}

前置きは書かず、各施設を次の形式だけにしてください。距離や所要時間は書かないでください。住所を確認できない施設は省いてください。

### 施設名

- **ジャンル**:
- **住所**: 都道府県から番地までの正式な住所
- **Googleマップ**: [地図を見る](https://www.google.com/maps/search/?api=1&query=施設名+住所)
- **特徴**: 集客や客層について、確認できたことを1行
  `.trim();
}

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = geocodeQuery(query);
  if (trimmed.length < 2) return null;
  const response = await fetch(
    `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(trimmed)}`,
    { signal },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as Array<{ geometry?: { coordinates?: number[] } }>;
  const coords = data[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [longitude, latitude] = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export async function orderSearchResult(
  markdown: string,
  origin: Origin,
  signal?: AbortSignal,
): Promise<NearbySearchResult> {
  const { intro, facilities } = parseSearchFacilities(markdown);
  if (facilities.length === 0) {
    return { markdown, sorted: false, located: 0, total: 0 };
  }

  const placed = await Promise.all(facilities.map(async (facility) => {
    const point = facility.address
      ? await geocodeAddress(facility.address, signal).catch(() => null)
      : null;
    return {
      ...facility,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      meters: point ? distanceMeters(origin, point) : null,
    };
  }));

  placed.sort((a, b) => {
    if (a.meters == null && b.meters == null) return 0;
    if (a.meters == null) return 1;
    if (b.meters == null) return -1;
    return a.meters - b.meters;
  });

  const located = placed.filter((facility) => facility.meters != null).length;
  if (located === 0) {
    return { markdown, sorted: false, located: 0, total: facilities.length };
  }

  const lead = `現在地（${origin.label}）から近い順です。${located}件の距離を計算しました。`;
  const blocks = placed.map((facility) => {
    const distance = facility.meters == null
      ? '距離を計算できませんでした。'
      : `現在地から **${formatDistance(facility.meters)}**`;
    const nav = facility.latitude != null && facility.longitude != null
      ? ` · [この場所へ行く](https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${facility.latitude},${facility.longitude}&travelmode=driving)`
      : '';
    return `### ${facility.title}\n\n${distance}${nav}\n\n${facility.body}`.trim();
  });

  return {
    markdown: [lead, intro, ...blocks].filter(Boolean).join('\n\n'),
    sorted: true,
    located,
    total: facilities.length,
  };
}
