import { execSync, spawn } from 'child_process';
import { createSocket } from 'dgram';
import * as mediasoup from 'mediasoup';
import type { Socket } from 'socket.io';
import OpenAI from 'openai';
import { createPlainTransport } from './mediasoupServer';

// ── ffmpeg detection ───────────────────────────────────────────────────────────

let ffmpegAvailable = false;
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  ffmpegAvailable = true;
} catch {
  console.error('❌ ffmpeg not found — WebRTC audio bridging disabled, falling back to Socket.io audio.');
}

export function isFfmpegAvailable(): boolean {
  return ffmpegAvailable;
}

// ── OpenAI Whisper client ──────────────────────────────────────────────────────

const openaiKey = process.env.OPENAI_API_KEY;
let whisperClient: OpenAI | null = null;
if (openaiKey && !openaiKey.includes('placeholder')) {
  whisperClient = new OpenAI({ apiKey: openaiKey });
}

// ── Port allocation ────────────────────────────────────────────────────────────

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const sock = createSocket('udp4');
    sock.bind(0, '127.0.0.1', () => {
      const port = (sock.address() as { port: number }).port;
      sock.close(() => resolve(port));
    });
    sock.on('error', reject);
  });
}

// ── SDP builder for ffmpeg ─────────────────────────────────────────────────────

function buildSdp(rtpPort: number, payloadType: number): string {
  return [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=SkyVoice WebRTC pipe',
    'c=IN IP4 127.0.0.1',
    't=0 0',
    `m=audio ${rtpPort} RTP/AVP ${payloadType}`,
    `a=rtpmap:${payloadType} opus/48000/2`,
    'a=recvonly',
    '',
  ].join('\r\n');
}

// ── WAV header builder ─────────────────────────────────────────────────────────

function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const header = Buffer.allocUnsafe(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

// ── Silence detection on raw 16-bit PCM ───────────────────────────────────────

const SILENCE_THRESHOLD = 600;
const SILENCE_DURATION_BYTES = 1200 * 16000 * 2 / 1000; // 1.2 s of 16kHz 16-bit PCM

function isSilent(chunk: Buffer): boolean {
  if (chunk.length < 2) return true;
  let energy = 0;
  for (let i = 0; i + 1 < chunk.length; i += 2) {
    energy += Math.abs(chunk.readInt16LE(i));
  }
  return (energy / (chunk.length / 2)) < SILENCE_THRESHOLD;
}

// ── Whisper transcription ──────────────────────────────────────────────────────

export async function whisperTranscribe(audioBuffer: Buffer): Promise<string> {
  if (!whisperClient) {
    throw new Error('OpenAI not configured — cannot transcribe with Whisper');
  }
  const file = new File([audioBuffer], 'audio.wav', { type: 'audio/wav' });
  const response = await whisperClient.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'en',
  });
  return response.text.trim();
}

// ── Transcribe a finished utterance and feed into the pipeline ─────────────────

async function transcribeAndEmit(
  rawPcm: Buffer,
  socket: Socket,
  onText: (text: string) => Promise<void>
): Promise<void> {
  if (rawPcm.length < 3200) return; // skip clips shorter than ~100 ms

  try {
    const wav = pcmToWav(rawPcm, 16000, 1, 16);
    const text = await whisperTranscribe(wav);
    if (text && text.length > 1) {
      console.log(`[Whisper] Transcribed: "${text}"`);
      socket.emit('transcript', { sender: 'user', text });
      await onText(text);
    }
  } catch (err) {
    console.warn('[rtpToWhisper] Whisper transcription failed:', (err as Error).message);
  }
}

// ── Main: attach a mediasoup Producer to the Whisper STT pipeline ──────────────

export async function attachProducerToSTT(
  producer: mediasoup.types.Producer,
  socket: Socket,
  router: mediasoup.types.Router,
  onText: (text: string) => Promise<void>
): Promise<void> {
  if (!ffmpegAvailable) {
    console.warn('[rtpToWhisper] ffmpeg unavailable — STT bridge disabled for this session');
    return;
  }

  try {
    const rtpPort = await findFreePort();

    const plainTransport = await createPlainTransport(router);
    await plainTransport.connect({ ip: '127.0.0.1', port: rtpPort });

    const consumer = await plainTransport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    });

    const payloadType = consumer.rtpParameters.codecs[0]?.payloadType ?? 100;
    const sdp = buildSdp(rtpPort, payloadType);

    // Decode Opus RTP → raw 16 kHz 16-bit PCM on stdout
    const ffmpeg = spawn('ffmpeg', [
      '-protocol_whitelist', 'pipe,udp,rtp',
      '-f', 'sdp',
      '-i', 'pipe:0',
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      'pipe:1',
    ]);

    ffmpeg.stdin.write(sdp);
    ffmpeg.stdin.end();
    ffmpeg.stderr.on('data', () => {}); // suppress ffmpeg logs

    // Accumulate speech, flush utterance on silence
    let speechBuf = Buffer.alloc(0);
    let silentBytes = 0;
    let hasSpeech = false;

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      const silent = isSilent(chunk);

      if (silent) {
        silentBytes += chunk.length;
        if (hasSpeech) speechBuf = Buffer.concat([speechBuf, chunk]);

        if (hasSpeech && silentBytes >= SILENCE_DURATION_BYTES) {
          const utterance = speechBuf;
          speechBuf = Buffer.alloc(0);
          silentBytes = 0;
          hasSpeech = false;
          void transcribeAndEmit(utterance, socket, onText);
        }
      } else {
        hasSpeech = true;
        silentBytes = 0;
        speechBuf = Buffer.concat([speechBuf, chunk]);
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('[rtpToWhisper] ffmpeg error:', err.message);
    });

    // Cleanup on close
    const cleanup = () => {
      try { ffmpeg.kill(); } catch { /* ignore */ }
      try { consumer.close(); } catch { /* ignore */ }
      try { plainTransport.close(); } catch { /* ignore */ }
    };

    producer.on('transportclose', cleanup);
    consumer.on('transportclose', cleanup);

    console.log(`[rtpToWhisper] STT bridge active on RTP port ${rtpPort}`);
  } catch (err) {
    console.error('[rtpToWhisper] Failed to attach producer to STT:', err);
  }
}
