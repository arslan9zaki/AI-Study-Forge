// AIbiztools Cloudflare Worker — Gemini Proxy
// Handles CORS, validation, rate limiting, and error handling.
// Deploy with: wrangler deploy
// Set secret:  wrangler secret put GEMINI_API_KEY

const ALLOWED_ORIGINS = [
  "https://arslan9zaki.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8000"
];

const ALLOWED_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-pro"
];

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

function getAllowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
  });
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request, event.env));
});

async function handleRequest(request, env) {
  const origin = getAllowedOrigin(request);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Block unknown origins
  if (!origin) {
    return jsonResponse({ error: "Origin not allowed" }, 403, null);
  }

  // Health check
  if (request.method === "GET") {
    return jsonResponse({ status: "ok", service: "aibiztools-worker", version: "2.0" }, 200, origin);
  }

  // Only POST allowed
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  // Rate limiting by IP
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (isRateLimited(ip)) {
    return jsonResponse({ error: "Too many requests. Please wait a moment and try again." }, 429, origin);
  }

  // Validate API key configured on server
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: "Server configuration error: API key not set. Contact the site admin." }, 500, origin);
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
  }

  const { model, prompt, systemPrompt } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return jsonResponse({ error: "Missing or too-short prompt" }, 400, origin);
  }

  // Sanitize prompt length (max 8000 chars)
  const safePrompt = prompt.trim().slice(0, 8000);
  const modelName  = (model && ALLOWED_MODELS.includes(model)) ? model : "gemini-2.0-flash";

  // Build Gemini request — include optional system instruction
  const geminiUrl  = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const geminiBody = {
    contents: [{ role: "user", parts: [{ text: safePrompt }] }],
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 2048,
      topP: 0.95
    }
  };

  if (systemPrompt && typeof systemPrompt === "string") {
    geminiBody.systemInstruction = { parts: [{ text: systemPrompt.slice(0, 1000) }] };
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 20000);

  let geminiRes;
  try {
    geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify(geminiBody),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return jsonResponse({ error: "Request timed out. Please try again." }, 504, origin);
    }
    return jsonResponse({ error: "Failed to reach Gemini API" }, 502, origin);
  }
  clearTimeout(timeoutId);

  if (!geminiRes.ok) {
    let errorData;
    try { errorData = await geminiRes.json(); } catch (_) { errorData = {}; }
    return jsonResponse(
      { error: errorData?.error?.message || `Gemini API error (${geminiRes.status})` },
      geminiRes.status,
      origin
    );
  }

  let data;
  try { data = await geminiRes.json(); } catch (_) {
    return jsonResponse({ error: "Invalid response from Gemini API" }, 502, origin);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text) {
    return jsonResponse({ error: "Gemini returned an empty response. Try rephrasing your input." }, 502, origin);
  }

  return jsonResponse({ text, model: modelName }, 200, origin);
}
