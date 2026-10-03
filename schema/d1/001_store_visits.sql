CREATE TABLE IF NOT EXISTS store_visits (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  prefecture TEXT,
  rank TEXT NOT NULL CHECK (rank IN ('S', 'A', 'B', 'C', 'D')),
  judgment TEXT NOT NULL CHECK (judgment IN ('pending', 'negotiating', 'approved', 'rejected', 'S', 'A', 'B', 'C', 'D')),
  environment TEXT NOT NULL CHECK (environment IN ('屋内', '半屋内', '屋外')),
  imitation_table TEXT NOT NULL CHECK (imitation_table IN ('設置可', '条件付', '不可')),
  register_count TEXT,
  space_size TEXT,
  space_size_note TEXT,
  traffic_count TEXT,
  traffic_count_note TEXT,
  demographics TEXT,
  demographics_note TEXT,
  flow_line TEXT,
  flow_line_note TEXT,
  competitors TEXT,
  competitors_note TEXT,
  staff_count TEXT,
  seasonality TEXT,
  busy_day TEXT,
  busy_day_note TEXT,
  overall_review TEXT,
  conditions TEXT,
  photo_url TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  poi_name TEXT,
  poi_licenses TEXT,
  poi_attributions TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_store_visits_date ON store_visits(date);
CREATE INDEX IF NOT EXISTS idx_store_visits_rank ON store_visits(rank);
CREATE INDEX IF NOT EXISTS idx_store_visits_judgment ON store_visits(judgment);
CREATE INDEX IF NOT EXISTS idx_store_visits_prefecture ON store_visits(prefecture);
CREATE INDEX IF NOT EXISTS idx_store_visits_facility_name ON store_visits(facility_name);
