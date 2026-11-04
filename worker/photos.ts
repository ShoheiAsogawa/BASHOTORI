import type { AuthUser } from './auth';
import { json } from './http';
import { canAttachToVisit, isUuid, visitOwner } from './visits';

const MAX_BYTES = 8 * 1024 * 1024;
const PHOTO_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/i;

export async function handlePhotos(
  request: Request,
  env: Env,
  user: AuthUser,
  key: string | null,
): Promise<Response> {
  if (request.method === 'GET' && key) return readPhoto(env, key, user);
  if (request.method === 'POST') return uploadPhoto(request, env, user);
  if (request.method === 'DELETE' && key) return deletePhoto(env, user, key);
  return json({ error: 'Method not allowed' }, 405);
}

function imageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  return null;
}

function safeContentType(value: string | undefined): 'image/jpeg' | 'image/png' | null {
  if (value === 'image/jpeg' || value === 'image/png') return value;
  return null;
}

async function generalOwnsPhoto(
  env: Env,
  user: AuthUser,
  key: string,
  metadataUserId: string | undefined,
): Promise<boolean> {
  const owner = await visitOwner(env, key.split('/')[0] || '');
  if (owner !== undefined) return owner === user.id;
  return metadataUserId === user.id;
}

export async function readPhoto(env: Env, key: string, user: AuthUser): Promise<Response> {
  if (!PHOTO_KEY.test(key)) return json({ error: 'Not found' }, 404);
  const object = await env.PHOTOS.get(key);
  if (!object) return json({ error: 'Not found' }, 404);
  if (user.role === 'general' && !(await generalOwnsPhoto(env, user, key, object.customMetadata?.userId))) {
    return json({ error: 'Not found' }, 404);
  }
  const type = safeContentType(object.httpMetadata?.contentType);
  const headers = new Headers();
  headers.set('Content-Type', type || 'application/octet-stream');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'private, max-age=3600');
  if (!type) headers.set('Content-Disposition', 'attachment');
  return new Response(object.body, { headers });
}

async function uploadPhoto(request: Request, env: Env, user: AuthUser): Promise<Response> {
  if (user.role === 'readonly') return json({ error: 'Forbidden' }, 403);
  const form = await request.formData();
  const file = form.get('file');
  const visitId = form.get('visitId');
  if (!(file instanceof File)) return json({ error: 'File is required' }, 400);
  if (typeof visitId !== 'string' || !isUuid(visitId.trim())) return json({ error: 'visitId is required' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is too large' }, 413);
  const id = visitId.trim().toLowerCase();
  if (!(await canAttachToVisit(env, user, id))) return json({ error: 'Not found' }, 404);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return json({ error: '画像ファイルだけアップロードできます' }, 400);
  const key = `${id}/${crypto.randomUUID()}.${type === 'image/png' ? 'png' : 'jpg'}`;
  await env.PHOTOS.put(key, bytes, {
    httpMetadata: { contentType: type },
    customMetadata: { userId: user.id },
  });

  const url = new URL(`/api/photos/${encodeURIComponent(key)}`, request.url);
  return json({ id: key, url: url.toString() }, 201);
}

async function deletePhoto(env: Env, user: AuthUser, key: string): Promise<Response> {
  if (user.role === 'readonly' || !PHOTO_KEY.test(key)) return json({ error: 'Not found' }, 404);
  const head = await env.PHOTOS.head(key);
  if (!head) return json({ error: 'Not found' }, 404);
  if (user.role === 'general' && !(await generalOwnsPhoto(env, user, key, head.customMetadata?.userId))) {
    return json({ error: 'Not found' }, 404);
  }
  await env.PHOTOS.delete(key);
  return json({ ok: true });
}
