import type { StoreVisit } from '@/types';

export type VisitSort = 'date' | 'name' | 'rank';

export interface VisitFilterState {
  query: string;
  ranks: string[];
  judgments: string[];
  prefectures: string[];
  photosOnly: boolean;
  from: string;
  to: string;
  sort: VisitSort;
}

export const EMPTY_VISIT_FILTER: VisitFilterState = {
  query: '',
  ranks: [],
  judgments: [],
  prefectures: [],
  photosOnly: false,
  from: '',
  to: '',
  sort: 'date',
};

export interface FilterableGroup {
  latest: StoreVisit;
  visits: StoreVisit[];
}

const RANK_ORDER = ['S', 'A', 'B', 'C', 'D'];

export function hasActiveVisitFilter(state: VisitFilterState): boolean {
  return Boolean(
    state.query.trim()
    || state.ranks.length
    || state.judgments.length
    || state.prefectures.length
    || state.photosOnly
    || state.from
    || state.to,
  );
}

export function groupMatches(
  group: FilterableGroup,
  state: VisitFilterState,
  ignore?: 'rank' | 'judgment' | 'prefecture' | 'photo',
): boolean {
  const latest = group.latest;
  const query = state.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      latest.facilityName,
      latest.prefecture,
      latest.address,
      latest.staffName,
      latest.poiName,
      ...group.visits.map((visit) => visit.staffName),
    ].filter(Boolean).join('\n').toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (ignore !== 'rank' && state.ranks.length > 0 && !state.ranks.includes(latest.rank)) return false;
  if (ignore !== 'judgment' && state.judgments.length > 0 && !state.judgments.includes(latest.judgment)) return false;
  if (ignore !== 'prefecture' && state.prefectures.length > 0 && !state.prefectures.includes(latest.prefecture || '')) return false;
  if (ignore !== 'photo' && state.photosOnly && !groupHasPhoto(group)) return false;
  if (state.from && latest.date < state.from) return false;
  if (state.to && latest.date > state.to) return false;
  return true;
}

export function groupHasPhoto(group: FilterableGroup): boolean {
  return group.visits.some((visit) => parsePhotoUrls(visit.photoUrl).length > 0);
}

export function compareGroups(a: FilterableGroup, b: FilterableGroup, sort: VisitSort): number {
  if (sort === 'name') return a.latest.facilityName.localeCompare(b.latest.facilityName, 'ja');
  if (sort === 'rank') {
    const rank = RANK_ORDER.indexOf(a.latest.rank) - RANK_ORDER.indexOf(b.latest.rank);
    if (rank !== 0) return rank;
  }
  return b.latest.date.localeCompare(a.latest.date) || a.latest.facilityName.localeCompare(b.latest.facilityName, 'ja');
}

function parsePhotoUrls(photoUrl: string | undefined): string[] {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => {
      const url = typeof item === 'string' ? item : item?.url;
      return typeof url === 'string' && /^https?:\/\//.test(url);
    });
  } catch {
    return /^https?:\/\//.test(photoUrl) ? [photoUrl] : [];
  }
}
