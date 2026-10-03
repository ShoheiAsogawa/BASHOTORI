const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'deepseek-v4-pro';

interface OutputPart {
  type?: string;
  text?: string;
}

interface OutputItem {
  type?: string;
  content?: OutputPart[];
}

interface DeepSeekResponse {
  error?: { message?: string } | null;
  output?: OutputItem[];
  output_text?: string;
}

function aiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
    },
  });
}

function extractText(data: DeepSeekResponse): string | null {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return cleanup(data.output_text);
  }
  const chunks: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text) chunks.push(part.text);
    }
  }
  const text = chunks.join('\n').trim();
  return text ? cleanup(text) : null;
}

function cleanup(text: string): string {
  return text.replace(/^\s*<result>\s*/i, '').replace(/\s*<\/result>\s*$/i, '').trim();
}

async function callDeepSeek(apiKey: string, prompt: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 110_000);
  try {
    const response = await fetch('https://api.deepseek.com/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: 'あなたは日本の商業施設を調べる担当です。ウェブ検索で確認できた事実だけを、日本語のマークダウンで答えてください。',
        input: prompt,
        tools: [{ type: 'web_search' }],
        tool_choice: { type: 'web_search' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const details = await response.text();
      console.error('DeepSeek error', response.status, details.slice(0, 500));
      return aiJson({ error: '検索サービスへの依頼に失敗しました' }, response.status >= 500 ? 502 : 400);
    }
    const data = (await response.json()) as DeepSeekResponse;
    if (data.error?.message) {
      console.error('DeepSeek response error', data.error.message);
      return aiJson({ error: '検索結果を整理できませんでした' }, 502);
    }
    const result = extractText(data);
    if (!result) return aiJson({ error: '検索結果を取得できませんでした。もう一度お試しください。' }, 502);
    return aiJson({ result });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return aiJson({ error: '検索がタイムアウトしました。時間をおいて再度お試しください。' }, 504);
    }
    console.error('DeepSeek request failed', error instanceof Error ? error.message : 'unknown');
    return aiJson({ error: '検索サービスに接続できませんでした' }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** ログイン不要の AI 検索。既存の /api/gemini からも呼ぶ。 */
export async function handleDeepSeek(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return aiJson({ error: 'Method not allowed' }, 405);
  }
  if (!env.DEEPSEEK_API_KEY) {
    return aiJson({ error: 'DEEPSEEK_API_KEY is not set' }, 503);
  }
  try {
    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return aiJson({ error: 'Prompt is required' }, 400);
    return await callDeepSeek(env.DEEPSEEK_API_KEY, prompt);
  } catch (error) {
    console.error('DeepSeek proxy error', error instanceof Error ? error.message : 'unknown');
    return aiJson({ error: '検索リクエストを読み取れませんでした' }, 400);
  }
}
