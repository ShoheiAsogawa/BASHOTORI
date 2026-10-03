import { authenticate } from './auth';
import { corsHeaders, isResponse, json } from './http';
import { handlePhotos, readPhoto } from './photos';
import { handleVisits } from './visits';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.startsWith('/api/photos/')) {
      const key = decodeURIComponent(url.pathname.slice('/api/photos/'.length));
      if (!key) return json({ error: 'Not found' }, 404);
      return readPhoto(env, key);
    }

    const user = await authenticate(request, env);
    if (isResponse(user)) return user;

    if (url.pathname === '/api/visits') {
      return handleVisits(request, env, user, null);
    }

    const visitMatch = url.pathname.match(/^\/api\/visits\/([^/]+)$/);
    if (visitMatch) {
      return handleVisits(request, env, user, decodeURIComponent(visitMatch[1]));
    }

    if (url.pathname === '/api/photos' || url.pathname.startsWith('/api/photos/')) {
      const key = url.pathname === '/api/photos'
        ? null
        : decodeURIComponent(url.pathname.slice('/api/photos/'.length));
      return handlePhotos(request, env, user, key);
    }

    return json({ error: 'Not found' }, 404);
  },
};
