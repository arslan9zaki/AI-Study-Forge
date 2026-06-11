/**
 * AI Study Forge — Cloudflare Worker (Gemini ONLY)
 * SIMPLIFIED VERSION — No OpenRouter fallback
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
  const tid  = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body:    JSON.stringify(body),
        signal:  ctrl.signal
      }
    );
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, status: 503, error: e.name === "AbortError" ? "Gemini timed out (20s)" : e.message };
  }
  clearTimeout(tid);
  const raw = await res.text();
  console.log(`Gemini status: ${res.status}, body: ${raw.slice(0, 500)}`);
  if (!res.ok) {
    let p = null;
    try { p = JSON.parse(raw); } catch (_) {}
    return { ok: false, status: res.status, error: p?.error?.message || raw.slice(0, 300) };
  }
  let data;
  try { data = JSON.parse(raw); } catch (_) {
    return { ok: false, status: 502, error: "Unreadable Gemini response" };
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const fin  = data?.candidates?.[0]?.finishReason ?? "STOP";
  if (!text) return { ok: false, status: 422, error: "Gemini returned empty content. Reason: " + fin };
  return { ok: true, text, model: "gemini-2.5-flash", finishReason: fin };
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin || ALLOWED_ORIGINS[0]) });
    }
    if (!origin) return jsonError("Origin not allowed", 403, ALLOWED_ORIGINS[0]);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonOk({
        status: "ok",
        timestamp: Date.now(),
        geminiConfigured: !!env.GEMINI_API_KEY
      }, origin);
    }

    if (request.method === "GET" && url.pathname === "/debug") {
      if (!env.GEMINI_API_KEY) {
        return jsonOk({ geminiWorking: false, error: "No API key" }, origin);
      }
      const r = await callGemini(env.GEMINI_API_KEY, "Say hello", "", 0.5);
      return jsonOk({
        geminiWorking: r.ok,
        error: r.error || null,
        text: r.ok ? r.text.slice(0, 100) : null
      }, origin);
    }

    if (request.method === "GET") {
      return jsonOk({
        status: "ok",
        service: "ai-study-forge",
        geminiConfigured: !!env.GEMINI_API_KEY,
        timestamp: Date.now()
      }, origin);
    }

    if (request.method !== "POST") return jsonError("Use POST", 405, origin);
    if (!env.GEMINI_API_KEY) return jsonError("No Gemini API key configured", 500, origin);

    const ct = request.headers.get("Content-Type") || "";
    if (!ct.includes("application/json")) return jsonError("Content-Type must be application/json", 415, origin);

    let body;
    try { body = await request.json(); }
    catch (_) { return jsonError("Invalid JSON", 400, origin); }

    const { prompt, systemPrompt } = body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) return jsonError("Missing field: prompt", 400, origin);

    const needsLowTemp = LOW_TEMP_KEYWORDS.some(kw => prompt.toLowerCase().includes(kw));
    const temperature  = needsLowTemp ? 0.2 : 0.8;

    // Use Gemini only
    const r = await callGemini(env.GEMINI_API_KEY, prompt.trim(), systemPrompt || "", temperature);
    if (r.ok) return jsonOk({ text: r.text, model: r.model, finishReason: r.finishReason, provider: "gemini" }, origin);
    
    // Return specific error
    return jsonError(r.error || "Gemini failed", r.status || 500, origin, { 
      suggestion: "If rate limited, wait 60 seconds and try again. Free tier: 15 requests/minute." 
    });
  }
};