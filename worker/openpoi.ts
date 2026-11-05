import { locateFacility as locateOpenPoi, placeGap, scorePlace, type PoiPlace } from '../shared/poi.ts';
import { locateByNominatim } from './nominatim.ts';

export type { PoiPlace };

function limited(parent: AbortSignal | undefined, ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const abort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  else parent?.addEventListener('abort', abort, { once: true });
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timer);
    parent?.removeEventListener('abort', abort);
  }, { once: true });
  return controller.signal;
}

export async function locateFacility(
  facilityName: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<PoiPlace | null> {
  let openPoi: PoiPlace | null = null;
  try {
    openPoi = await locateOpenPoi(facilityName, prefecture, limited(signal, 12_000));
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  const openScore = openPoi ? scorePlace(facilityName, prefecture, openPoi) : 0;
  if (openPoi && openScore >= 180 && openPoi.address.trim()) return openPoi;

  try {
    const nominatim = await locateByNominatim(facilityName, prefecture, limited(signal, 20_000));
    if (!nominatim) return openPoi;
    if (!openPoi) return nominatim;
    const nominatimScore = scorePlace(facilityName, prefecture, nominatim);
    if (nominatimScore > openScore) return nominatim;
    if (nominatimScore === openScore && placeGap(facilityName, nominatim) < placeGap(facilityName, openPoi)) return nominatim;
    if (!openPoi.address.trim() && nominatim.address.trim() && nominatimScore >= openScore - 20) return nominatim;
    return openPoi;
  } catch (error) {
    if (signal?.aborted) throw error;
    return openPoi;
  }
}
