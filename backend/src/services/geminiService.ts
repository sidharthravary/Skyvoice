import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const modelName = () => process.env.GEMINI_MODEL || 'gemini-2.0-flash';

let _genAI: GoogleGenerativeAI | null = null;
let _model: GenerativeModel | null = null;
let _initialized = false;

// Circuit breaker: once daily quota is exhausted, stop hammering the API for 1 hour.
// This avoids 3 retries × 1.2s–2.4s wait on every pipeline call when quota is gone.
let _quotaExhaustedUntil = 0;

function markQuotaExhausted() {
  _quotaExhaustedUntil = Date.now() + 60 * 60 * 1000; // back off for 1 hour
  console.warn('[Gemini] Daily quota exhausted — disabling Gemini for 1 hour');
}

function isQuotaOpen(): boolean {
  if (_quotaExhaustedUntil === 0) return true;
  if (Date.now() > _quotaExhaustedUntil) {
    _quotaExhaustedUntil = 0;
    console.log('[Gemini] Quota cooldown expired — re-enabling');
    return true;
  }
  return false;
}

// Lazy init — called on first use so process.env is populated by dotenv at that point.
function getModel(): GenerativeModel | null {
  if (_initialized) return _model;
  _initialized = true;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your-gemini') || apiKey.includes('placeholder')) {
    console.log('[Gemini] No valid API key — Gemini layer disabled');
    return null;
  }

  try {
    _genAI = new GoogleGenerativeAI(apiKey);
    _model = _genAI.getGenerativeModel({ model: modelName() });
    console.log(`[Gemini] Initialized with model: ${modelName()}`);
  } catch (err) {
    console.error('[Gemini] Initialization failed:', err);
    _model = null;
  }
  return _model;
}

export function isGeminiReady(): boolean {
  return getModel() !== null && isQuotaOpen();
}

async function callWithRetry(fn: () => Promise<string>, retries = 2, delayMs = 800): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429      = err?.message?.includes('429') || err?.message?.includes('Too Many Requests');
      const isDailyQuota = err?.message?.includes('quota') || err?.message?.includes('Quota');

      // Daily quota exhausted → circuit breaker, no more retries
      if (isDailyQuota && !is429) {
        markQuotaExhausted();
        throw err;
      }
      if (isDailyQuota && is429) {
        // Could be daily OR per-minute; treat as daily if it's the second failure
        if (i >= 1) {
          markQuotaExhausted();
          throw err;
        }
      }

      // Per-minute rate limit → one retry with short backoff
      if (is429 && i < retries - 1) {
        console.warn(`[Gemini] Rate limited — retrying in ${delayMs}ms (attempt ${i + 1}/${retries})`);
        await new Promise(res => setTimeout(res, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Gemini: max retries exceeded');
}

export async function generateGeminiResponse(prompt: string, context: string): Promise<string> {
  const model = getModel();
  if (!model) throw new Error('Gemini not configured');
  const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
  return callWithRetry(async () => {
    const result = await model.generateContent(fullPrompt);
    return result.response.text().trim();
  });
}

const VALID_INTENTS = [
  'general_query', 'booking_request', 'project_inquiry',
  'operational_query', 'faq', 'escalation', 'greeting', 'farewell',
  'project_status_update', 'unknown',
] as const;

export async function analyzeWithGemini(
  text: string,
  task: 'intent' | 'sentiment' | 'reasoning'
): Promise<string> {
  const model = getModel();
  if (!model) throw new Error('Gemini not configured');

  let prompt: string;

  if (task === 'intent') {
    prompt = `Classify the intent of this user message for SkyVoice, the AI voice assistant for Skyvion Technologies (an AI/aerospace/agritech company).

User message: "${text}"

Choose exactly ONE intent from this list:
- general_query: General questions about Skyvion, its products (Airspace Intelligence, AgriVision, AerionAI, SupplyChain AI), tech stack, team, mission, or services
- booking_request: User wants to schedule, book, or arrange an appointment or meeting
- project_inquiry: User wants to discuss a project, hire Skyvion, get a proposal, or start a collaboration
- operational_query: Questions about system status, uptime, metrics, current schedules, or real-time operational data
- faq: Common questions about pricing, timelines, capabilities, or support
- escalation: User is frustrated, needs urgent human assistance, or is escalating a complaint
- greeting: User is greeting or introducing themselves
- farewell: User is saying goodbye or ending the conversation
- project_status_update: User is reporting, updating, or setting the status or progress of a specific project (e.g. "AgriVision is 50% done", "mark AerionAI as complete", "update supply chain to 75%", "the drone project is finished")
- unknown: None of the above apply

Respond with ONLY the intent label, nothing else.`;

  } else if (task === 'sentiment') {
    prompt = `Analyze the sentiment of this voice assistant conversation message.

Message: "${text}"

Respond with ONLY one word: positive, neutral, or negative`;

  } else {
    prompt = `You are a reasoning assistant for SkyVoice, Skyvion Technologies' AI voice system.

Analyze this user message and provide a concise (1–2 sentence) reasoning note that captures the user's underlying need, implied context, or nuance that a response generator should be aware of.

User message: "${text}"

Reasoning note (be brief and factual):`;
  }

  return callWithRetry(async () => {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  });
}

// Structured JSON extraction — strips markdown fences, parses JSON
export async function generateGeminiJson<T>(prompt: string): Promise<T | null> {
  const model = getModel();
  if (!model) return null;
  try {
    const raw = await callWithRetry(async () => {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    });
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.warn('[Gemini] generateGeminiJson failed:', (err as Error).message);
    return null;
  }
}
