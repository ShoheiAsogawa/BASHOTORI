import type { AuthUser } from './auth';
import { json } from './http';
import { locateFacility, type PoiPlace } from './openpoi';

const COLUMNS: Record<string, string> = {
  date: 'date',
  facilityName: 'facility_name',
  staffName: 'staff_name',
  prefecture: 'prefecture',
  rank: 'rank',
  judgment: 'judgment',
  environment: 'environment',
  imitationTable: 'imitation_table',
  registerCount: 'register_count',
  spaceSize: 'space_size',
  spaceSizeNote: 'space_size_note',
  trafficCount: 'traffic_count',
  trafficCountNote: 'traffic_count_note',
  demographics: 'demographics',
  demographicsNote: 'demographics_note',
  flowLine: 'flow_line',
  flowLineNote: 'flow_line_note',
  competitors: 'competitors',
  competitorsNote: 'competitors_note',
  staffCount: 'staff_count',
  seasonality: 'seasonality',
  busyDay: 'busy_day',
  busyDayNote: 'busy_day_note',
  overallReview: 'overall_review',
  conditions: 'conditions',
  photoUrl: 'photo_url',
  latitude: 'latitude',
  longitude: 'longitude',
  address: 'address',
  poiName: 'poi_name',
  poiLicenses: 'poi_licenses',
  poiAttributions: 'poi_attributions',
};

const JSON_FIELDS = new Set(['demographics', 'poiLicenses', 'poiAttributions']);

interface VisitRow {
  id: string;
  date: string;
  facility_name: string;
  staff_name: string;
  prefecture: string | null;
  rank: string;
  judgment: string;
  environment: string;
  imitation_table: string;
  register_count: string | null;
  space_size: string | null;
  space_size_note: string | null;
  traffic_count: string | null;
  traffic_count_note: string | null;
  demographics: string | null;
  demographics_note: string | null;
  flow_line: string | null;
  flow_line_note: string | null;
  competitors: string | null;
  competitors_note: string | null;
  staff_count: string | null;
  seasonality: string | null;
  busy_day: string | null;
  busy_day_note: string | null;
  overall_review: string | null;
  conditions: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  poi_name: string | null;
  poi_licenses: string | null;
  poi_attributions: string | null;
  created_at: string;
  updated_at: string;
}

export async function handleVisits(request: Request, env: Env, user: AuthUser, id: string | null): Promise<Response> {
  if (request.method === 'GET' && !id) return listVisits(env);
  if (request.method === 'POST' && !id) return writeVisit(request, env, user, null);
  if (request.method === 'PATCH' && id) return writeVisit(request, env, user, id);
  if (request.method === 'DELETE' && id) return deleteVisit(env, user, id);
  return json({ error: 'Method not allowed' }, 405);
}

async function listVisits(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM store_visits ORDER BY date DESC',
  ).all<VisitRow>();
  return json((results || []).map(toVisit));
}

async function writeVisit(request: Request, env: Env, user: AuthUser, id: string | null): Promise<Response> {
  if (user.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const body = (await request.json()) as Record<string, unknown>;
  const now = new Date().toISOString();
  await ensureLocation(body, id, env);

  if (!id) {
    const visitId = crypto.randomUUID();
    const columns = ['id', 'created_at', 'updated_at'];
    const values: unknown[] = [visitId, now, now];
    for (const [key, column] of Object.entries(COLUMNS)) {
      if (!(key in body)) continue;
      columns.push(column);
      values.push(serialize(key, body[key]));
    }
    const placeholders = columns.map(() => '?').join(', ');
    await env.DB.prepare(
      `INSERT INTO store_visits (${columns.join(', ')}) VALUES (${placeholders})`,
    ).bind(...values).run();
    return json(await readVisit(env, visitId), 201);
  }

  const assignments = ['updated_at = ?'];
  const values: unknown[] = [now];
  for (const [key, column] of Object.entries(COLUMNS)) {
    if (!(key in body)) continue;
    assignments.push(`${column} = ?`);
    values.push(serialize(key, body[key]));
  }
  values.push(id);
  const result = await env.DB.prepare(
    `UPDATE store_visits SET ${assignments.join(', ')} WHERE id = ?`,
  ).bind(...values).run();
  if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
  return json(await readVisit(env, id));
}

async function deleteVisit(env: Env, user: AuthUser, id: string): Promise<Response> {
  if (user.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const result = await env.DB.prepare('DELETE FROM store_visits WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
  return json({ ok: true });
}

async function readVisit(env: Env, id: string) {
  const row = await env.DB.prepare('SELECT * FROM store_visits WHERE id = ?').bind(id).first<VisitRow>();
  if (!row) return null;
  return toVisit(row);
}

async function ensureLocation(body: Record<string, unknown>, id: string | null, env: Env): Promise<void> {
  let facilityName = typeof body.facilityName === 'string' ? body.facilityName : '';
  let prefecture = typeof body.prefecture === 'string' ? body.prefecture : '';
  let latitude = body.latitude;
  let longitude = body.longitude;

  if (id) {
    const existing = await env.DB.prepare(
      'SELECT facility_name, prefecture, latitude, longitude FROM store_visits WHERE id = ?',
    ).bind(id).first<{ facility_name: string; prefecture: string | null; latitude: number | null; longitude: number | null }>();
    if (!existing) return;
    if (!facilityName) facilityName = existing.facility_name;
    if (!('prefecture' in body)) prefecture = existing.prefecture || '';
    if (!('latitude' in body)) latitude = existing.latitude;
    if (!('longitude' in body)) longitude = existing.longitude;
  }

  if (hasCoordinates(latitude, longitude) || facilityName.trim().length < 2) return;

  try {
    const place = await locateFacility(facilityName, prefecture || undefined, AbortSignal.timeout(20000));
    if (!place) return;
    assignPlace(body, place, prefecture);
  } catch (error) {
    console.error('OpenPOI lookup failed', error instanceof Error ? error.message : 'unknown');
  }
}

function hasCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude)
    && typeof longitude === 'number' && Number.isFinite(longitude);
}

function assignPlace(body: Record<string, unknown>, place: PoiPlace, prefecture: string): void {
  body.latitude = place.latitude;
  body.longitude = place.longitude;
  if (typeof body.address !== 'string' || !body.address.trim()) body.address = place.address || null;
  body.poiName = place.name;
  body.poiLicenses = place.licenses;
  body.poiAttributions = place.attributions;
  if (!prefecture && place.prefecture) body.prefecture = place.prefecture;
}

function serialize(key: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (JSON_FIELDS.has(key)) {
    if (value === null) return null;
    return JSON.stringify(value);
  }
  return value;
}

function parseJson(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function toVisit(row: VisitRow) {
  return {
    id: row.id,
    date: row.date,
    facilityName: row.facility_name,
    staffName: row.staff_name,
    prefecture: row.prefecture || undefined,
    rank: row.rank,
    judgment: row.judgment,
    environment: row.environment,
    imitationTable: row.imitation_table,
    registerCount: row.register_count || undefined,
    spaceSize: row.space_size || undefined,
    spaceSizeNote: row.space_size_note || undefined,
    trafficCount: row.traffic_count || undefined,
    trafficCountNote: row.traffic_count_note || undefined,
    demographics: parseJson(row.demographics),
    demographicsNote: row.demographics_note || undefined,
    flowLine: row.flow_line || undefined,
    flowLineNote: row.flow_line_note || undefined,
    competitors: row.competitors || undefined,
    competitorsNote: row.competitors_note || undefined,
    staffCount: row.staff_count || undefined,
    seasonality: row.seasonality || undefined,
    busyDay: row.busy_day || undefined,
    busyDayNote: row.busy_day_note || undefined,
    overallReview: row.overall_review || undefined,
    conditions: row.conditions || undefined,
    photoUrl: row.photo_url || undefined,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address || undefined,
    poiName: row.poi_name || undefined,
    poiLicenses: parseJson(row.poi_licenses),
    poiAttributions: parseJson(row.poi_attributions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
