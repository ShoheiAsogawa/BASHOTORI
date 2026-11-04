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
  recorded_by: string | null;
  recorded_role: string | null;
}

let visitColumnsReady: Promise<void> | null = null;

function ensureVisitColumns(env: Env): Promise<void> {
  visitColumnsReady ??= (async () => {
    const info = await env.DB.prepare('PRAGMA table_info(store_visits)').all<{ name: string }>();
    const names = new Set((info.results || []).map((column) => column.name));
    if (!names.has('recorded_by')) {
      await env.DB.prepare('ALTER TABLE store_visits ADD COLUMN recorded_by TEXT').run();
    }
    if (!names.has('recorded_role')) {
      await env.DB.prepare("ALTER TABLE store_visits ADD COLUMN recorded_role TEXT NOT NULL DEFAULT 'admin'").run();
    }
    await env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_store_visits_recorded_by ON store_visits(recorded_by)',
    ).run();
  })().catch((error: unknown) => {
    visitColumnsReady = null;
    throw error;
  });
  return visitColumnsReady;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function visitOwner(env: Env, id: string): Promise<string | null | undefined> {
  await ensureVisitColumns(env);
  const row = await env.DB.prepare(
    'SELECT recorded_by FROM store_visits WHERE id = ?',
  ).bind(id).first<{ recorded_by: string | null }>();
  if (!row) return undefined;
  return row.recorded_by;
}

export async function canAttachToVisit(env: Env, user: AuthUser, id: string): Promise<boolean> {
  if (user.role === 'readonly' || !isUuid(id)) return false;
  if (user.role === 'admin') return true;
  const owner = await visitOwner(env, id);
  if (owner === undefined) return true;
  return owner === user.id;
}

export async function canModifyVisit(env: Env, user: AuthUser, id: string): Promise<boolean> {
  await ensureVisitColumns(env);
  if (user.role === 'readonly') return false;
  if (user.role === 'admin') {
    const row = await env.DB.prepare('SELECT id FROM store_visits WHERE id = ?').bind(id).first();
    return Boolean(row);
  }
  const row = await env.DB.prepare(
    'SELECT id FROM store_visits WHERE id = ? AND recorded_by = ?',
  ).bind(id, user.id).first();
  return Boolean(row);
}

export async function handleVisits(request: Request, env: Env, user: AuthUser, id: string | null): Promise<Response> {
  await ensureVisitColumns(env);
  if (request.method === 'GET' && !id) return listVisits(env, user);
  if (request.method === 'POST' && !id) return writeVisit(request, env, user, null);
  if (request.method === 'PATCH' && id) return writeVisit(request, env, user, id);
  if (request.method === 'DELETE' && id) return deleteVisit(env, user, id);
  return json({ error: 'Method not allowed' }, 405);
}

async function listVisits(env: Env, user: AuthUser): Promise<Response> {
  const query = user.role === 'general'
    ? env.DB.prepare('SELECT * FROM store_visits WHERE recorded_by = ? ORDER BY date DESC').bind(user.id)
    : env.DB.prepare('SELECT * FROM store_visits ORDER BY date DESC');
  const { results } = await query.all<VisitRow>();
  return json((results || []).map(toVisit));
}

const REQUIRED_FIELDS = ['date', 'facilityName', 'staffName', 'rank', 'judgment', 'environment', 'imitationTable'] as const;

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 1_000_000) return json({ error: 'リクエストが大きすぎます' }, 413);
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '不正なリクエストです' }, 400);
    return body as Record<string, unknown>;
  } catch {
    return json({ error: '不正なリクエストです' }, 400);
  }
}

function hasRequiredFields(body: Record<string, unknown>): boolean {
  return REQUIRED_FIELDS.every((key) => typeof body[key] === 'string' && body[key].trim().length > 0);
}

async function writeVisit(request: Request, env: Env, user: AuthUser, id: string | null): Promise<Response> {
  if (user.role === 'readonly') return json({ error: 'Forbidden' }, 403);
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (id && !(await canModifyVisit(env, user, id))) return json({ error: 'Not found' }, 404);

  const now = new Date().toISOString();
  let visitId = id;
  if (!visitId) {
    if (!hasRequiredFields(body)) return json({ error: '必須項目が不足しています' }, 400);
    const requested = typeof body.id === 'string' ? body.id.trim().toLowerCase() : '';
    visitId = isUuid(requested) ? requested : crypto.randomUUID();
    if ((await visitOwner(env, visitId)) !== undefined) return json({ error: 'Not found' }, 404);
  }
  await ensureLocation(body, id, env);

  try {
    if (!id) {
      const columns = ['id', 'created_at', 'updated_at'];
      const values: unknown[] = [visitId, now, now];
      for (const [key, column] of Object.entries(COLUMNS)) {
        if (!(key in body)) continue;
        columns.push(column);
        values.push(serialize(key, body[key]));
      }
      columns.push('recorded_by', 'recorded_role');
      values.push(user.id, user.role === 'general' ? 'general' : 'admin');
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
    let sql = `UPDATE store_visits SET ${assignments.join(', ')} WHERE id = ?`;
    if (user.role !== 'admin') {
      sql += ' AND recorded_by = ?';
      values.push(user.id);
    }
    const result = await env.DB.prepare(sql).bind(...values).run();
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return json(await readVisit(env, id));
  } catch (error) {
    console.error('visit write failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: '保存できませんでした' }, 400);
  }
}

async function deleteVisit(env: Env, user: AuthUser, id: string): Promise<Response> {
  if (!(await canModifyVisit(env, user, id))) return json({ error: 'Not found' }, 404);
  const result = user.role === 'admin'
    ? await env.DB.prepare('DELETE FROM store_visits WHERE id = ?').bind(id).run()
    : await env.DB.prepare('DELETE FROM store_visits WHERE id = ? AND recorded_by = ?').bind(id, user.id).run();
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

  if (body.skipGeocode === true) return;
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
    recordedBy: row.recorded_by || undefined,
    recordedRole: row.recorded_role === 'general' ? 'general' : 'admin',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
