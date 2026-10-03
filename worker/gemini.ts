const GEMINI_MODELS = [
  { version: 'v1beta', model: 'gemini-2.5-flash' },
  { version: 'v1beta', model: 'gemini-flash-latest' },
  { version: 'v1beta', model: 'gemini-2.0-flash' },
] as const;

const geminiCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  error?: { message?: string };
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
}

function geminiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...geminiCors,
      'Content-Type': 'application/json',
    },
  });
}

function extractText(data: GeminiResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) return null;
  for (const part of parts) {
    if (part.text) return part.text;
  }
  return null;
}

async function callGemini(apiKey: string, prompt: string): Promise<Response> {
  let lastError = 'Gemini API request failed';
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const { version, model } = GEMINI_MODELS[i];
    const isLast = i === GEMINI_MODELS.length - 1;
    const apiUrl = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        lastError = await response.text();
        console.error(`${version}/${model} error:`, lastError);
        if (!isLast) continue;
        return geminiJson(
          { error: 'Gemini API request failed', details: lastError },
          response.status,
        );
      }
      const data = (await response.json()) as GeminiResponse;
      if (data.error) {
        lastError = data.error.message || 'Gemini API error';
        if (!isLast) continue;
        return geminiJson({ error: lastError }, 400);
      }
      const result = extractText(data) || '検索結果を取得できませんでした。もう一度お試しください。';
      return geminiJson({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      lastError = message;
      console.error(`${version}/${model} failed:`, message);
      if (!isLast) continue;
      if (error instanceof Error && error.name === 'AbortError') {
        return geminiJson(
          { error: '検索がタイムアウトしました。時間をおいて再度お試しください。' },
          504,
        );
      }
      return geminiJson({ error: 'Internal server error', message }, 500);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return geminiJson({ error: lastError }, 502);
}

/** ログイン不要の既存 AI 検索。本番 Worker が既に提供している経路を残す。 */
export async function handleGemini(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: geminiCors });
  }
  if (request.method !== 'POST') {
    return geminiJson({ error: 'Method not allowed' }, 405);
  }
  if (!env.GEMINI_API_KEY) {
    return geminiJson({ error: 'GEMINI_API_KEY is not set' }, 503);
  }
  try {
    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return geminiJson({ error: 'Prompt is required' }, 400);
    return await callGemini(env.GEMINI_API_KEY, prompt);
  } catch (error) {
    console.error('Gemini proxy error:', error instanceof Error ? error.message : 'unknown');
    return geminiJson(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}
