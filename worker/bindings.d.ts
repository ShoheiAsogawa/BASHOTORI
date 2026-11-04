interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  DEEPSEEK_API_KEY?: string;
  ALLOW_DEV_AUTH?: string;
  // ユーザーが一人もいないとき、このメールとパスワードで最初の管理者を作る。secret で渡す。
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  // POST /api/auth/setup で最初の管理者を作るときのワンタイムトークン。secret で渡す。
  AUTH_SETUP_TOKEN?: string;
}
