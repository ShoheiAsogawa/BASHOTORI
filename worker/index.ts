import { authenticate } from './auth';
import { handleDeepSeek } from './deepseek';
import { reversePlace } from './nominatim';
import { corsHeaders, isResponse, json } from './http';
import { handlePhotos, readPhoto } from './photos';
import { handleVisits } from './visits';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/gemini') {
      return handleDeepSeek(request, env);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/photos/')) {
      const key = decodeURIComponent(url.pathname.slice('/api/photos/'.length));
      if (!key) return json({ error: 'Not found' }, 404);
      return readPhoto(env, key);
    }

    const user = await authenticate(request, env);
    if (isResponse(user)) return user;

    if (request.method === 'GET' && url.pathname === '/api/geocode/reverse') {
      const latitude = Number(url.searchParams.get('lat'));
      const longitude = Number(url.searchParams.get('lng'));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return json({ error: '緯度経度が不正です' }, 400);
      }
      try {
        const place = await reversePlace(latitude, longitude, request.signal);
        if (!place) return json({ error: '日本国内のピンだけ住所にできます' }, 400);
        return json(place);
      } catch (error) {
        console.error('reverse geocode failed', error instanceof Error ? error.message : 'unknown');
        return json({ error: '住所を取得できませんでした' }, 502);
      }
    }

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
