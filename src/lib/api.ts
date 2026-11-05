import type { StoreVisit } from '@/types';

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  const response = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // 本文が JSON でない場合はステータスだけを使う
    }
    throw new Error(message);
  }
  return response;
}

export async function getStoreVisits(): Promise<StoreVisit[]> {
  const response = await apiFetch('/api/visits');
  return response.json() as Promise<StoreVisit[]>;
}

export type VisitWrite = Omit<Partial<StoreVisit>, 'prefecture' | 'address'> & {
  skipGeocode?: boolean;
  create?: boolean;
  prefecture?: StoreVisit['prefecture'] | null;
  address?: string | null;
};

export async function saveStoreVisit(visit: VisitWrite): Promise<StoreVisit> {
  const create = visit.create === true || !visit.id;
  const payload: VisitWrite = { ...visit };
  delete payload.create;
  const path = create ? '/api/visits' : `/api/visits/${encodeURIComponent(visit.id || '')}`;
  const response = await apiFetch(path, {
    method: create ? 'POST' : 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<StoreVisit>;
}

export async function updateStoreVisitLocation(
  id: string,
  place: {
    latitude: number;
    longitude: number;
    address?: string;
    name?: string;
    licenses?: string[];
    attributions?: string[];
  },
): Promise<boolean> {
  await apiFetch(`/api/visits/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address || null,
      poiName: place.name || null,
      poiLicenses: place.licenses || null,
      poiAttributions: place.attributions || null,
    }),
  });
  return true;
}

export async function reverseGeocodePin(
  latitude: number,
  longitude: number,
): Promise<{ address: string; prefecture: string; latitude: number; longitude: number }> {
  const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
  const response = await apiFetch(`/api/geocode/reverse?${params.toString()}`);
  return response.json() as Promise<{ address: string; prefecture: string; latitude: number; longitude: number }>;
}

export async function deleteStoreVisit(id: string): Promise<void> {
  await apiFetch(`/api/visits/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export { apiFetch };

