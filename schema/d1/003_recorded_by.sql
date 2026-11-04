-- 誰が記録したか。既存行は管理者の記録として扱う。
ALTER TABLE store_visits ADD COLUMN recorded_by TEXT;
ALTER TABLE store_visits ADD COLUMN recorded_role TEXT NOT NULL DEFAULT 'admin';

CREATE INDEX IF NOT EXISTS idx_store_visits_recorded_by ON store_visits(recorded_by);
