/**
 * PeakMode — AI Service (Groq backend)
 * ────────────────────────────────────────────────────────────
 * Still exports `askClaude(systemPrompt, userMessage)` with the
 * exact same signature so every route (chat, foodAdvisor,
 * ingredientScanner, workoutPlanner, schedule) works with ZERO changes.
 *
 * Provider: Groq  (https://console.groq.com)
 *   • Free tier — no credit card required
 *   • 14,400 requests/day  |  30 requests/minute
 *   • Fastest inference available (GroqCloud hardware)
 *   • OpenAI-compatible REST API
 *
 * Model: llama-3.3-70b-versatile
 *   — Groq's best free-tier model, excellent reasoning + instruction-following
 *
 * Setup (one-time, 2 minutes):
 *   1. Go to https://console.groq.com  → sign up with Google
 *   2. Click "API Keys" → "Create API Key"
 *   3. Copy the key  (starts with  gsk_...)
 *   4. Add to server/.env:  GROQ_API_KEY=gsk_your_key_here
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';

// ── Retry config ──────────────────────────────────────────────────────────────
const MAX_RETRIES   = 2;    // initial attempt + 1 retry on 503
const BASE_DELAY_MS = 2000; // 2 s before a 503 retry

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * askClaude
 * ──────────
 * @param {string} systemPrompt  — sets the model's persona for this call
 * @param {string} userMessage   — the user's question / task
 * @returns {Promise<string>}    — the model's plain-text reply
 * @throws  {Error}              — rethrows API errors with clear messages
 */
const askClaude = async (systemPrompt, userMessage) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY is not set in .env.\n' +
      'Get a free key at https://console.groq.com → API Keys → Create API Key\n' +
      'Then add:  GROQ_API_KEY=gsk_...  to server/.env'
    );
  }

  const requestBody = JSON.stringify({
    model:    GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature:  0.7,
    max_tokens:   1024,
    stream:       false,
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[claudeService] Retrying Groq call (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(BASE_DELAY_MS);
    }

    const response = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: requestBody,
    });

    // ── Success ────────────────────────────────────────────────────────────
    if (response.ok) {
      const data = await response.json();
      // OpenAI-compatible response shape
      const text = data?.choices?.[0]?.message?.content;

      if (!text) {
        const reason = data?.choices?.[0]?.finish_reason;
        console.error('Groq returned no text. finish_reason:', reason, JSON.stringify(data));
        throw new Error('Groq returned no text content' + (reason ? ` (reason: ${reason})` : ''));
      }

      return text;
    }

    // ── Rate-limit (429) → fail fast with a clear message ─────────────────
    if (response.status === 429) {
      const errBody = await response.text();
      console.warn('[claudeService] Groq 429 — rate limited:', errBody);

      let retryAfterMsg = '';
      try {
        const parsed = JSON.parse(errBody);
        const retryAfter = parsed?.error?.message?.match(/try again in (\d+\.?\d*\s*\w+)/i)?.[1];
        if (retryAfter) retryAfterMsg = ` Please try again in ${retryAfter}.`;
      } catch { /* ignore */ }

      const err = new Error(
        `AI service is temporarily rate-limited.${retryAfterMsg}`
      );
      err.isRateLimit = true;
      err.statusCode  = 429;
      throw err;
    }

    // ── Temporary server error (503/502) → one retry ───────────────────────
    if (response.status === 503 || response.status === 502) {
      console.warn(`[claudeService] Groq ${response.status} on attempt ${attempt + 1}`);
      if (attempt < MAX_RETRIES - 1) continue;
      throw new Error('Groq service temporarily unavailable. Please try again shortly.');
    }

    // ── Other non-retryable errors ─────────────────────────────────────────
    const errBody = await response.text();
    console.error('[claudeService] Groq error:', response.status, errBody);
    throw new Error(`Groq API request failed with status ${response.status}`);
  }

  throw new Error('Groq API failed after maximum retries');
};

module.exports = { askClaude };