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

// 店舗視察データの取得
export async function getStoreVisits(): Promise<StoreVisit[]> {
  if (!supabase) {
    console.warn('Supabase client is not initialized');
    return [];
  }
  const { data, error } = await supabase
    .from('store_visits')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching store visits:', error);
    throw error;
  }

  return data.map(transformStoreVisit);
}

let locationColumnsAvailable: boolean | null = null;

function isMissingLocationColumn(error: { message?: string; code?: string }): boolean {
  const message = error.message || '';
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    /Could not find the '.+(latitude|longitude|address|poi_name|poi_licenses|poi_attributions)' column/.test(message)
  );
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

// 店舗視察データの保存
export async function saveStoreVisit(visit: Partial<StoreVisit>): Promise<StoreVisit> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }
  
  // Supabaseクライアントを確実に取得
  const client = supabase;
  
  const includeLocation = locationColumnsAvailable !== false;
  const visitData: Record<string, any> = {
    date: visit.date,
    facility_name: visit.facilityName,
    staff_name: visit.staffName,
    prefecture: visit.prefecture,
    rank: visit.rank,
    judgment: visit.judgment,
    environment: visit.environment,
    imitation_table: visit.imitationTable,
    register_count: visit.registerCount,
    space_size: visit.spaceSize,
    space_size_note: visit.spaceSizeNote,
    traffic_count: visit.trafficCount,
    traffic_count_note: visit.trafficCountNote,
    demographics: visit.demographics || null,
    demographics_note: visit.demographicsNote,
    flow_line: visit.flowLine,
    flow_line_note: visit.flowLineNote,
    competitors: visit.competitors,
    competitors_note: visit.competitorsNote,
    staff_count: visit.staffCount,
    seasonality: visit.seasonality,
    busy_day: visit.busyDay,
    busy_day_note: visit.busyDayNote,
    overall_review: visit.overallReview,
    conditions: visit.conditions,
    photo_url: visit.photoUrl,
  };

  if (includeLocation) {
    visitData.latitude = visit.latitude ?? null;
    visitData.longitude = visit.longitude ?? null;
    visitData.address = visit.address ?? null;
    visitData.poi_name = visit.poiName ?? null;
    visitData.poi_licenses = visit.poiLicenses ?? null;
    visitData.poi_attributions = visit.poiAttributions ?? null;
  }

  const write = async (row: Record<string, any>) => {
    const query = visit.id
      ? (client as any).from('store_visits').update(row).eq('id', visit.id)
      : (client as any).from('store_visits').insert(row);
    return query.select().single();
  };

  let result = await write(visitData);
  if (result.error && includeLocation && isMissingLocationColumn(result.error)) {
    locationColumnsAvailable = false;
    const withoutLocation = { ...visitData };
    delete withoutLocation.latitude;
    delete withoutLocation.longitude;
    delete withoutLocation.address;
    delete withoutLocation.poi_name;
    delete withoutLocation.poi_licenses;
    delete withoutLocation.poi_attributions;
    result = await write(withoutLocation);
  } else if (!result.error && includeLocation) {
    locationColumnsAvailable = true;
  }

  if (result.error) {
    console.error('Error saving store visit:', result.error);
    throw result.error;
  }

  return transformStoreVisit(result.data);
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
  if (!supabase || locationColumnsAvailable === false) return false;

  const { error } = await (supabase as any)
    .from('store_visits')
    .update({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address || null,
      poi_name: place.name || null,
      poi_licenses: place.licenses || null,
      poi_attributions: place.attributions || null,
    })
    .eq('id', id);

  if (error && isMissingLocationColumn(error)) {
    locationColumnsAvailable = false;
    return false;
  }
  if (error) {
    console.error('Error saving store location:', error);
    return false;
  }
  locationColumnsAvailable = true;
  return true;
}

// 店舗視察データの削除
export async function deleteStoreVisit(id: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client is not initialized');
  }
  const { error } = await supabase
    .from('store_visits')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting store visit:', error);
    throw error;
  }
}

// データベースのスネークケースをキャメルケースに変換
function transformStoreVisit(row: any): StoreVisit {
  return {
    id: row.id,
    date: row.date,
    facilityName: row.facility_name,
    staffName: row.staff_name,
    prefecture: row.prefecture,
    rank: row.rank,
    judgment: row.judgment,
    environment: row.environment,
    imitationTable: row.imitation_table,
    registerCount: row.register_count,
    spaceSize: row.space_size,
    spaceSizeNote: row.space_size_note,
    trafficCount: row.traffic_count,
    trafficCountNote: row.traffic_count_note,
    demographics: row.demographics || undefined,
    demographicsNote: row.demographics_note,
    flowLine: row.flow_line,
    flowLineNote: row.flow_line_note,
    competitors: row.competitors,
    competitorsNote: row.competitors_note,
    staffCount: row.staff_count,
    seasonality: row.seasonality,
    busyDay: row.busy_day,
    busyDayNote: row.busy_day_note,
    overallReview: row.overall_review,
    conditions: row.conditions,
    photoUrl: row.photo_url,
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    address: row.address || undefined,
    poiName: row.poi_name || undefined,
    poiLicenses: stringList(row.poi_licenses),
    poiAttributions: stringList(row.poi_attributions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

