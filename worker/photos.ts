import type { AuthUser } from './auth';
import { json } from './http';

const MAX_BYTES = 8 * 1024 * 1024;

export async function handlePhotos(
  request: Request,
  env: Env,
  user: AuthUser,
  key: string | null,
): Promise<Response> {
  if (request.method === 'POST') return uploadPhoto(request, env, user);
  if (request.method === 'DELETE' && key) return deletePhoto(env, user, key);
  return json({ error: 'Method not allowed' }, 405);
}

export async function readPhoto(env: Env, key: string): Promise<Response> {
  const object = await env.PHOTOS.get(key);
  if (!object) return json({ error: 'Not found' }, 404);
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(object.body, { headers });
}

async function uploadPhoto(request: Request, env: Env, user: AuthUser): Promise<Response> {
  if (user.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  const form = await request.formData();
  const file = form.get('file');
  const visitId = form.get('visitId');
  if (!(file instanceof File)) return json({ error: 'File is required' }, 400);
  if (typeof visitId !== 'string' || !visitId.trim()) return json({ error: 'visitId is required' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is too large' }, 413);

  const extension = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `${visitId.trim()}/${crypto.randomUUID()}.${extension}`;
  await env.PHOTOS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  const url = new URL(`/api/photos/${encodeURIComponent(key)}`, request.url);
  return json({ id: key, url: url.toString() }, 201);
}

async function deletePhoto(env: Env, user: AuthUser, key: string): Promise<Response> {
  if (user.role !== 'admin') return json({ error: 'Forbidden' }, 403);
  await env.PHOTOS.delete(key);
  return json({ ok: true });
}
