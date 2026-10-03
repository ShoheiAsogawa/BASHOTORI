import { json } from './http';

export interface AuthUser {
  id: string;
  role: 'admin' | 'readonly';
}

export async function authenticate(request: Request, env: Env): Promise<AuthUser | Response> {
  if (env.ALLOW_DEV_AUTH === '1') {
    const devRole = request.headers.get('X-Dev-User');
    if (devRole === 'admin' || devRole === 'readonly') {
      return { id: 'dev', role: devRole };
    }
  }

  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const user = (await response.json()) as { id?: string; user_metadata?: { role?: string } };
  if (!user.id) return json({ error: 'Unauthorized' }, 401);
  return {
    id: user.id,
    role: user.user_metadata?.role === 'admin' ? 'admin' : 'readonly',
  };
}
