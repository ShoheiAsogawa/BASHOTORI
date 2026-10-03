import {
  locateFacility as locateFacilityRemote,
  locationKey,
  type PoiPlace,
} from '../../shared/poi';

export type { PoiPlace };
export {
  cleanFacilityQuery,
  locateFacility as locateFacilityRemote,
  locationKey,
  pickBestPlace,
  prefectureCenter,
  scorePlace,
  searchPlaces,
  suggestPlaces,
} from '../../shared/poi';

const CACHE_KEY = 'bashotori-openpoi-v1';

export async function locateFacility(
  facilityName: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<PoiPlace | null> {
  const cached = readPoiCache(facilityName, prefecture);
  if (cached) return cached;

  const best = await locateFacilityRemote(facilityName, prefecture, signal);
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
