import { json } from './http';
import { hashPassword, secretsEqual, verifyPassword } from './password';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'readonly';
}

const COOKIE = 'bashotori_session';
const SESSION_SECONDS = 60 * 60 * 24 * 14;

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'readonly';
}

let schemaReady: Promise<void> | null = null;
let dummyHash: Promise<string> | null = null;

function ensureAuthSchema(env: Env): Promise<void> {
  schemaReady ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'readonly')),
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at)'),
  ]).then(() => undefined).catch((error: unknown) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function placeholderHash(): Promise<string> {
  dummyHash ??= hashPassword('bashotori-placeholder-password');
  return dummyHash;
}

function sessionCookie(token: string, request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:';
  const parts = [`${COOKIE}=${token}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function readCookie(request: Request): string {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return '';
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !email.includes('@')) return null;
  if (email.startsWith('@') || email.endsWith('@') || email.includes(' ')) return null;
  return email;
}

function publicUser(user: Pick<AuthUser, 'id' | 'email' | 'role'>): AuthUser {
  return { id: user.id, email: user.email, role: user.role };
}

async function findUser(env: Env, email: string): Promise<UserRow | null> {
  return env.DB.prepare(
    'SELECT id, email, password_hash, role FROM app_users WHERE email = ?',
  ).bind(email).first<UserRow>();
}

async function userCount(env: Env): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM app_users').first<{ count: number }>();
  return row?.count ?? 0;
}

async function insertUser(
  env: Env,
  email: string,
  password: string,
  role: 'admin' | 'readonly',
): Promise<UserRow> {
  const user: UserRow = {
    id: crypto.randomUUID(),
    email,
    password_hash: await hashPassword(password),
    role,
  };
  await env.DB.prepare(
    'INSERT INTO app_users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(user.id, user.email, user.password_hash, user.role, new Date().toISOString()).run();
  return user;
}

async function issueSession(request: Request, env: Env, user: UserRow | AuthUser): Promise<Response> {
  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare(
      'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    ).bind(await tokenHash(token), user.id, now + SESSION_SECONDS),
  ]);
  return json(publicUser(user), 200, { 'Set-Cookie': sessionCookie(token, request, SESSION_SECONDS) });
}

async function maybeBootstrap(env: Env, email: string, password: string): Promise<UserRow | null> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return null;
  if (await userCount(env) > 0) return null;
  const [emailMatches, passwordMatches] = await Promise.all([
    secretsEqual(email, env.ADMIN_EMAIL.trim().toLowerCase()),
    secretsEqual(password, env.ADMIN_PASSWORD),
  ]);
  if (!emailMatches || !passwordMatches) return null;
  return insertUser(env, email, password, 'admin');
}

async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > 10_000) {
    return json({ error: 'リクエストが大きすぎます' }, 413);
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: '不正なリクエストです' }, 400);
    return body as Record<string, unknown>;
  } catch {
    return json({ error: '不正なリクエストです' }, 400);
  }
}

const LOGIN_ERROR = 'メールアドレスまたはパスワードが違います';

async function login(request: Request, env: Env): Promise<Response> {
  await ensureAuthSchema(env);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || password.length < 1 || password.length > 200) return json({ error: LOGIN_ERROR }, 401);

  let user = await findUser(env, email);
  if (!user) {
    try {
      user = await maybeBootstrap(env, email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('UNIQUE')) throw error;
      user = await findUser(env, email);
    }
  }
  const ok = await verifyPassword(password, user?.password_hash ?? await placeholderHash());
  if (!user || !ok) return json({ error: LOGIN_ERROR }, 401);
  return issueSession(request, env, user);
}

async function setup(request: Request, env: Env): Promise<Response> {
  if (!env.AUTH_SETUP_TOKEN) return json({ error: 'Not found' }, 404);
  await ensureAuthSchema(env);
  const provided = request.headers.get('X-Setup-Token') || '';
  if (!(await secretsEqual(provided, env.AUTH_SETUP_TOKEN))) return json({ error: 'Unauthorized' }, 401);
  if (await userCount(env) > 0) return json({ error: '初期ユーザーは作成済みです' }, 409);

  const body = await readJson(request);
  if (body instanceof Response) return body;
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || password.length < 8 || password.length > 200) {
    return json({ error: 'メールアドレスと8文字以上のパスワードが必要です' }, 400);
  }
  const user = await insertUser(env, email, password, 'admin');
  return issueSession(request, env, user);
}

async function createUser(request: Request, env: Env, actor: AuthUser): Promise<Response> {
  if (actor.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  await ensureAuthSchema(env);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const role = body.role === 'admin' || body.role === 'readonly' ? body.role : null;
  if (!email || !role || password.length < 8 || password.length > 200) {
    return json({ error: 'メールアドレス、8文字以上のパスワード、ロールが必要です' }, 400);
  }
  try {
    const user = await insertUser(env, email, password, role);
    return json(publicUser(user), 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE')) return json({ error: 'このメールアドレスは登録済みです' }, 409);
    throw error;
  }
}

export async function authenticate(request: Request, env: Env): Promise<AuthUser | Response> {
  if (env.ALLOW_DEV_AUTH === '1') {
    const devRole = request.headers.get('X-Dev-User');
    if (devRole === 'admin' || devRole === 'readonly') {
      return { id: 'dev', email: 'dev@localhost', role: devRole };
    }
  }

  const token = readCookie(request);
  if (!token) return json({ error: 'Unauthorized' }, 401);
  await ensureAuthSchema(env);
  const row = await env.DB.prepare(
    `SELECT u.id AS id, u.email AS email, u.role AS role
     FROM auth_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await tokenHash(token), Math.floor(Date.now() / 1000)).first<AuthUser>();
  if (!row || (row.role !== 'admin' && row.role !== 'readonly')) return json({ error: 'Unauthorized' }, 401);
  return publicUser(row);
}

export async function handleAuth(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === 'POST' && url.pathname === '/api/auth/login') return login(request, env);
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = readCookie(request);
    if (token) {
      await ensureAuthSchema(env);
      await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await tokenHash(token)).run();
    }
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', request, 0) });
  }
  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = await authenticate(request, env);
    if (user instanceof Response) return user;
    return json(user);
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/setup') return setup(request, env);
  if (request.method === 'POST' && url.pathname === '/api/auth/users') {
    const user = await authenticate(request, env);
    if (user instanceof Response) return user;
    return createUser(request, env, user);
  }
  return json({ error: 'Not found' }, 404);
}
