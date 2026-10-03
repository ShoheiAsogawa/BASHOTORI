import { locateFacility as locateOpenPoi, placeGap, scorePlace, type PoiPlace } from '../shared/poi.ts';
import { locateByNominatim } from './nominatim.ts';

export type { PoiPlace };

export async function locateFacility(
  facilityName: string,
  prefecture?: string,
  signal?: AbortSignal,
): Promise<PoiPlace | null> {
  const openPoi = await locateOpenPoi(facilityName, prefecture, signal);
  const openScore = openPoi ? scorePlace(facilityName, prefecture, openPoi) : 0;
  if (openPoi && openScore >= 180 && openPoi.address.trim()) return openPoi;

  try {
    const nominatim = await locateByNominatim(facilityName, prefecture, signal);
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
