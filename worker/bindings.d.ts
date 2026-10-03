interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  ALLOW_DEV_AUTH?: string;
}
