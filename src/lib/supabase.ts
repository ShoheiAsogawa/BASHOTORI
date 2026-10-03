import { createClient } from '@supabase/supabase-js';
import type { StoreVisit } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// デバッグ用：環境変数の確認
console.log('Supabase環境変数チェック:', {
  url: supabaseUrl ? '✓ 設定済み' : '✗ 未設定',
  key: supabaseAnonKey ? '✓ 設定済み' : '✗ 未設定',
  urlValue: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'undefined',
});

// Supabaseクライアントの初期化
let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('❌ Supabase client initialization error:', error);
  }
} else {
  console.error('❌ Supabase環境変数が設定されていません。');
  console.error('   .envファイルを確認し、開発サーバーを再起動してください。');
  console.error('   必要な環境変数:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - VITE_SUPABASE_ANON_KEY');
}

export { supabase };

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  const response = await fetch(`${base}${path}`, { ...init, headers });
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
  prefecture?: StoreVisit['prefecture'] | null;
  address?: string | null;
};

export async function saveStoreVisit(visit: VisitWrite): Promise<StoreVisit> {
  const path = visit.id ? `/api/visits/${encodeURIComponent(visit.id)}` : '/api/visits';
  const method = visit.id ? 'PATCH' : 'POST';
  const response = await apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visit),
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

