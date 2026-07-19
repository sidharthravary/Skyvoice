import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { parseCookies, JWT_SECRET } from '../middleware/auth';
import { searchKnowledge } from './ragService';
import { getAvailableSlots, parseNaturalDate, parseNaturalTime } from './calendarService';
import { ProjectInquiry } from '../models/projectInquiry.model';
import { Conversation } from '../models/conversation.model';
import { Appointment } from '../models/appointment.model';
import { KnowledgeBase } from '../models/knowledgeBase.model';
import { OpenAI } from 'openai';
import { AIConfig } from '../models/aiConfig.model';
import { sendEmail, getProjectInquiryTemplate, getBookingConfirmationTemplate } from './emailService';
import {
  analyzeWithGemini, generateGeminiResponse, generateGeminiResponseStream,
  generateGeminiJson, isGeminiReady
} from './geminiService';
import {
  trackVoiceQuery, trackBooking, trackProjectUpdate
} from './userSessionService';
import {
  createRouter, createWebRtcTransport, isWorkerReady
} from '../webrtc/mediasoupServer';
import { attachProducerToSTT, isFfmpegAvailable } from '../webrtc/rtpToWhisper';
import * as mediasoup from 'mediasoup';

const openaiApiKey = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;
if (
  openaiApiKey &&
  !openaiApiKey.includes('your-openai-api-key') &&
  !openaiApiKey.includes('placeholder')
) {
  openai = new OpenAI({ apiKey: openaiApiKey });
}

type Intent =
  | 'general_query'
  | 'booking_request'
  | 'project_inquiry'
  | 'operational_query'
  | 'project_status_update'
  | 'faq'
  | 'escalation'
  | 'greeting'
  | 'farewell'
  | 'unknown';

const VALID_INTENTS: Intent[] = [
  'general_query', 'booking_request', 'project_inquiry', 'operational_query',
  'project_status_update', 'faq', 'escalation', 'greeting', 'farewell', 'unknown',
];

interface UserSession {
  state: 'idle' | 'booking' | 'inquiry';
  intent: Intent;
  fullName: string;
  bookingForm: {
    name?: string;
    date?: string;
    time?: string;
  };
  inquiryForm: {
    companyName?: string;
    email?: string;
    requirements?: string;
    budget?: string;
    timeline?: string;
  };
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: Date }>;
  // Index into `messages` where THIS session's new content starts — anything
  // before it is seeded history from previous conversations (context for the
  // LLM, but never re-saved to the database).
  persistFrom: number;
  greeting: string;
}

const sessions:      Map<string, UserSession> = new Map();
const socketUserIds: Map<string, string>      = new Map();

// ── Auth helpers ───────────────────────────────────────────────────────────────

function decodeSocketAuth(socket: Socket): { userId: string; username: string; fullName: string } {
  const auth = socket.handshake.auth as Record<string, string | undefined>;
  const username = auth?.username || 'Guest';
  const fullName = auth?.fullName || username;

  try {
    // The JWT lives in an HttpOnly cookie (sent with the handshake); the
    // handshake auth field remains as a fallback for non-browser clients.
    const token = parseCookies(socket.handshake.headers.cookie)['skyvoice_token'] || auth?.token;
    if (token) {
      const payload = jwt.verify(
        token,
        JWT_SECRET
      ) as { userId: string };
      return { userId: payload.userId, username, fullName };
    }
  } catch {
    // token invalid — fallback
  }
  return { userId: socket.id, username, fullName };
}

// Send a booking confirmation to the booker's registered email address
async function sendBookingEmail(userId: string, name: string, date: string, time: string): Promise<void> {
  const { User } = await import('../models/user.model');
  const user = await User.findById(userId).select('email').catch(() => null);
  if (!user?.email) return; // guests / accounts without email
  await sendEmail({
    to: user.email,
    subject: `Appointment confirmed — ${date} at ${time}`,
    html: getBookingConfirmationTemplate(name, date, time, 'UTC'),
  });
}

// ── Booking — Atlas save with conflict check and post-save verify ──────────────

async function persistAppointment(params: {
  visitorName: string;
  date:        string;   // DD-MM-YYYY
  time:        string;   // HH:MM
  notes:       string;
  userId:      string;
}): Promise<{ success: boolean; message: string; appointmentId?: string }> {
  try {
    const parts = params.date.split('-');
    let startOfDay: Date, endOfDay: Date;
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts.map(Number);
      startOfDay = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
      endOfDay   = new Date(Date.UTC(yyyy, mm - 1, dd, 23, 59, 59));
    } else {
      startOfDay = new Date(params.date);
      endOfDay   = new Date(params.date);
    }

    // Conflict check
    const conflict = await Appointment.findOne({
      date:   { $gte: startOfDay, $lte: endOfDay },
      time:   params.time,
      status: { $ne: 'cancelled' },
    });
    if (conflict) {
      const who = conflict.visitorName || conflict.name;
      return {
        success: false,
        message: `That slot is already taken${who ? ` for ${who}` : ''}. Please choose a different time.`,
      };
    }

    // Save
    const appointment = await Appointment.create({
      userId:      params.userId,
      name:        params.visitorName,
      visitorName: params.visitorName,
      date:        startOfDay,
      time:        params.time,
      timezone:    'UTC',
      status:      'confirmed',
      notes:       params.notes || 'Booked via SkyVoice AI Assistant',
    });

    // Verify
    const verified = await Appointment.findById(appointment._id);
    if (!verified) {
      return { success: false, message: 'There was an issue saving your appointment. Please try again.' };
    }

    console.log(`✅ [Appointment] saved: ${appointment._id} — ${params.date} at ${params.time} for ${params.visitorName}`);

    // Track in user session (non-blocking)
    trackBooking(params.userId, appointment).catch(err =>
      console.error('[trackBooking] Error:', err)
    );

    // Confirmation email (non-blocking; no-op until EMAIL_ENABLED is on)
    sendBookingEmail(params.userId, params.visitorName, params.date, params.time).catch(err =>
      console.error('[Email] Booking confirmation failed:', err)
    );

    return {
      success:       true,
      appointmentId: appointment._id.toString(),
      message:       `Your appointment has been confirmed for ${params.date} at ${params.time}.`,
    };
  } catch (err) {
    console.error('[persistAppointment] Error:', err);
    return { success: false, message: 'An error occurred saving your appointment. Please try again.' };
  }
}

// ── Project status update ──────────────────────────────────────────────────────

interface ProjectUpdateExtract {
  projectName: string;
  newStatus:   string;
  note:        string;
}

const PROJECT_ALIASES: Array<{ aliases: string[]; canonical: string }> = [
  { aliases: ['agrivision','agri','agriculture','crop','vegetation'],           canonical: 'AgriVision' },
  { aliases: ['aerionai','aerion','drone','uav','drones','aerospace fleet'],    canonical: 'AerionAI' },
  { aliases: ['airspace','aviation','air traffic','airspace intelligence'],     canonical: 'Airspace Intelligence' },
  { aliases: ['supplychain','supply chain','logistics','supply','deliveries'],  canonical: 'SupplyChain AI' },
];

function resolveProjectName(text: string): string | null {
  const q = text.toLowerCase();
  for (const { aliases, canonical } of PROJECT_ALIASES) {
    if (aliases.some(a => q.includes(a))) return canonical;
  }
  return null;
}

function extractStatusKeywords(text: string): string {
  const q = text.toLowerCase();
  const pctMatch = q.match(/(\d+)\s*(?:percent|%)/);
  const terms = ['complete', 'completed', 'done', 'finished', 'deployed', 'launched', 'in progress'];
  const termMatch = terms.find(t => q.includes(t));

  if (pctMatch && termMatch) return `${pctMatch[1]}% ${termMatch}`;
  if (pctMatch)              return `${pctMatch[1]}% complete`;
  if (termMatch)             return termMatch;
  return text.trim();
}

async function updateProjectStatus(
  text:     string,
  userId:   string
): Promise<string> {
  let projectName: string | null = null;
  let newStatus = '';
  let note = '';

  // Try Gemini JSON extraction first
  if (isGeminiReady()) {
    const extractionPrompt = `Extract a project status update from this user message.
Message: "${text}"

Known Skyvion projects: AgriVision, AerionAI, Airspace Intelligence, SupplyChain AI.
Aliases: agri/agriculture/crop→AgriVision, aerion/drone/UAV→AerionAI, airspace/aviation→Airspace Intelligence, supply chain/logistics→SupplyChain AI.

Respond with ONLY valid JSON (no markdown, no extra text):
{"projectName":"exact project name","newStatus":"e.g. 50% complete or completed","note":"any context or empty string"}`;

    const extracted = await generateGeminiJson<ProjectUpdateExtract>(extractionPrompt);
    if (extracted?.projectName && extracted?.newStatus) {
      projectName = extracted.projectName;
      newStatus   = extracted.newStatus;
      note        = extracted.note || '';
    }
  }

  // Keyword fallback if Gemini unavailable or returned nothing useful
  if (!projectName) {
    projectName = resolveProjectName(text);
    newStatus   = extractStatusKeywords(text);
  }

  if (!projectName) {
    return "I'm not sure which project you're referring to. Could you specify — AgriVision, AerionAI, Airspace Intelligence, or SupplyChain AI?";
  }

  try {
    const doc = await KnowledgeBase.findOne({
      title: { $regex: projectName, $options: 'i' },
    });

    if (!doc) {
      return `I couldn't find a project called ${projectName} in the system.`;
    }

    // Extract previous status
    const statusMatch = doc.content.match(/[Cc]urrent status as of[^.]*\.|[Ss]print \d+[^.]*\.|\d+%[^.]*\./);
    const previousStatus = statusMatch ? statusMatch[0].trim() : 'unknown';

    // Build updated content
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const statusLine = `Current status as of ${today}: ${newStatus}.${note ? ' ' + note : ''}`;

    let updatedContent = doc.content;
    if (/current status as of/i.test(updatedContent)) {
      updatedContent = updatedContent.replace(/[Cc]urrent status as of[^.]*\./i, statusLine);
    } else {
      updatedContent = updatedContent.trimEnd() + ' ' + statusLine;
    }

    await KnowledgeBase.findByIdAndUpdate(doc._id, { content: updatedContent });
    console.log(`✅ [KB] ${projectName} updated to: ${newStatus}`);

    // Track in user session
    trackProjectUpdate(userId, projectName, previousStatus, newStatus, note).catch(err =>
      console.error('[trackProjectUpdate] Error:', err)
    );

    return `Got it. I've updated ${projectName} to ${newStatus} and saved it to the system.`;
  } catch (err) {
    console.error('[updateProjectStatus] Error:', err);
    return `I had trouble updating ${projectName}. Please try again.`;
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

export function setupVoicePipeline(io: Server) {
  const voiceNamespace = io.of('/voice');

  voiceNamespace.on('connection', async (socket: Socket) => {
    console.log(`[Voice Pipeline] Client connected: ${socket.id}`);

    const { userId, username, fullName } = decodeSocketAuth(socket);
    socketUserIds.set(socket.id, userId);

    // Personalized greeting
    let greeting: string;
    try {
      const config = await AIConfig.findOne();
      if (config?.greeting) {
        // Personalise the existing greeting
        greeting = config.greeting.replace(/hello[,!]?/i, `Hello ${fullName},`);
      } else {
        greeting = username === 'Admin'
          ? `Hello Admin, welcome back to Skyvion AI Systems. What can I help you with today?`
          : `Hello ${fullName}, welcome to Skyvion AI Systems. How can I assist you today?`;
      }
    } catch {
      greeting = `Hello ${fullName}, welcome to Skyvion AI Systems. How can I assist you today?`;
    }

    let voiceName = 'Default';
    try {
      const config = await AIConfig.findOne();
      if (config?.voiceName) voiceName = config.voiceName;
    } catch { /* ignore */ }

    // ── AI memory: seed the context with the user's recent history ────────────
    // The assistant genuinely remembers past sessions ("what did we discuss
    // yesterday?"), while only new messages get persisted.
    let seededMessages: UserSession['messages'] = [];
    if (userId !== socket.id) {
      try {
        const recent = await Conversation.find({ userId, 'messages.role': 'user' })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('messages')
          .lean();
        seededMessages = recent
          .reverse()
          .flatMap((c) =>
            ((c.messages ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>).map(
              (m) => ({ role: m.role, content: m.content })
            )
          )
          .slice(-16);
        if (seededMessages.length > 0) {
          console.log(`[Voice Pipeline] 🧠 Seeded ${seededMessages.length} history messages for ${username}`);
        }
      } catch (err) {
        console.warn('[Voice Pipeline] History seed failed:', err);
      }
    }

    sessions.set(socket.id, {
      state: 'idle',
      intent: 'general_query',
      fullName,
      bookingForm: {},
      inquiryForm: {},
      messages: [
        ...seededMessages,
        { role: 'assistant', content: greeting, timestamp: new Date() },
      ],
      persistFrom: seededMessages.length,
      greeting,
    });

    const useBrowserAssist = !openai;
    socket.emit('ready', {
      greeting,
      voiceName,
      useBrowserAssist,
      geminiActive: isGeminiReady(),
      message: useBrowserAssist
        ? 'No API keys set. Using browser-assisted Web Speech fallback.'
        : `OpenAI pipeline active${isGeminiReady() ? ' + Gemini reasoning layer' : ''}.`,
    });

    socket.on('audio-chunk', async (_data: Buffer) => {
      if (useBrowserAssist) return;
    });

    socket.on('stop-recording', async () => {
      if (useBrowserAssist) return;
    });

    // ── Shared text-processing helper (used by text-input AND WebRTC STT bridge) ──

    async function handleTextInput(text: string): Promise<void> {
      console.log(`[Voice Pipeline] ▶ text-input from ${socket.id}: "${text}"`);
      const session = sessions.get(socket.id);
      if (!session) {
        console.warn(`[Voice Pipeline] No session for socket ${socket.id}`);
        return;
      }

      session.messages.push({ role: 'user', content: text, timestamp: new Date() });
      socket.emit('transcript', { sender: 'user', text });
      socket.emit('status', 'thinking');

      const uid = socketUserIds.get(socket.id) || socket.id;

      const watchdog = setTimeout(() => {
        console.error(`[Voice Pipeline] ⚠️ 30s timeout for "${text}" — sending fallback`);
        socket.emit('ai-response-text', "I'm taking longer than expected. Please try again.");
        socket.emit('status', 'idle');
      }, 30_000);

      try {
        console.log(`[Voice Pipeline] 🔄 Processing: "${text}" (session state: ${session.state})`);
        const response = await processConversationTurn(text, session, uid, (chunk) => {
          socket.emit('ai-response-chunk', chunk);
        });
        clearTimeout(watchdog);

        console.log(`[Voice Pipeline] ✅ Response: "${response.substring(0, 80)}..."`);
        session.messages.push({ role: 'assistant', content: response, timestamp: new Date() });
        socket.emit('ai-response-text', response);
        socket.emit('status', 'speaking');

        trackVoiceQuery(uid, text, response, session.intent).catch(err =>
          console.error('[trackVoiceQuery] Error:', err)
        );
      } catch (error) {
        clearTimeout(watchdog);
        console.error('[Voice Pipeline] ❌ processConversationTurn crash:', error);
        socket.emit('ai-response-text', "I'm sorry, I encountered an error. How else can I help you?");
        socket.emit('status', 'idle');
      }
    }

    socket.on('text-input', (text: string) => { void handleTextInput(text); });

    // "New chat": persist the current thread (if the user spoke) and start a
    // fresh conversation context with just the greeting.
    socket.on('reset-session', async () => {
      const session = sessions.get(socket.id);
      if (!session) return;
      const uid = socketUserIds.get(socket.id) || socket.id;

      const newMessages = session.messages.slice(session.persistFrom);
      if (newMessages.some((m) => m.role === 'user')) {
        try {
          const sentiment = await detectSentiment(newMessages);
          await Conversation.create({
            userId: uid,
            messages: newMessages,
            intent: session.intent,
            sentiment,
            resolved: session.state === 'idle',
          });
        } catch (err) {
          console.error('[Voice Pipeline] reset-session save failed:', err);
        }
      }

      session.messages = [{ role: 'assistant', content: session.greeting, timestamp: new Date() }];
      session.persistFrom = 0;
      session.state = 'idle';
      session.intent = 'general_query';
      session.bookingForm = {};
      session.inquiryForm = {};
      socket.emit('session-reset', { greeting: session.greeting });
    });

    // ── WebRTC signaling (additive — does NOT touch existing events above) ────────

    let sessionRouter: mediasoup.types.Router | null = null;
    let routerPromise: Promise<mediasoup.types.Router | null> | null = null;
    let sessionSendTransport: mediasoup.types.WebRtcTransport | null = null;
    let statsIntervalId: ReturnType<typeof setInterval> | null = null;

    async function getRouter(): Promise<mediasoup.types.Router | null> {
      if (sessionRouter) return sessionRouter;
      if (!isWorkerReady()) return null;
      if (!routerPromise) routerPromise = createRouter();
      sessionRouter = await routerPromise;
      return sessionRouter;
    }

    socket.on('webrtc_get_capabilities', async (cb: (caps: mediasoup.types.RtpCapabilities | { error: string }) => void) => {
      const router = await getRouter();
      if (!router) return cb({ error: 'mediasoup not ready' });
      cb(router.rtpCapabilities);
    });

    socket.on('webrtc_create_transport', async (cb: (params: Record<string, unknown>) => void) => {
      const router = await getRouter();
      if (!router) return cb({ error: 'mediasoup not ready' });
      try {
        const transport = await createWebRtcTransport(router);
        sessionSendTransport = transport;

        statsIntervalId = setInterval(() => {
          void (async () => {
            try {
              const raw: unknown = await transport.getStats();
              let jitter = 0, packetsLost = 0, roundTripTime = 0, bitrate = 0;

              const extractStat = (s: Record<string, unknown>) => {
                if (typeof s.jitter === 'number') jitter = Math.round(s.jitter * 1000);
                if (typeof s.packetsLost === 'number') packetsLost = s.packetsLost;
                if (typeof s.roundTripTime === 'number') roundTripTime = Math.round(s.roundTripTime * 1000);
                if (typeof s.bitrate === 'number') bitrate = Math.round(s.bitrate / 1000);
              };

              if (raw instanceof Map) {
                raw.forEach((s) => extractStat(s as Record<string, unknown>));
              } else if (Array.isArray(raw) && raw.length > 0) {
                extractStat(raw[0] as Record<string, unknown>);
              }

              const statsData = { jitter, packetsLost, roundTripTime, bitrate };
              socket.emit('webrtc_stats', statsData);
              io.of('/monitoring').emit('webrtc_stats', statsData);
            } catch { /* transport may be closed */ }
          })();
        }, 5000);

        cb({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (err) {
        console.error('[WebRTC] createWebRtcTransport error:', err);
        cb({ error: 'Failed to create transport' });
      }
    });

    socket.on('webrtc_connect_transport', async (
      { dtlsParameters }: { dtlsParameters: mediasoup.types.DtlsParameters },
      cb: (result: { connected: boolean } | { error: string }) => void
    ) => {
      if (!sessionSendTransport) return cb({ error: 'No transport' });
      try {
        await sessionSendTransport.connect({ dtlsParameters });
        cb({ connected: true });
      } catch (err) {
        console.error('[WebRTC] connect transport error:', err);
        cb({ error: 'Failed to connect transport' });
      }
    });

    socket.on('webrtc_produce', async (
      { kind, rtpParameters }: { kind: mediasoup.types.MediaKind; rtpParameters: mediasoup.types.RtpParameters },
      cb: (result: { producerId: string } | { error: string }) => void
    ) => {
      const currentRouter = sessionRouter ?? await getRouter();
      if (!sessionSendTransport || !currentRouter) return cb({ error: 'No transport' });
      try {
        const producer = await sessionSendTransport.produce({ kind, rtpParameters });
        cb({ producerId: producer.id });

        if (isFfmpegAvailable() && currentRouter) {
          void attachProducerToSTT(producer, socket, currentRouter, handleTextInput);
        }
      } catch (err) {
        console.error('[WebRTC] produce error:', err);
        cb({ error: 'Failed to create producer' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`[Voice Pipeline] Client disconnected: ${socket.id}`);

      // WebRTC cleanup
      if (statsIntervalId) clearInterval(statsIntervalId);
      try { sessionSendTransport?.close(); } catch { /* ignore */ }
      try { sessionRouter?.close(); } catch { /* ignore */ }

      const session = sessions.get(socket.id);
      const uid     = socketUserIds.get(socket.id) || socket.id;
      // Persist only THIS session's new messages (never re-save seeded
      // history), and only when the user actually said something.
      const newMessages = session ? session.messages.slice(session.persistFrom) : [];
      if (session && !newMessages.some((m) => m.role === 'user')) {
        sessions.delete(socket.id);
        socketUserIds.delete(socket.id);
        return;
      }
      if (session) {
        try {
          const sentiment = await detectSentiment(newMessages);
          const savedConv = await Conversation.create({
            userId:   uid,
            messages: newMessages,
            intent:   session.intent,
            sentiment,
            resolved: session.state === 'idle',
          });
          console.log(`💾 [Conversation] saved: ${savedConv._id}`);
        } catch (err) {
          console.error('[Voice Pipeline] Failed to save conversation:', err);
        }
        sessions.delete(socket.id);
        socketUserIds.delete(socket.id);
      }
    });
  });
}

// ── Sentiment ──────────────────────────────────────────────────────────────────

async function detectSentiment(
  messages: Array<{ role: string; content: string }>
): Promise<'positive' | 'neutral' | 'negative'> {
  const last = [...messages].reverse().find(m => m.role === 'user');
  if (!last) return 'neutral';

  if (isGeminiReady()) {
    try {
      const raw = await analyzeWithGemini(last.content, 'sentiment');
      const val = raw.toLowerCase().replace(/[^a-z]/g, '');
      if (val === 'positive' || val === 'neutral' || val === 'negative') return val;
    } catch { /* fallthrough */ }
  }

  const text  = last.content.toLowerCase();
  const pos   = ['good','great','awesome','thank','perfect','yes','excellent','happy'];
  const neg   = ['bad','error','failed','broken','wrong','no','hate','annoyed'];
  let score   = 0;
  pos.forEach(w => { if (text.includes(w)) score++; });
  neg.forEach(w => { if (text.includes(w)) score--; });
  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}

// ── Intent classification ──────────────────────────────────────────────────────

async function classifyIntent(text: string): Promise<Intent> {
  if (isGeminiReady()) {
    try {
      const raw   = await analyzeWithGemini(text, 'intent');
      const label = raw.toLowerCase().trim() as Intent;
      if (VALID_INTENTS.includes(label)) {
        console.log(`[Gemini] Intent: ${label}`);
        return label;
      }
    } catch (err) {
      console.warn('[Gemini] Intent failed, using keyword fallback:', (err as Error).message);
    }
  }
  return classifyIntentKeywords(text);
}

function classifyIntentKeywords(text: string): Intent {
  const q = text.toLowerCase();

  // Project status update: "[project] is [X]%" / "update [project] to"
  const hasProjectAlias = PROJECT_ALIASES.some(({ aliases }) => aliases.some(a => q.includes(a)));
  const hasStatusWord   = /\d+\s*(?:percent|%)|(complete|done|finished|deployed|launched)/.test(q);
  const hasUpdateVerb   = q.includes('update') || q.includes('mark') || q.includes('set') || q.includes('change');
  if (hasProjectAlias && (hasStatusWord || hasUpdateVerb)) return 'project_status_update';

  // Operational (before booking to avoid false match on "meeting")
  const DAY_NAMES = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const hasDayOrTimeRef = DAY_NAMES.some(d => q.includes(d)) ||
    q.includes('today') || q.includes('tomorrow') || q.includes('this week') || q.includes('week');
  if (
    q.includes('uptime') || q.includes('latency') || q.includes('stats') || q.includes('status') ||
    q.includes('metrics') || q.includes('pending') || q.includes('tasks') || q.includes('blockers') ||
    q.includes('cancelled') || q.includes('investor') || q.includes('priorities') ||
    ((q.includes('meeting') || q.includes('appointment') || q.includes('call')) && hasDayOrTimeRef)
  ) return 'operational_query';

  if (q.includes('book') || q.includes('schedule') || q.includes('appointment') || q.includes('meeting')) return 'booking_request';
  if (q.includes('project') || q.includes('build') || q.includes('hire') || q.includes('proposal')) return 'project_inquiry';
  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) return 'greeting';
  if (q.includes('bye') || q.includes('goodbye') || q.includes('farewell')) return 'farewell';
  if (
    q.includes('what is') || q.includes('how does') || q.includes('tell me') || q.includes('explain') ||
    q.includes('agrivision') || q.includes('aerion') || q.includes('airspace') ||
    q.includes('supply chain') || q.includes('skyvion') || q.includes('products') ||
    q.includes('mission') || q.includes('tech stack') || q.includes('solutions')
  ) return 'faq';
  return 'unknown';
}

// ── Operational context ────────────────────────────────────────────────────────

function extractDateRange(q: string): { start: Date; end: Date; label: string } | null {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const mo  = now.getUTCMonth();
  const d   = now.getUTCDate();

  const hasTodayHint    = q.includes('today') || q.includes('now') || q.includes('currently');
  const hasTomorrowHint = q.includes('tomorrow');
  const hasWeekHint     = q.includes('this week') || q.includes('week');
  const hasMeetingHint  = q.includes('meeting') || q.includes('appointment') || q.includes('schedule') || q.includes('call');

  if (hasTomorrowHint) {
    return {
      start: new Date(Date.UTC(y, mo, d + 1, 0, 0, 0)),
      end:   new Date(Date.UTC(y, mo, d + 1, 23, 59, 59)),
      label: 'tomorrow',
    };
  }
  if (hasWeekHint) {
    const dow   = now.getDay();
    const toMon = dow === 0 ? -6 : 1 - dow;
    return {
      start: new Date(Date.UTC(y, mo, d + toMon, 0, 0, 0)),
      end:   new Date(Date.UTC(y, mo, d + toMon + 6, 23, 59, 59)),
      label: 'this week',
    };
  }

  const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (q.includes(DAY_NAMES[i])) {
      const dow  = now.getDay();
      let diff   = i - dow;
      if (diff < 0) diff += 7;
      const target = new Date(Date.UTC(y, mo, d + diff, 0, 0, 0));
      return {
        start: target,
        end:   new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 23, 59, 59)),
        label: `on ${DAY_NAMES[i].charAt(0).toUpperCase() + DAY_NAMES[i].slice(1)}`,
      };
    }
  }

  if (hasTodayHint || hasMeetingHint) {
    return {
      start: new Date(Date.UTC(y, mo, d, 0, 0, 0)),
      end:   new Date(Date.UTC(y, mo, d, 23, 59, 59)),
      label: 'today',
    };
  }
  return null;
}

function fmtApptDate(date: Date): string {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

async function buildOperationalContext(text: string): Promise<string> {
  const q     = text.toLowerCase();
  const parts: string[] = [];

  const wantsSchedule =
    q.includes('meeting') || q.includes('appointment') || q.includes('schedule') ||
    q.includes('today') || q.includes('tomorrow') || q.includes('week') ||
    q.includes('who') || q.includes('call') || q.includes('cancelled') || q.includes('investor');

  if (wantsSchedule) {
    try {
      const range  = extractDateRange(q);
      const filter: Record<string, unknown> = {};
      if (range) filter.date = { $gte: range.start, $lte: range.end };

      const appts = await Appointment.find(filter).sort({ date: 1, time: 1 }).limit(20);
      if (appts.length > 0) {
        const lines = appts.map(a => {
          const who        = a.visitorName || a.name;
          const dateStr    = fmtApptDate(a.date);
          const statusNote = a.status !== 'confirmed' ? ` [${a.status}]` : '';
          return `• ${dateStr} at ${a.time} — ${who}${statusNote}: ${a.notes || 'No notes'}`;
        });
        parts.push(`Appointments ${range?.label ?? 'scheduled'}:\n${lines.join('\n')}`);
      } else {
        parts.push(`No appointments found ${range?.label ?? ''}.`);
      }
    } catch (err) {
      console.warn('[Operational] Appointment query error:', (err as Error).message);
    }
  }

  try {
    const hits = await searchKnowledge(text, 3);
    if (hits.length > 0) {
      const kbText = hits.slice(0, 2).map(h => `${h.title}:\n${h.content}`).join('\n\n');
      parts.push(`Relevant project information:\n${kbText}`);
    }
  } catch (err) {
    console.warn('[Operational] KB search error:', (err as Error).message);
  }

  return parts.join('\n\n---\n\n');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cleanSpokenEmail(text: string): string {
  return text.toLowerCase().trim()
    .replace(/\s*at\s*/g, '@')
    .replace(/\s*dot\s*/g, '.')
    .replace(/\s+/g, '');
}

async function getReasoningNote(text: string): Promise<string> {
  if (!isGeminiReady()) return '';
  try {
    return await analyzeWithGemini(text, 'reasoning');
  } catch {
    return '';
  }
}

const SKYVION_SYSTEM_PROMPT = `You are SkyVoice, an advanced, polite voice assistant for Skyvion Technologies, an AI-powered technology company based in Trivandrum (Thiruvananthapuram), Kerala, India, operating as a Limited Liability Partnership (LLP).
Skyvion sits at the intersection of aerospace, agriculture, and supply chain management — unified by AI, ML, and data analytics.
Tagline: "Innovation at every altitude". Philosophy: safety-first design, real-time processing, scalable architecture.
Tech Stack: TensorFlow, PyTorch, LangChain, OpenAI; Sentinel-2, Landsat, GEE; FastAPI, PostgreSQL, MongoDB, Redis; AWS, Docker, Kubernetes.
Flagship Products: Airspace Intelligence (drone traffic coordination), AgriVision (satellite agriculture), AerionAI (aerospace resource allocation), SupplyChain AI (autonomous demand forecasting, 98.7% accuracy).
CRITICAL VOICE CONSTRAINTS:
1) Responses are spoken aloud — keep them to 1–3 sentences, natural, conversational. No bullet points.
2) Never mention "knowledge base", "database", or "document store". Speak as a company representative.`;

// ── Main conversation orchestrator ────────────────────────────────────────────

async function processConversationTurn(
  text:    string,
  session: UserSession,
  userId:  string,
  onChunk?: (text: string) => void
): Promise<string> {
  const fullName = session.fullName || 'there';

  // ── 1. BOOKING STATE MACHINE ────────────────────────────────────────────────
  // name is always pre-filled from socket auth — we only collect date and time
  if (session.state === 'booking') {
    const form = session.bookingForm;

    if (!form.date) {
      const dateVal = parseNaturalDate(text);
      form.date     = dateVal;
      try {
        const slots     = await getAvailableSlots(dateVal, 'UTC');
        const available = slots.filter(s => s.available).map(s => s.time).slice(0, 4).join(', ');
        return available
          ? `We have availability on ${dateVal} at: ${available}. Which time works for you?`
          : `I couldn't find open slots on ${dateVal}. Could you suggest another date?`;
      } catch {
        return `What time on ${dateVal} works for you? For example, 10:00 or 14:00.`;
      }
    }

    if (!form.time) {
      form.time = parseNaturalTime(text);
      const result = await persistAppointment({
        visitorName: form.name || fullName,
        date:        form.date,
        time:        form.time,
        notes:       'Booked via SkyVoice AI Assistant',
        userId,
      });
      session.state       = 'idle';
      session.bookingForm = {};
      return result.success
        ? `I've confirmed your appointment for ${form.date} at ${form.time}, ${fullName}. You're all set! Is there anything else I can help you with?`
        : result.message + ' Would you like to try a different time?';
    }
  }

  // ── 2. PROJECT INQUIRY STATE MACHINE ────────────────────────────────────────
  if (session.state === 'inquiry') {
    const form = session.inquiryForm;

    if (!form.companyName) {
      form.companyName = text;
      return "Thank you. What is your email address so we can follow up?";
    }
    if (!form.email) {
      form.email = cleanSpokenEmail(text);
      return "Got it. Briefly describe your project requirements — what are you looking to build?";
    }
    if (!form.requirements) {
      form.requirements = text;
      form.budget       = '$5,000 - $10,000';
      form.timeline     = '3-6 months';
      try {
        const lead = await ProjectInquiry.create({
          companyName:  form.companyName,
          requirements: form.requirements,
          budget:       form.budget,
          timeline:     form.timeline,
          email:        form.email,
          status:       'new',
        });
        console.log(`💾 [ProjectInquiry] saved: ${lead._id}`);

        await sendEmail({
          to:      lead.email,
          subject: 'SkyVoice: New Inquiry Captured',
          html:    getProjectInquiryTemplate(
            lead.companyName,
            lead.requirements || '',
            lead.budget || '',
            lead.timeline || '',
            lead.email
          ),
        });

        session.state       = 'idle';
        session.inquiryForm = {};
        return `Perfect! I've captured the project inquiry for ${form.companyName}. Our team will reach out to ${form.email} shortly. Anything else?`;
      } catch {
        session.state = 'idle';
        return "I captured your details but had trouble saving them. Please contact our team directly.";
      }
    }
  }

  // ── 3. INTENT CLASSIFICATION ────────────────────────────────────────────────
  console.log(`[Pipeline] 🎯 [1/4] Classifying intent for: "${text.substring(0, 60)}"`);
  const intent = await classifyIntent(text);
  session.intent = intent;
  console.log(`[Pipeline] ✅ [1/4] Intent: ${intent}`);

  // Hard-route intents
  if (intent === 'booking_request') {
    session.state      = 'booking';
    session.bookingForm = { name: fullName }; // pre-fill from auth — never ask for name
    return `I can help you schedule a visit, ${fullName}! What date works for you? You can say "tomorrow", "next Friday", or a specific date.`;
  }
  if (intent === 'project_inquiry') {
    session.state = 'inquiry';
    return "Great! I can log a project inquiry with our engineering team. What is the name of your company?";
  }
  if (intent === 'greeting') {
    return `Hello ${fullName}! I'm SkyVoice, Skyvion's AI assistant. I can schedule appointments, answer product questions, or capture project inquiries. How can I help?`;
  }
  if (intent === 'farewell') {
    return `Goodbye, ${fullName}! It was great speaking with you. Feel free to reach out anytime. Have a wonderful day!`;
  }
  if (intent === 'escalation') {
    return "I understand this is urgent. I'm flagging this for our team — someone will follow up shortly. Is there anything else I can note down?";
  }
  if (intent === 'project_status_update') {
    return await updateProjectStatus(text, userId);
  }

  // ── 4. BUILD CONTEXT ────────────────────────────────────────────────────────
  let dataContext   = '';
  let reasoningNote = '';

  console.log(`[Pipeline] 🎯 [2/4] Building context (intent: ${intent})`);
  if (intent === 'operational_query') {
    dataContext = await buildOperationalContext(text);
    console.log(`[Pipeline] ✅ [2/4] Operational context: ${dataContext.length} chars`);
  } else {
    reasoningNote = await getReasoningNote(text);
    const hits    = await searchKnowledge(text);
    if (hits.length > 0) dataContext = hits.slice(0, 2).map(h => h.content).join('\n\n');
    console.log(`[Pipeline] ✅ [2/4] KB context: ${dataContext.length} chars, ${hits.length} hits`);
  }

  // ── 5. LLM RESPONSE ─────────────────────────────────────────────────────────
  const isOperational = intent === 'operational_query';
  const systemSuffix  = [
    reasoningNote ? `Gemini reasoning context: ${reasoningNote}` : '',
    dataContext   ? (isOperational
        ? `Live data from company database:\n${dataContext}`
        : `Relevant company knowledge:\n${dataContext}`)
      : '',
    isOperational
      ? 'When answering about meetings, projects, or schedules use the live data above. Answer in 2–3 spoken sentences. No bullet points.'
      : '',
  ].filter(Boolean).join('\n\n');

  const fullSystemPrompt = systemSuffix
    ? `${SKYVION_SYSTEM_PROMPT}\n\n${systemSuffix}`
    : SKYVION_SYSTEM_PROMPT;

  console.log(`[Pipeline] 🎯 [3/4] Generating LLM response (openai=${!!openai}, gemini=${isGeminiReady()})`);

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model:    process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...session.messages,
        ],
      });
      const reply = completion.choices[0].message.content || 'I did not catch that. Could you rephrase?';
      console.log(`[Pipeline] ✅ [3/4] OpenAI response (${reply.length} chars)`);
      return reply;
    } catch (err) {
      console.error('[Pipeline] ❌ [3/4] OpenAI failed:', (err as Error).message);
    }
  }

  // ── 6. GEMINI FALLBACK ───────────────────────────────────────────────────────
  if (isGeminiReady()) {
    try {
      const ctx = [
        fullSystemPrompt,
        'Conversation so far:',
        ...session.messages.map(m => `${m.role}: ${m.content}`),
      ].join('\n\n');
      const geminiPrompt = `User: ${text}\nAssistant:`;

      // Stream tokens to the client when a chunk sink is provided (chat UI);
      // fall back to the non-streaming call if streaming fails mid-flight.
      if (onChunk) {
        try {
          const reply = await generateGeminiResponseStream(geminiPrompt, ctx, onChunk);
          console.log(`[Pipeline] ✅ [3/4] Gemini streamed response (${reply.length} chars)`);
          return reply;
        } catch (err) {
          console.warn('[Pipeline] ⚠️ [3/4] Gemini streaming failed, retrying non-streaming:', (err as Error).message);
        }
      }

      const reply = await generateGeminiResponse(geminiPrompt, ctx);
      console.log(`[Pipeline] ✅ [3/4] Gemini response (${reply.length} chars)`);
      return reply;
    } catch (err) {
      console.error('[Pipeline] ❌ [3/4] Gemini fallback failed:', (err as Error).message);
    }
  }

  // ── 7. STATIC FALLBACK ───────────────────────────────────────────────────────
  console.log(`[Pipeline] ✅ [3/4] Using static fallback response`);
  if (dataContext) return `Here's what I found: ${dataContext.slice(0, 300)}...`;

  return `I heard: "${text}". I can book appointments, answer product questions, or capture project inquiries. How can I help?`;
}
