-- 視察店舗の地図表示用。OpenPOI API の検索結果を保存するときは
-- licenses / attributions もレコードと一緒に残す。

ALTER TABLE store_visits
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS poi_name TEXT,
  ADD COLUMN IF NOT EXISTS poi_licenses JSONB,
  ADD COLUMN IF NOT EXISTS poi_attributions JSONB;

CREATE INDEX IF NOT EXISTS idx_store_visits_location
  ON store_visits (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
