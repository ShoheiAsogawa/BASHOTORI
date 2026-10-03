interface Env {
  GEMINI_API_KEY?: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  error?: { message?: string };
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
}

const GEMINI_MODELS = [
  { version: "v1beta", model: "gemini-2.5-flash" },
  { version: "v1beta", model: "gemini-flash-latest" },
  { version: "v1beta", model: "gemini-2.0-flash" },
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractText(data: GeminiResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) {
    return null;
  }
  for (const part of parts) {
    if (part.text) {
      return part.text;
    }
  }
  return null;
}

async function callGemini(apiKey: string, prompt: string): Promise<Response> {
  let lastError = "Gemini API request failed";
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const { version, model } = GEMINI_MODELS[i];
    const isLast = i === GEMINI_MODELS.length - 1;
    const apiUrl = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        lastError = await response.text();
        console.error(`${version}/${model} error:`, lastError);
        if (!isLast) {
          continue;
        }
        return jsonResponse(
          { error: "Gemini API request failed", details: lastError },
          response.status,
        );
      }
      const data = (await response.json()) as GeminiResponse;
      if (data.error) {
        lastError = data.error.message || "Gemini API error";
        if (!isLast) {
          continue;
        }
        return jsonResponse({ error: lastError }, 400);
      }
      const result =
        extractText(data) ||
        "検索結果を取得できませんでした。もう一度お試しください。";
      return jsonResponse({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      lastError = message;
      console.error(`${version}/${model} failed:`, message);
      if (!isLast) {
        continue;
      }
      if (error instanceof Error && error.name === "AbortError") {
        return jsonResponse(
          { error: "検索がタイムアウトしました。時間をおいて再度お試しください。" },
          504,
        );
      }
      return jsonResponse({ error: "Internal server error", message }, 500);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return jsonResponse({ error: lastError }, 502);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/gemini") {
      return new Response("Not found", { status: 404 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: "GEMINI_API_KEY is not set" }, 503);
    }
    try {
      const body = (await request.json()) as { prompt?: unknown };
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) {
        return jsonResponse({ error: "Prompt is required" }, 400);
      }
      return await callGemini(env.GEMINI_API_KEY, prompt);
    } catch (error) {
      console.error("Gemini proxy error:", error);
      return jsonResponse(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
};
