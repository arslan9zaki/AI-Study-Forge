/**
 * AI Study Forge — Cloudflare Worker (Gemini Multi-Model Fallback)
 * 3-Model Rotation: gemini-2.5-flash → gemini-2.0-flash-lite → gemini-1.5-flash
 * Exponential backoff per model, then cross-model fallback
 */

const ALLOWED_ORIGINS = [
  "https://arslan9zaki.github.io",
  "https://ai-study-forge.arslan9zaki.workers.dev",
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash"
];

const LOW_TEMP_KEYWORDS = ["json", "array", "interview", "questions", "list of"];

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow any subdirectory of arslan9zaki.github.io
  if (origin.startsWith("https://arslan9zaki.github.io")) return origin;
  return null;
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

async function callGemini(apiKey, modelName, prompt, systemPrompt, temperature) {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 4096, candidateCount: 1 }
  };
  if (systemPrompt && systemPrompt.trim()) {
    body.systemInstruction = { role: "system", parts: [{ text: systemPrompt.trim() }] };
  }
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body:    JSON.stringify(body),
        signal:  ctrl.signal
      }
    );
  } catch (e) {
    clearTimeout(tid);
    return {
      ok: false,
      status: 503,
      error: e.name === "AbortError" ? `${modelName} timed out (20s)` : e.message,
      model: modelName
    };
  }
  clearTimeout(tid);

  const raw = await res.text();
  console.log(`[${modelName}] status: ${res.status}, body: ${raw.slice(0, 500)}`);

  if (!res.ok) {
    let p = null;
    try { p = JSON.parse(raw); } catch (_) {}
    const errorMsg = p?.error?.message || raw.slice(0, 300);
    const isRateLimit =
      res.status === 429 ||
      errorMsg.toLowerCase().includes("quota") ||
      errorMsg.toLowerCase().includes("rate limit") ||
      errorMsg.toLowerCase().includes("too many requests") ||
      errorMsg.toLowerCase().includes("resource exhausted");
    return { ok: false, status: res.status, error: errorMsg, model: modelName, isRateLimit };
  }

  let data;
  try { data = JSON.parse(raw); } catch (_) {
    return { ok: false, status: 502, error: "Unreadable Gemini response", model: modelName };
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const fin  = data?.candidates?.[0]?.finishReason ?? "STOP";
  if (!text) {
    return { ok: false, status: 422, error: "Gemini returned empty content. Reason: " + fin, model: modelName };
  }
  return { ok: true, text, model: modelName, finishReason: fin };
}

async function callGeminiWithRetries(apiKey, modelName, prompt, systemPrompt, temperature, maxRetries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await callGemini(apiKey, modelName, prompt, systemPrompt, temperature);
    if (result.ok) return result;
    lastError = result;
    const shouldRetry = result.isRateLimit || result.status >= 500;
    if (!shouldRetry || attempt === maxRetries) break;
    const delay = Math.min((2 ** attempt) * 1000, 8000);
    console.log(`[${modelName}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms — ${result.error}`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return lastError;
}

async function callGeminiWithFallback(apiKey, prompt, systemPrompt, temperature) {
  let lastError = null;
  const triedModels = [];
  for (const modelName of GEMINI_MODELS) {
    triedModels.push(modelName);
    const result = await callGeminiWithRetries(apiKey, modelName, prompt, systemPrompt, temperature, 2);
    if (result.ok) {
      return { ...result, fallbackUsed: triedModels.length > 1, triedModels };
    }
    lastError = result;
    console.log(`[${modelName}] Failed, trying next model...`);
    if (modelName !== GEMINI_MODELS[GEMINI_MODELS.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return {
    ok: false,
    error: lastError?.error || "All Gemini models failed",
    status: lastError?.status || 503,
    model: "all-failed",
    triedModels
  };
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request);
    const url    = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin || ALLOWED_ORIGINS[0])
      });
    }

    // ── Block unknown origins ───────────────────────────────
    if (!origin) {
      return jsonError("Origin not allowed", 403, ALLOWED_ORIGINS[0]);
    }

    // ── GET /health ─────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonOk({
        status:           "ok",
        timestamp:        Date.now(),
        geminiConfigured: !!env.GEMINI_API_KEY,
        modelsAvailable:  GEMINI_MODELS
      }, origin);
    }

    // ── GET /debug ──────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/debug") {
      if (!env.GEMINI_API_KEY) {
        return jsonOk({ geminiWorking: false, error: "No API key" }, origin);
      }
      const results = {};
      for (const model of GEMINI_MODELS) {
        const r = await callGemini(env.GEMINI_API_KEY, model, "Say hello", "", 0.5);
        results[model] = {
          working: r.ok,
          error:   r.error || null,
          text:    r.ok ? r.text.slice(0, 100) : null
        };
      }
      return jsonOk({
        geminiWorking: Object.values(results).some(r => r.working),
        modelTests:    results,
        timestamp:     Date.now()
      }, origin);
    }

    // ── GET / (status) ──────────────────────────────────────
    if (request.method === "GET") {
      return jsonOk({
        status:           "ok",
        service:          "ai-study-forge",
        geminiConfigured: !!env.GEMINI_API_KEY,
        modelsAvailable:  GEMINI_MODELS,
        timestamp:        Date.now()
      }, origin);
    }

    // ── Non-POST ────────────────────────────────────────────
    if (request.method !== "POST") {
      return jsonError("Use POST", 405, origin);
    }

    // ── API key guard ───────────────────────────────────────
    if (!env.GEMINI_API_KEY) {
      return jsonError("No Gemini API key configured. Run: npx wrangler secret put GEMINI_API_KEY", 500, origin);
    }

    // ── Content-Type guard ──────────────────────────────────
    const ct = request.headers.get("Content-Type") || "";
    if (!ct.includes("application/json")) {
      return jsonError("Content-Type must be application/json", 415, origin);
    }

    // ── Parse body ──────────────────────────────────────────
    let body;
    try { body = await request.json(); }
    catch (_) { return jsonError("Invalid JSON in request body", 400, origin); }

    const { prompt, systemPrompt, model } = body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return jsonError("Missing or empty field: prompt", 400, origin);
    }

    const needsLowTemp = LOW_TEMP_KEYWORDS.some(kw => prompt.toLowerCase().includes(kw));
    const temperature  = needsLowTemp ? 0.2 : 0.8;

    // ── Generate ────────────────────────────────────────────
    let result;

    if (model && GEMINI_MODELS.includes(model)) {
      // User requested specific model — try it first, then fall back
      const specificResult = await callGeminiWithRetries(
        env.GEMINI_API_KEY, model, prompt.trim(), systemPrompt || "", temperature, 2
      );
      if (specificResult.ok) {
        result = { ...specificResult, fallbackUsed: false, triedModels: [model] };
      } else {
        const otherModels = GEMINI_MODELS.filter(m => m !== model);
        for (const fallbackModel of otherModels) {
          const fallbackResult = await callGeminiWithRetries(
            env.GEMINI_API_KEY, fallbackModel, prompt.trim(), systemPrompt || "", temperature, 1
          );
          if (fallbackResult.ok) {
            result = { ...fallbackResult, fallbackUsed: true, triedModels: [model, fallbackModel] };
            break;
          }
        }
        if (!result) result = specificResult;
      }
    } else {
      // No model specified — full fallback chain
      result = await callGeminiWithFallback(
        env.GEMINI_API_KEY, prompt.trim(), systemPrompt || "", temperature
      );
    }

    // ── Success ─────────────────────────────────────────────
    if (result.ok) {
      return jsonOk({
        text:         result.text,
        model:        result.model,
        finishReason: result.finishReason,
        provider:     "gemini",
        fallbackUsed: result.fallbackUsed || false,
        triedModels:  result.triedModels  || [result.model]
      }, origin);
    }

    // ── All models failed ───────────────────────────────────
    return jsonError(
      result.error || "All Gemini models failed",
      result.status || 503,
      origin,
      {
        triedModels:  result.triedModels || GEMINI_MODELS,
        suggestion:   "All models are at capacity. Free tier: ~15-30 req/min per model. Try again in 60 seconds.",
        retryAfter:   60
      }
    );
  }
};