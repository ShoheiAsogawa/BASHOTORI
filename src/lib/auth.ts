export type UserRole = 'readonly' | 'admin' | null;

export interface SessionUser {
  id: string;
  email: string;
  role: 'admin' | 'readonly';
}

let cached: SessionUser | null | undefined;

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '';
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const response = await fetch(`${apiBase()}/api/auth/me`, { credentials: 'include' });
  if (!response.ok) {
    cached = null;
    return null;
  }
  const user = (await response.json()) as SessionUser;
  cached = user;
  return user;
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const response = await fetch(`${apiBase()}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({})) as { error?: string; id?: string; email?: string; role?: SessionUser['role'] };
  if (!response.ok || !body.id || !body.email || (body.role !== 'admin' && body.role !== 'readonly')) {
    throw new Error(body.error || 'ログインに失敗しました');
  }
  const user: SessionUser = { id: body.id, email: body.email, role: body.role };
  cached = user;
  return user;
}

export async function logout(): Promise<void> {
  await fetch(`${apiBase()}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  cached = null;
  window.location.assign('/login');
}

export async function getUserRole(): Promise<UserRole> {
  const user = cached !== undefined ? cached : await getCurrentUser();
  return user?.role ?? null;
}

export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}

export async function isReadOnly(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'readonly';
}
