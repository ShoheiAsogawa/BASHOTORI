import { readFileSync, writeFileSync } from 'node:fs';
import { locateFacility } from '../worker/openpoi.ts';
import { scorePlace, type PoiPlace } from '../shared/poi.ts';

interface InputRow {
  id: string;
  facility_name: string;
  prefecture: string | null;
}

interface CacheEntry {
  place: PoiPlace | null;
  score: number;
}

const inputPath = process.argv[2];
const reportPath = process.argv[3];
const sqlPath = process.argv[4];
const cachePath = process.argv[5];
if (!inputPath || !reportPath || !sqlPath || !cachePath) {
  console.error('usage: backfill_locations.ts <rows.json> <report.json> <out.sql> <cache.json>');
  process.exit(1);
}

const rows = JSON.parse(readFileSync(inputPath, 'utf8')) as InputRow[];
const cache = new Map<string, CacheEntry>(Object.entries(readCache(cachePath)));
const now = new Date().toISOString();
const found: Array<Record<string, unknown>> = [];
const missed: InputRow[] = [];
const statements: string[] = [];

for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  const key = `${row.prefecture || ''}|${row.facility_name}`;
  let entry = cache.get(key);
  if (!entry) {
    const place = await locateFacility(row.facility_name, row.prefecture || undefined);
    entry = { place, score: place ? scorePlace(row.facility_name, row.prefecture || undefined, place) : 0 };
    cache.set(key, entry);
    writeFileSync(cachePath, JSON.stringify(Object.fromEntries(cache), null, 2));
  }
  if (!entry.place) {
    missed.push(row);
    console.log(`MISS ${index + 1}/${rows.length} ${row.facility_name}`);
    continue;
  }
  found.push({
    id: row.id,
    facilityName: row.facility_name,
    prefecture: row.prefecture,
    poiName: entry.place.name,
    address: entry.place.address,
    latitude: entry.place.latitude,
    longitude: entry.place.longitude,
    score: entry.score,
    licenses: entry.place.licenses,
  });
  statements.push(updateSql(row.id, entry.place, now));
  console.log(`HIT  ${index + 1}/${rows.length} ${row.facility_name} => ${entry.place.name} (${entry.score})`);
}

writeFileSync(reportPath, JSON.stringify({ found: found.length, missed: missed.length, foundRows: found, missedRows: missed }, null, 2));
writeFileSync(sqlPath, `${statements.join('\n')}\n`);
console.log(`done found=${found.length} missed=${missed.length}`);

function updateSql(id: string, place: PoiPlace, updatedAt: string): string {
  return [
    'UPDATE store_visits SET',
    `latitude = ${place.latitude},`,
    `longitude = ${place.longitude},`,
    `address = ${sql(place.address || null)},`,
    `poi_name = ${sql(place.name)},`,
    `poi_licenses = ${sql(JSON.stringify(place.licenses))},`,
    `poi_attributions = ${sql(JSON.stringify(place.attributions))},`,
    `updated_at = ${sql(updatedAt)}`,
    `WHERE id = ${sql(id)} AND latitude IS NULL;`,
  ].join(' ');
}

function sql(value: string | null): string {
  if (value === null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function readCache(path: string): Record<string, CacheEntry> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}
