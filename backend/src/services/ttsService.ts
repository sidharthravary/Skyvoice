// Natural AI voice via the Gemini TTS API. Returns a WAV buffer, or null when
// unavailable (no key / quota / error) — callers fall back to browser TTS.

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore'; // warm, natural female voice

// Circuit breaker: when quota is exhausted stop calling for a while so the
// client falls back to browser TTS instantly instead of waiting on errors.
let disabledUntil = 0;

function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes('your-gemini') || key.includes('placeholder')) return null;
  return key;
}

export function isTtsAvailable(): boolean {
  return apiKey() !== null && Date.now() > disabledUntil;
}

// Gemini returns raw 16-bit PCM at 24kHz; browsers need a WAV header.
function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  const key = apiKey();
  if (!key || Date.now() < disabledUntil) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: text.slice(0, 900) }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
            },
          },
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (res.status === 429) {
      disabledUntil = Date.now() + 10 * 60 * 1000;
      console.warn('[TTS] Gemini TTS quota hit — disabled for 10 minutes');
      return null;
    }
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[TTS] Gemini TTS HTTP ${res.status}: ${body.slice(0, 200)}`);
      if (res.status === 404) disabledUntil = Date.now() + 60 * 60 * 1000; // model unavailable
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
    };
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!inline?.data) {
      console.warn('[TTS] Gemini TTS returned no audio');
      return null;
    }

    const pcm = Buffer.from(inline.data, 'base64');
    const rateMatch = inline.mimeType?.match(/rate=(\d+)/);
    return pcmToWav(pcm, rateMatch ? Number(rateMatch[1]) : 24000);
  } catch (err) {
    console.warn('[TTS] Gemini TTS failed:', (err as Error)?.message ?? err);
    return null;
  }
}
