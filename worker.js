/**
 * AI Study Forge — Cloudflare Worker (Gemini Primary + OpenRouter Fallback)
 *
 * DEPLOY:
 *   npx wrangler secret put GEMINI_API_KEY
 *   npx wrangler secret put OPENROUTER_API_KEY
 *   npx wrangler deploy
 *
 * ALLOWED ORIGINS: update ALLOWED_ORIGINS if you add a custom domain.
 */

const ALLOWED_ORIGINS = [
  "https://ai-study-forge.arslan9zaki.workers.dev",
  "https://arslan9zaki.github.io",
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

const OR_MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-8b:free",
  "deepseek/deepseek-r1:free"
];

const LOW_TEMP_KEYWORDS = ["json", "array", "interview", "questions", "list of"];

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
    "Vary":                         "Origin"
  };
}

function jsonOk(data, origin) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

function jsonError(message, status, origin, extra) {
  return new Response(JSON.stringify({ error: message, ...(extra || {}) }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

async function callGemini(apiKey, prompt, systemPrompt, temperature) {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 4096, candidateCount: 1 }
  };
  if (systemPrompt && systemPrompt.trim()) {
    body.systemInstruction = { role: "system", parts: [{ text: systemPrompt.trim() }] };
  }
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 25000);
  let res;
  try {
    res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body:    JSON.stringify(body),
        signal:  ctrl.signal
      }
    );
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, status: 503, error: e.name === "AbortError" ? "Gemini timed out" : e.message };
  }
  clearTimeout(tid);
  const raw = await res.text();
  if (!res.ok) {
    let p = null;
    try { p = JSON.parse(raw); } catch (_) {}
    return { ok: false, status: res.status, error: p?.error?.message || raw.slice(0, 200) };
  }
  let data;
  try { data = JSON.parse(raw); } catch (_) {
    return { ok: false, status: 502, error: "Unreadable Gemini response" };
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const fin  = data?.candidates?.[0]?.finishReason ?? "STOP";
  if (!text) return { ok: false, status: 422, error: "Gemini empty: " + fin };
  return { ok: true, text, model: "gemini-2.0-flash", finishReason: fin };
}

async function callOpenRouter(apiKey, modelId, messages, temperature) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 30000);
  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + apiKey,
        "HTTP-Referer":  "https://ai-study-forge.arslan9zaki.workers.dev",
        "X-Title":       "AI Study Forge"
      },
      body:   JSON.stringify({ model: modelId, messages, temperature, max_tokens: 4096, stream: false }),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, status: 503, skip: true, error: e.message };
  }
  clearTimeout(tid);
  const raw = await res.text();
  if (!res.ok) {
    let p = null;
    try { p = JSON.parse(raw); } catch (_) {}
    return {
      ok: false,
      status: res.status,
      skip: res.status === 429 || res.status === 404 || res.status === 503,
      error: p?.error?.message || raw.slice(0, 200)
    };
  }
  let data;
  try { data = JSON.parse(raw); } catch (_) {
    return { ok: false, status: 502, skip: true, error: "Unreadable OR response" };
  }
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) return { ok: false, status: 422, skip: true, error: "Empty content" };
  return { ok: true, text, model: data?.model || modelId, finishReason: data?.choices?.[0]?.finish_reason ?? "stop" };
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin || ALLOWED_ORIGINS[0]) });
    }
    if (!origin) return jsonError("Origin not allowed", 403, ALLOWED_ORIGINS[0]);

    if (request.method === "GET") {
      const gKey = env.GEMINI_API_KEY || "";
      const oKey = env.OPENROUTER_API_KEY || "";
      return jsonOk({
        status:               "ok",
        service:              "ai-study-forge",
        geminiConfigured:     gKey.length > 0,
        geminiKeyPrefix:      gKey.length > 0 ? gKey.slice(0, 10) + "..." : "NOT SET",
        openrouterConfigured: oKey.length > 0,
        openrouterKeyPrefix:  oKey.length > 0 ? oKey.slice(0, 12) + "..." : "NOT SET",
        timestamp:            Date.now()
      }, origin);
    }

    if (request.method !== "POST") return jsonError("Use POST", 405, origin);
    if (!env.GEMINI_API_KEY && !env.OPENROUTER_API_KEY) return jsonError("No API keys configured", 500, origin);

    const ct = request.headers.get("Content-Type") || "";
    if (!ct.includes("application/json")) return jsonError("Content-Type must be application/json", 415, origin);

    let body;
    try { body = await request.json(); }
    catch (_) { return jsonError("Invalid JSON", 400, origin); }

    const { prompt, systemPrompt } = body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) return jsonError("Missing field: prompt", 400, origin);

    const needsLowTemp = LOW_TEMP_KEYWORDS.some(kw => prompt.toLowerCase().includes(kw));
    const temperature  = needsLowTemp ? 0.2 : 0.8;

    // Step 1: Try Gemini first
    if (env.GEMINI_API_KEY) {
      const r = await callGemini(env.GEMINI_API_KEY, prompt.trim(), systemPrompt || "", temperature);
      if (r.ok) return jsonOk({ text: r.text, model: r.model, finishReason: r.finishReason, provider: "gemini" }, origin);
      if (r.status === 422) return jsonError(r.error, r.status, origin);
    }

    // Step 2: OpenRouter fallbacks
    if (env.OPENROUTER_API_KEY) {
      const messages = [];
      if (systemPrompt && typeof systemPrompt === "string" && systemPrompt.trim()) {
        messages.push({ role: "system", content: systemPrompt.trim() });
      }
      messages.push({ role: "user", content: prompt.trim() });

      for (const modelId of OR_MODELS) {
        const r = await callOpenRouter(env.OPENROUTER_API_KEY, modelId, messages, temperature);
        if (r.ok) return jsonOk({ text: r.text, model: r.model, finishReason: r.finishReason, provider: "openrouter" }, origin);
        if (r.skip) continue;
        break;
      }
    }

    return jsonError("All AI providers are busy. Please try again in 30 seconds.", 429, origin);
  }
};
